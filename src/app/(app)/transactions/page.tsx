import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { parseInboxView } from "@/components/app/nav";
import { Inbox, type WalletBalance } from "@/components/inbox/inbox";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import type { InboxQuery, MonthStats } from "@/components/inbox/model";
import { isValidMonth, monthOf, todayKST } from "@/lib/dates";
import {
  getCategoryUsual,
  getEntryContext,
  getReviewCount,
  getWallets,
  listTransactions,
  type TransactionRow,
} from "@/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const metadata: Metadata = { title: "기록" };

/** 기록함: list · detail · side panes. The URL holds the view, month, filters and the selected id. */
export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <TransactionsInbox searchParams={searchParams} />
    </Suspense>
  );
}

async function TransactionsInbox({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  await connection(); // "this month" and "today" depend on the clock
  const sp = await searchParams;
  const today = todayKST();
  const currentMonth = monthOf(today);

  const view = parseInboxView(one(sp.view));
  const monthParam = one(sp.month);
  const month = isValidMonth(monthParam) ? monthParam : currentMonth;
  // 지출/수입 and the category don't apply to transfers, so the transfer view ignores them.
  const typeParam = one(sp.type);
  const type = view !== "transfer" && (typeParam === "income" || typeParam === "expense") ? typeParam : undefined;
  const walletParam = one(sp.wallet);
  const wallet = walletParam && UUID.test(walletParam) ? walletParam : undefined;
  const categoryParam = one(sp.category);
  const category =
    view !== "transfer" && categoryParam && (categoryParam === "none" || UUID.test(categoryParam)) ? categoryParam : undefined;
  const q = one(sp.q)?.trim().slice(0, 100) || undefined;
  const idParam = one(sp.id);
  const requestedId = idParam && UUID.test(idParam) ? idParam : null;

  const query: InboxQuery = { view, month, type, wallet, category, q };
  const unfiltered = !type && !wallet && !category && !q;
  const listed = listTransactions({ month, view, type, walletId: wallet, categoryId: category, q });

  // Side stats (같은 메모, the category card) need each relevant month unfiltered. The plain 전체 view
  // already is that list; the review view needs every month its pending records fall in. Selection
  // after load is client-only (replaceState), so a month left out here could never be filled in;
  // pending lists are short, so load them all.
  const statsFor = async (m: string): Promise<[string, MonthStats]> => {
    const [monthRows, usual] = await Promise.all([
      view === "all" && unfiltered && m === month ? listed : listTransactions({ month: m }),
      getCategoryUsual(m),
    ]);
    return [m, { rows: monthRows.map(toStatRow), usual }];
  };
  const statEntries =
    view === "review"
      ? listed.then((rows) => Promise.all([...new Set(rows.map((r) => monthOf(r.date)))].map(statsFor)))
      : Promise.all([statsFor(month)]);

  const [rows, stats, ctx, reviewCount, walletRows] = await Promise.all([
    listed,
    statEntries,
    getEntryContext(),
    getReviewCount(),
    getWallets(),
  ]);

  const wallets: WalletBalance[] = walletRows.map(({ id, name, kind, color, balance, archived }) => ({
    id,
    name,
    kind,
    color,
    balance,
    archived,
  }));

  return (
    <Inbox
      query={query}
      requestedId={requestedId}
      rows={rows}
      stats={Object.fromEntries(stats)}
      ctx={ctx}
      reviewCount={reviewCount}
      wallets={wallets}
      today={today}
    />
  );
}

function toStatRow({ id, type, amount, date, memo, categoryId }: TransactionRow) {
  return { id, type, amount, date, memo, categoryId };
}
