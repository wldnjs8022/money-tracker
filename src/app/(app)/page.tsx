import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Amount, CategoryIcon, Kbd, PageHeader, WALLET_KIND_LABEL } from "@/components/common";
import { CumulativeChart, TrendChart } from "@/components/dashboard/charts";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMonthKST, formatDateKo, formatMonthKo, isValidMonth } from "@/lib/dates";
import { formatKRW, formatSignedKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getDashboard, type Dashboard } from "@/server/queries";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection(); // "this month" depends on the clock, so render at request time
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonthKST();
  const data = await getDashboard(month);
  const empty = data.summary.income === 0 && data.summary.expense === 0 && data.recent.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="대시보드">
        <MonthNav month={month} basePath="/" />
        <NewTransactionButton />
      </PageHeader>

      {empty && <Welcome />}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SpendingCard data={data} />
        <StatCard label={`${monthLabel(data)} 수입`} value={formatKRW(data.summary.income)} valueClass="text-income" />
        <StatCard
          label={`${monthLabel(data)} 수지`}
          value={formatSignedKRW(data.summary.income - data.summary.expense)}
          hint={
            data.summary.income > 0
              ? `수입의 ${Math.max(0, Math.round(((data.summary.income - data.summary.expense) / data.summary.income) * 100))}% 남김`
              : "수입 − 지출"
          }
        />
        <StatCard
          label="순자산"
          value={formatKRW(data.netWorth)}
          hint={`자산 ${formatKRW(data.assets)} · 부채 ${formatKRW(Math.abs(data.debts))}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-baseline justify-between">
            <CardTitle>누적 지출</CardTitle>
            <span className="text-xs text-muted-foreground">점선은 지난달</span>
          </CardHeader>
          <CardContent>
            <CumulativeChart data={data.cumulative} />
          </CardContent>
        </Card>
        <CategoryCard data={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>최근 6개월</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>
        <RecentCard data={data} />
        <WalletsCard data={data} />
      </div>
    </div>
  );
}

function monthLabel(data: Dashboard) {
  return data.isCurrentMonth ? "이번 달" : formatMonthKo(data.month);
}

function StatCard({
  label,
  value,
  hint,
  valueClass,
  children,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-1 py-5">
      <CardContent className="space-y-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("num text-2xl font-bold tracking-tight", valueClass)}>{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

function SpendingCard({ data }: { data: Dashboard }) {
  const { expense } = data.summary;
  const prev = data.prevExpense;
  const diff = expense - prev;
  const pct = prev > 0 ? Math.round((Math.abs(diff) / prev) * 100) : null;
  const period = data.isCurrentMonth ? `지난달 ${data.dayOfMonth}일까지보다` : "지난달보다";

  return (
    <StatCard
      label={`${monthLabel(data)} 지출`}
      value={formatKRW(expense)}
      hint={
        prev === 0 ? (
          "지난달 기록 없음"
        ) : (
          <span className={cn("inline-flex items-center gap-0.5", diff <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-expense")}>
            {diff <= 0 ? <ArrowDownRightIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
            {period} {formatKRW(Math.abs(diff))} {diff <= 0 ? "덜" : "더"} 씀{pct !== null ? ` (${pct}%)` : ""}
          </span>
        )
      }
    />
  );
}

function CategoryCard({ data }: { data: Dashboard }) {
  const total = data.summary.expense;
  const max = data.byCategory[0]?.total ?? 0;
  const monthParam = data.isCurrentMonth ? "" : `month=${data.month}&`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>어디에 썼나</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.byCategory.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">지출 기록이 없어요</p>}
        {data.byCategory.slice(0, 7).map((c) => (
          <Link
            key={c.categoryId ?? "none"}
            href={`/transactions?${monthParam}category=${c.categoryId ?? "none"}`}
            className="group block space-y-1.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center">{c.icon ?? "❔"}</span>
              <span className="flex-1 truncate group-hover:underline">{c.name ?? "미분류"}</span>
              <span className="text-xs text-muted-foreground">{total ? Math.round((c.total / total) * 100) : 0}%</span>
              <span className="num shrink-0 text-right font-medium">{formatKRW(c.total)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${max ? (c.total / max) * 100 : 0}%`, backgroundColor: c.color ?? "var(--muted-foreground)" }}
              />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentCard({ data }: { data: Dashboard }) {
  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>최근 기록</CardTitle>
        <Link href="/transactions" className="text-xs text-muted-foreground hover:text-foreground">
          전체 보기 ›
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.recent.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">아직 기록이 없어요</p>}
        {data.recent.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-1.5">
            <CategoryIcon icon={t.type === "transfer" ? "↔" : (t.categoryIcon ?? "❔")} className="size-7 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {t.memo || (t.type === "transfer" ? `${t.walletName} → ${t.toWalletName}` : (t.categoryName ?? "미분류"))}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateKo(t.date)}</p>
            </div>
            <Amount value={t.amount} type={t.type} className="text-sm" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WalletsCard({ data }: { data: Dashboard }) {
  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>계좌</CardTitle>
        <Link href="/wallets" className="text-xs text-muted-foreground hover:text-foreground">
          관리 ›
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.wallets.map((w) => (
          <div key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
            <span className="flex-1 truncate">{w.name}</span>
            <span className="text-xs text-muted-foreground">{WALLET_KIND_LABEL[w.kind]}</span>
            <span className={cn("num shrink-0 text-right font-medium", w.balance < 0 && "text-expense")}>
              {formatKRW(w.balance)}
            </span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t pt-3 text-sm font-semibold">
          <span>순자산</span>
          <span className="num">{formatKRW(data.netWorth)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Welcome() {
  return (
    <Card className="border-dashed bg-brand/5">
      <CardContent className="flex items-center gap-4 py-2">
        <span className="text-3xl">👋</span>
        <div className="space-y-1">
          <p className="font-semibold">첫 기록을 남겨 보세요</p>
          <p className="text-sm text-muted-foreground">
            <Kbd>N</Kbd> 을 누르고 &ldquo;점심 김밥 4500&rdquo;처럼 한 줄로 쓰면 돼요. 계좌 잔액은{" "}
            <Link href="/wallets" className="underline">
              계좌
            </Link>
            에서 맞춰 두세요.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 xl:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
