import "server-only";
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, transactions, wallets, type TxnType, type WalletKind } from "@/db/schema";
import { addDays, addMonths, daysInMonth, monthStart, nextMonthStart, todayKST } from "@/lib/dates";
import { requireUser } from "./session";

// Every exported function resolves the user itself. Callers can't ask for someone else's data.

export type WalletWithBalance = {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  openingBalance: number;
  archived: boolean;
  sortOrder: number;
  balance: number;
  txnCount: number;
};

// Drizzle writes columns unqualified ("id") in single-table selects, which inside a
// correlated subquery would bind to the subquery's own table. Qualify them explicitly.
const WALLET_ID = sql.raw(`"wallets"."id"`);
const CATEGORY_ID = sql.raw(`"categories"."id"`);

const walletBalance = sql<number>`${wallets.openingBalance} + coalesce((
  select sum(case
    when t.type = 'income' and t.wallet_id = ${WALLET_ID} then t.amount
    when t.type = 'expense' and t.wallet_id = ${WALLET_ID} then -t.amount
    when t.type = 'transfer' and t.wallet_id = ${WALLET_ID} then -t.amount
    when t.type = 'transfer' and t.to_wallet_id = ${WALLET_ID} then t.amount
    else 0 end)
  from ${transactions} t
  where t.wallet_id = ${WALLET_ID} or t.to_wallet_id = ${WALLET_ID}
), 0)`.mapWith(Number);

const walletTxnCount = sql<number>`(
  select count(*) from ${transactions} t
  where t.wallet_id = ${WALLET_ID} or t.to_wallet_id = ${WALLET_ID}
)`.mapWith(Number);

export async function getWallets({ includeArchived = true } = {}): Promise<WalletWithBalance[]> {
  const user = await requireUser();
  return db
    .select({
      id: wallets.id,
      name: wallets.name,
      kind: wallets.kind,
      color: wallets.color,
      openingBalance: wallets.openingBalance,
      archived: wallets.archived,
      sortOrder: wallets.sortOrder,
      balance: walletBalance,
      txnCount: walletTxnCount,
    })
    .from(wallets)
    .where(and(eq(wallets.userId, user.id), includeArchived ? undefined : eq(wallets.archived, false)))
    .orderBy(asc(wallets.archived), asc(wallets.sortOrder), asc(wallets.createdAt));
}

export async function getCategories() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: categories.id,
      kind: categories.kind,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      keywords: categories.keywords,
      sortOrder: categories.sortOrder,
      txnCount: sql<number>`(select count(*) from ${transactions} t where t.category_id = ${CATEGORY_ID})`.mapWith(
        Number,
      ),
    })
    .from(categories)
    .where(and(eq(categories.userId, user.id), eq(categories.archived, false)))
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.createdAt));
  return rows;
}

export type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number];

/** Data the quick-entry box and transaction form need on the client. */
export async function getEntryContext() {
  const user = await requireUser();
  const [walletRows, categoryRows, mostUsed] = await Promise.all([
    getWallets({ includeArchived: false }),
    getCategories(),
    db
      .select({ walletId: transactions.walletId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          gte(transactions.date, addDays(todayKST(), -60)),
        ),
      )
      .groupBy(transactions.walletId)
      .orderBy(desc(sql`count(*)`))
      .limit(1),
  ]);
  const activeIds = new Set(walletRows.map((w) => w.id));
  const defaultWalletId =
    (mostUsed[0] && activeIds.has(mostUsed[0].walletId) ? mostUsed[0].walletId : null) ??
    walletRows.find((w) => w.kind === "card")?.id ??
    walletRows[0]?.id ??
    null;

  return {
    wallets: walletRows.map(({ id, name, kind, color }) => ({ id, name, kind, color })),
    categories: categoryRows.map(({ id, name, kind, icon, color, keywords }) => ({
      id,
      name,
      kind,
      icon,
      color,
      keywords,
    })),
    defaultWalletId,
  };
}

export type EntryContext = Awaited<ReturnType<typeof getEntryContext>>;

const toWallet = alias(wallets, "to_wallet");

export type TransactionFilters = {
  month: string;
  type?: TxnType;
  walletId?: string;
  categoryId?: string;
  q?: string;
};

