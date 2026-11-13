import { connection } from "next/server";
import { Suspense } from "react";
import { Kbd, PageHeader } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { FiltersBar } from "@/components/transactions/filters-bar";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMonthKST, isValidMonth } from "@/lib/dates";
import { formatKRW, formatSignedKRW } from "@/lib/money";
import { getEntryContext, listTransactions } from "@/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TransactionsContent({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  await connection(); // "this month" depends on the clock, so render at request time
  const sp = await searchParams;
  const monthParam = one(sp.month);
  const month = isValidMonth(monthParam) ? monthParam : currentMonthKST();
  const typeParam = one(sp.type);
  const type = typeParam === "income" || typeParam === "expense" || typeParam === "transfer" ? typeParam : undefined;
  const wallet = UUID.test(one(sp.wallet) ?? "") ? one(sp.wallet) : undefined;
  const categoryParam = one(sp.category);
  const category = categoryParam === "none" || UUID.test(categoryParam ?? "") ? categoryParam : undefined;
  const q = one(sp.q)?.slice(0, 100) || undefined;

  const [rows, ctx] = await Promise.all([
    listTransactions({ month, type, walletId: wallet, categoryId: category, q }),
    getEntryContext(),
  ]);

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="거래 내역">
        <MonthNav
          month={month}
          basePath="/transactions"
          params={{ type, wallet, category, q }}
        />
        <NewTransactionButton />
      </PageHeader>

      <FiltersBar values={{ month: monthParam === month ? month : undefined, type, wallet, category, q }} ctx={ctx} />

      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">{rows.length}건</span>
        <span>
          수입 <span className="num font-semibold text-income">{formatKRW(income)}</span>
        </span>
        <span>
          지출 <span className="num font-semibold">{formatKRW(expense)}</span>
        </span>
        <span>
          합계 <span className="num font-semibold">{formatSignedKRW(income - expense)}</span>
        </span>
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> 이동 · <Kbd>Enter</Kbd> 수정 · <Kbd>⌫</Kbd> 삭제
        </span>
      </div>

      <TransactionsTable rows={rows} />
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
