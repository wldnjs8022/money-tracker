import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/common";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { countNoSpendDays, longDateKo, monthNameKo } from "@/components/dashboard/format";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { Panel } from "@/components/dashboard/panel";
import { RecentRecords } from "@/components/dashboard/recent-records";
import { SpendPanel } from "@/components/dashboard/spend-panel";
import { SpendingCalendar } from "@/components/dashboard/spending-calendar";
import { WalletBalances } from "@/components/dashboard/wallet-balances";
import { Welcome } from "@/components/dashboard/welcome";
import { MonthNav } from "@/components/month-nav";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, isValidMonth, monthOf, todayKST } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "홈" };

/*
 * 홈: a calm overview of one month inside the window's default scrolling column.
 * Header (month + greeting) → KPI strip → cumulative spend | categories → recent | calendar | wallets.
 * The root is a size container, so the grids follow the column's width rather than the viewport's
 * (the window inset and the icon rail eat into it).
 */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection(); // "this month", today's ring and the greeting depend on the clock
  const today = todayKST();
  const current = monthOf(today);
  const sp = await searchParams;
  // A hand-typed future month falls back to this one; MonthNav never links past it either.
  const month = isValidMonth(sp.month) && sp.month <= current ? sp.month : current;
  const [data, user] = await Promise.all([getDashboard(month), requireUser()]);

  const monthName = monthNameKo(month, today.slice(0, 4));
  const prevName = monthNameKo(addMonths(month, -1));

  return (
    <div className="@container">
      <PageHeader title={monthName} description={greeting(user.name, today)}>
        <MonthNav month={month} basePath="/" current={current} />
      </PageHeader>

      {data.recent.length === 0 && <Welcome />}

      <KpiStrip data={data} monthWord={data.isCurrentMonth ? "이번 달" : monthName} />

      <div className="mt-4 grid gap-4 @3xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SpendPanel data={data} monthName={monthName} prevName={prevName} />
        <CategoryBreakdown data={data} />
      </div>

      <div className="mt-4 grid gap-4 @3xl:grid-cols-2 @5xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <RecentRecords rows={data.recent} today={today} className="@3xl:col-span-2 @5xl:col-span-1" />
        <Panel
          id="home-calendar"
          title="지출 달력"
          meta={
            <Badge variant="page" size="lg" className="num">
              무지출 {countNoSpendDays(data.days)}일
            </Badge>
          }
        >
          {/* Keyed by month so the keyboard focus starts on today (or the 1st) again after switching months. */}
          <SpendingCalendar key={month} days={data.days} today={today} monthName={monthName} />
        </Panel>
        <WalletBalances data={data} />
      </div>
    </div>
  );
}

/** "데모님, 좋은 아침이에요. 오늘은 11월 15일 토요일이에요." (hour in Korea time) */
function greeting(name: string, today: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  const hello =
    hour < 5 || hour >= 23
      ? "늦은 시간이네요"
      : hour < 11
        ? "좋은 아침이에요"
        : hour < 18
          ? "안녕하세요"
          : "오늘 하루 수고했어요";
  const who = name.trim() ? `${name.trim()}님, ` : "";
  return `${who}${hello}. 오늘은 ${longDateKo(today)}이에요.`;
}

/** Same frame as the page so nothing jumps when the data streams in. */
function HomeSkeleton() {
  return (
    <div className="@container" aria-busy="true" aria-label="홈 불러오는 중">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line-soft @md:grid-cols-2 @4xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex min-h-[136px] flex-col bg-card px-5 py-4">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-auto h-3.5 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 @3xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <PanelSkeleton className="h-[340px]" />
        <PanelSkeleton className="h-[340px]" />
      </div>
      <div className="mt-4 grid gap-4 @3xl:grid-cols-2 @5xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <PanelSkeleton className="h-[420px] @3xl:col-span-2 @5xl:col-span-1" />
        <PanelSkeleton className="h-[420px]" />
        <PanelSkeleton className="h-[420px]" />
      </div>
    </div>
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line p-5", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-3.5 w-48" />
    </div>
  );
}
