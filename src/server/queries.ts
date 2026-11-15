import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, transactions, wallets, type TxnType, type WalletKind } from "@/db/schema";
import { addDays, addMonths, daysInMonth, monthOf, monthStart, nextMonthStart, todayKST } from "@/lib/dates";
import type { ReviewReason } from "@/lib/review";
import { isAiConfigured } from "./ai-config";
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

/**
 * Data the quick-entry box, transaction form and inbox pickers need on the client.
 * Cached per request: the page, the inbox and EntryLayer share one query.
 */
export const getEntryContext = cache(async () => {
  const user = await requireUser();
  const [walletRows, categoryRows, mostUsed] = await Promise.all([
    getWallets({ includeArchived: false }),
    getCategories(),
    // Archived wallets are skipped here, before limit(1), so a retired card doesn't hide the
    // runner-up. Ties go to the wallet used last, then the id, so the default is stable.
    db
      .select({ walletId: transactions.walletId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .innerJoin(
        wallets,
        and(eq(wallets.id, transactions.walletId), eq(wallets.userId, user.id), eq(wallets.archived, false)),
      )
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          gte(transactions.date, addDays(todayKST(), -60)),
        ),
      )
      .groupBy(transactions.walletId)
      .orderBy(desc(sql`count(*)`), desc(sql`max(${transactions.date})`), asc(transactions.walletId))
      .limit(1),
  ]);
  const activeIds = new Set(walletRows.map((w) => w.id));
  const defaultWalletId =
    (mostUsed[0] && activeIds.has(mostUsed[0].walletId) ? mostUsed[0].walletId : null) ??
    walletRows.find((w) => w.kind === "card")?.id ??
    walletRows[0]?.id ??
    null;

  return {
    aiEnabled: isAiConfigured(),
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
});

export type EntryContext = Awaited<ReturnType<typeof getEntryContext>>;

const toWallet = alias(wallets, "to_wallet");

/** Pending = flagged for review and not confirmed yet. */
const isPending = and(isNotNull(transactions.reviewReason), isNull(transactions.reviewedAt));

/** One record with its wallet and category, as every transaction list returns it. */
export type TransactionRow = {
  id: string;
  type: TxnType;
  amount: number;
  date: string;
  memo: string;
  tags: string[];
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  walletName: string;
  walletColor: string;
  toWalletName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  /** ISO timestamp */
  createdAt: string;
  reviewReason: ReviewReason | null;
  /** ISO timestamp */
  reviewedAt: string | null;
  pending: boolean;
  /** The original quick-entry line, or "" */
  sourceText: string;
};

/**
 * The select and joins every transaction list shares. Timestamps become ISO strings for the client.
 * Orders end on the id: rows saved in one insert share createdAt, and Postgres breaks ties
 * arbitrarily, so without it a list could reshuffle after an unrelated edit.
 */
async function selectTransactionRows(
  where: SQL | undefined,
  {
    orderBy = [desc(transactions.date), desc(transactions.createdAt), desc(transactions.id)],
    limit,
  }: { orderBy?: SQL[]; limit?: number } = {},
): Promise<TransactionRow[]> {
  const query = db
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
      createdAt: transactions.createdAt,
      reviewReason: transactions.reviewReason,
      reviewedAt: transactions.reviewedAt,
      sourceText: transactions.sourceText,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(toWallet, eq(toWallet.id, transactions.toWalletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(where)
    .orderBy(...orderBy)
    .$dynamic();
  const rows = await (limit === undefined ? query : query.limit(limit));
  return rows.map(({ createdAt, reviewedAt, ...row }) => ({
    ...row,
    createdAt: createdAt.toISOString(),
    reviewedAt: reviewedAt?.toISOString() ?? null,
    pending: row.reviewReason !== null && reviewedAt === null,
  }));
}

export type TransactionView = "all" | "review" | "transfer";

export type TransactionFilters = {
  /** YYYY-MM. The review view ignores it and spans every month. */
  month: string;
  /** all (default) · review: every pending record, newest first · transfer: the month's transfers */
  view?: TransactionView;
  type?: TxnType;
  walletId?: string;
  categoryId?: string;
  q?: string;
};

export async function listTransactions(filters: TransactionFilters): Promise<TransactionRow[]> {
  const user = await requireUser();
  const conditions: (SQL | undefined)[] = [eq(transactions.userId, user.id)];
  if (filters.view === "review") {
    conditions.push(isPending);
  } else {
    conditions.push(gte(transactions.date, monthStart(filters.month)), lt(transactions.date, nextMonthStart(filters.month)));
  }
  if (filters.view === "transfer") conditions.push(eq(transactions.type, "transfer"));
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
  return selectTransactionRows(and(...conditions));
}

async function countPending(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isPending));
  return row.n;
}

/** Number of records waiting in 확인할 것. Cached per request: the rail badge and the page share it. */
export const getReviewCount = cache(async (): Promise<number> => {
  const user = await requireUser();
  return countPending(user.id);
});

/**
 * What each category usually comes to in a month: the average over the 3 full months before
 * `month`, counting only months that have any records (a new user isn't averaged against empty
 * months). Keyed by category id, rounded to the won. Works for income categories too.
 */
export async function getCategoryUsual(month: string): Promise<Record<string, number>> {
  const user = await requireUser();
  const inRange = and(
    eq(transactions.userId, user.id),
    gte(transactions.date, monthStart(addMonths(month, -3))),
    lt(transactions.date, monthStart(month)),
  );
  const [totals, [{ months }]] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`sum(${transactions.amount})`.mapWith(Number),
      })
      .from(transactions)
      .where(and(inRange, isNotNull(transactions.categoryId)))
      .groupBy(transactions.categoryId),
    db
      .select({ months: sql<number>`count(distinct date_trunc('month', ${transactions.date}))`.mapWith(Number) })
      .from(transactions)
      .where(inRange),
  ]);
  const usual: Record<string, number> = {};
  if (months === 0) return usual;
  for (const { categoryId, total } of totals) {
    if (categoryId) usual[categoryId] = Math.round(total / months);
  }
  return usual;
}

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

  const [summary, prevSummary, byCategory, trendRows, dailyRows, walletRows, recent, netTrend, topExpenses, reviewCount] = await Promise.all([
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
    selectTransactionRows(eq(transactions.userId, user.id), { limit: 6 }),
    getNetWorthTrend(6),
    selectTransactionRows(
      and(
        eq(transactions.userId, user.id),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lt(transactions.date, to),
      ),
      { orderBy: [desc(transactions.amount), desc(transactions.date), desc(transactions.id)], limit: 5 },
    ),
    countPending(user.id),
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

  // One cell per day of the month for the spending calendar
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, expense: dailyMap.get(date) ?? 0, future: date > today };
  });

  // Active wallets only. Net worth over every wallet, archived included, is netTrend's last point.
  const activeNetWorth = walletRows.reduce((sum, w) => sum + w.balance, 0);
  const activeAssets = walletRows.filter((w) => w.balance > 0).reduce((s, w) => s + w.balance, 0);
  const activeDebts = walletRows.filter((w) => w.balance < 0).reduce((s, w) => s + w.balance, 0);

  return {
    month,
    isCurrentMonth,
    dayOfMonth,
    summary,
    prevExpense: prevSummary.expense,
    byCategory,
    trend,
    cumulative,
    days,
    netTrend,
    topExpenses,
    wallets: walletRows,
    activeNetWorth,
    activeAssets,
    activeDebts,
    recent,
    reviewCount,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/**
 * Net worth at the end of each of the last `months` months (the current month is "today").
 * Walks back from today's balances: transfers net to zero, so only income − expense moves it.
 * The last point is the wallet total, matching 계좌, so it includes records entered ahead.
 */
export async function getNetWorthTrend(months = 6) {
  const user = await requireUser();
  const current = monthOf(todayKST());
  const [walletRows, flows] = await Promise.all([
    getWallets(),
    db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        net: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} when ${transactions.type} = 'expense' then -${transactions.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), gte(transactions.date, monthStart(addMonths(current, -(months - 1))))))
      .groupBy(sql`1`),
  ]);
  const flowByMonth = new Map(flows.map((f) => [f.month, f.net]));
  // Balances count records dated after this month too. Keep them in the current point (it
  // matches 계좌) and take them out on the first step back, so earlier points are true month-ends.
  const ahead = flows.filter((f) => f.month > current).reduce((sum, f) => sum + f.net, 0);
  let value = walletRows.reduce((sum, w) => sum + w.balance, 0);
  const points: { month: string; netWorth: number }[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(current, -i);
    points.unshift({ month: m, netWorth: value });
    value -= (flowByMonth.get(m) ?? 0) + (i === 0 ? ahead : 0);
  }
  return points;
}