export async function listTransactions(filters: TransactionFilters) {
  const user = await requireUser();
  const conditions: (SQL | undefined)[] = [
    eq(transactions.userId, user.id),
    gte(transactions.date, monthStart(filters.month)),
    lt(transactions.date, nextMonthStart(filters.month)),
  ];
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.walletId) {
    conditions.push(or(eq(transactions.walletId, filters.walletId), eq(transactions.toWalletId, filters.walletId)));
  }
  if (filters.categoryId === "none") conditions.push(sql`${transactions.categoryId} is null and ${transactions.type} <> 'transfer'`);
  else if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(transactions.memo, q),
        ilike(categories.name, q),
        sql`exists (select 1 from unnest(${transactions.tags}) tag where tag ilike ${q})`,
      ),
    );
  }

  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      memo: transactions.memo,
      tags: transactions.tags,
      walletId: transactions.walletId,
      toWalletId: transactions.toWalletId,
      categoryId: transactions.categoryId,
      walletName: wallets.name,
      walletColor: wallets.color,
      toWalletName: toWallet.name,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(toWallet, eq(toWallet.id, transactions.toWalletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>[number];

async function sumByType(userId: string, from: string, toExclusive: string) {
  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
        Number,
      ),
      expense: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
        Number,
      ),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lt(transactions.date, toExclusive)));
  return row;
}

export async function getDashboard(month: string) {
  const user = await requireUser();
  const today = todayKST();
  const from = monthStart(month);
  const to = nextMonthStart(month);
  const prevMonth = addMonths(month, -1);
  const isCurrentMonth = today >= from && today < to;

  // Compare like with like: on Nov 13, compare against Oct 1–13, not all of October.
  const dayOfMonth = isCurrentMonth ? Number(today.slice(8)) : daysInMonth(month);
  const prevCutoffDay = Math.min(dayOfMonth, daysInMonth(prevMonth));
  const prevTo = addDays(`${prevMonth}-${String(prevCutoffDay).padStart(2, "0")}`, 1);

  const trendFrom = monthStart(addMonths(month, -5));

  const [summary, prevSummary, byCategory, trendRows, dailyRows, walletRows, recent] = await Promise.all([
    sumByType(user.id, from, to),
    sumByType(user.id, monthStart(prevMonth), prevTo),
    db
      .select({
        categoryId: transactions.categoryId,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
        total: sql<number>`sum(${transactions.amount})`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          gte(transactions.date, from),
          lt(transactions.date, to),
        ),
      )
      .groupBy(transactions.categoryId, categories.name, categories.icon, categories.color)
      .orderBy(desc(sql`sum(${transactions.amount})`)),
    db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        income: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
          Number,
        ),
        expense: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
          Number,
        ),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), gte(transactions.date, trendFrom), lt(transactions.date, to)))
      .groupBy(sql`1`),
    db
      .select({
        date: transactions.date,
        expense: sql<number>`sum(${transactions.amount})`.mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          gte(transactions.date, monthStart(prevMonth)),
          lt(transactions.date, to),
        ),
      )
      .groupBy(transactions.date),
    getWallets({ includeArchived: false }),
    listRecent(user.id, 6),
  ]);

  // 6-month trend, oldest first, with empty months filled in
  const trendMap = new Map(trendRows.map((r) => [r.month, r]));
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(month, i - 5);
    const r = trendMap.get(m);
    return { month: m, income: r?.income ?? 0, expense: r?.expense ?? 0 };
  });

  // Cumulative spending by day of month: this month vs last month
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r.expense]));
  const maxDays = Math.max(daysInMonth(month), daysInMonth(prevMonth));
  let thisRunning = 0;
  let prevRunning = 0;
  const cumulative = Array.from({ length: maxDays }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const thisDate = `${month}-${day}`;
    const prevDate = `${prevMonth}-${day}`;
    const inThis = i < daysInMonth(month) && (!isCurrentMonth || thisDate <= today);
    const inPrev = i < daysInMonth(prevMonth);
    if (inThis) thisRunning += dailyMap.get(thisDate) ?? 0;
    if (inPrev) prevRunning += dailyMap.get(prevDate) ?? 0;
    return { day: i + 1, current: inThis ? thisRunning : null, previous: inPrev ? prevRunning : null };
  });

  const netWorth = walletRows.reduce((sum, w) => sum + w.balance, 0);
  const assets = walletRows.filter((w) => w.balance > 0).reduce((s, w) => s + w.balance, 0);
  const debts = walletRows.filter((w) => w.balance < 0).reduce((s, w) => s + w.balance, 0);

  return {
    month,
    isCurrentMonth,
    dayOfMonth,
    summary,
    prevExpense: prevSummary.expense,
    byCategory,
    trend,
    cumulative,
    wallets: walletRows,
    netWorth,
    assets,
    debts,
    recent,
  };
}

async function listRecent(userId: string, limit: number) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      memo: transactions.memo,
      walletName: wallets.name,
      toWalletName: toWallet.name,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(toWallet, eq(toWallet.id, transactions.toWalletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
