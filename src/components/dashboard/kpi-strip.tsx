import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { BigWon } from "@/components/common";
import { addMonths } from "@/lib/dates";
import { josa } from "@/lib/josa";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/server/queries";
import { monthNameKo, previousMonthTotal, spentToDate, totalNetWorth } from "./format";
import { Figure } from "./panel";

const cell = "flex min-h-[136px] min-w-0 flex-col bg-card px-5 py-4";
const label = "flex min-h-5 items-center gap-2 text-xs font-bold text-ink-3";
// A little smaller while four cells share 896–1024px, so a 10-digit net worth still fits its cell.
const value = "mt-2 block text-[26px] leading-[1.15] @4xl:text-[24px] @5xl:text-[26px]";
const note = "mt-auto pt-3 text-[13px] text-pretty break-keep text-ink-2";

/**
 * One hairline panel, four cells divided by hairlines: spending (vs the same days last month),
 * income, net worth and the review queue. Two columns on narrow widths, four from 896px of content.
 */
export function KpiStrip({ data, monthWord }: { data: Dashboard; monthWord: string }) {
  return (
    <section aria-label={`${monthWord} 요약`} className="mt-6 overflow-hidden rounded-xl border border-line">
      <div className="grid gap-px bg-line-soft @md:grid-cols-2 @4xl:grid-cols-4">
        <SpendCell data={data} monthWord={monthWord} />
        <IncomeCell data={data} monthWord={monthWord} />
        <NetWorthCell data={data} />
        <ReviewCell count={data.reviewCount} />
      </div>
    </section>
  );
}

function SpendCell({ data, monthWord }: { data: Dashboard; monthWord: string }) {
  // The big number is the whole month, records entered ahead included; the comparison is like
  // with like: spending to date against the same days of last month (getDashboard's prevExpense),
  // or a past month against all of the one before (prevExpense stops at the shorter month's length).
  const { expense } = data.summary;
  const spent = spentToDate(data);
  const ahead = expense - spent;
  const prev = data.isCurrentMonth ? data.prevExpense : previousMonthTotal(data);
  const base = data.isCurrentMonth ? "지난달 이맘때" : monthNameKo(addMonths(data.month, -1));
  const diff = spent - prev;

  let sentence: React.ReactNode;
  if (prev === 0) {
    sentence = spent === 0 ? (data.isCurrentMonth ? "아직 쓴 돈이 없어요" : "지출 기록이 없어요") : `${base} 기록이 없어요`;
  } else if (diff === 0) {
    sentence = `${josa(base, "과", "와")} 똑같이 썼어요`;
  } else {
    sentence = (
      <>
        {base}보다 <Figure>{formatKRW(Math.abs(diff))}</Figure> {diff < 0 ? "덜" : "더"} 썼어요
      </>
    );
  }

  return (
    <div className={cell}>
      <p className={label}>
        {monthWord} 지출
        {ahead > 0 && (
          <span className="num ml-auto min-w-0 truncate font-semibold">
            예정 {formatKRW(ahead)} 포함
          </span>
        )}
      </p>
      <BigWon value={expense} className={value} />
      <p className={note}>{sentence}</p>
    </div>
  );
}

function IncomeCell({ data, monthWord }: { data: Dashboard; monthWord: string }) {
  const { income, expense } = data.summary;
  const left = income - expense;

  let sentence: React.ReactNode;
  // No income yet usually means payday hasn't come, not overspending.
  if (income === 0)
    sentence = data.isCurrentMonth
      ? expense === 0
        ? "기록이 생기면 남은 돈을 알려 드려요"
        : "아직 들어온 돈이 없어요"
      : "수입 기록이 없어요";
  else if (left >= 0)
    sentence = (
      <>
        쓰고 남은 돈 <Figure>{formatKRW(left)}</Figure>
      </>
    );
  else
    sentence = (
      <>
        번 돈보다 <Figure>{formatKRW(-left)}</Figure> 더 썼어요
      </>
    );

  return (
    <div className={cell}>
      <p className={label}>{monthWord} 수입</p>
      <BigWon value={income} className={cn(value, income > 0 && "text-income")} />
      <p className={note}>{sentence}</p>
    </div>
  );
}

function NetWorthCell({ data }: { data: Dashboard }) {
  // One definition everywhere: every wallet, archived ones included (as on 계좌). netTrend is
  // anchored to today (oldest first) and counts the same wallets on both ends, so the big number
  // is its last point and the change is read from the series itself.
  const netWorth = totalNetWorth(data);
  const hasWallets = data.wallets.length > 0 || netWorth !== 0;
  const first = data.netTrend[0];
  const last = data.netTrend.at(-1);
  const trend = hasWallets && first && last && data.netTrend.length > 1 ? { first, last } : null;
  const since = trend ? `${monthNameKo(trend.first.month)} 말` : "";
  const change = trend ? trend.last.netWorth - trend.first.netWorth : 0;

  return (
    <div className={cell}>
      <p className={label}>
        순자산
        {!data.isCurrentMonth && <span className="font-semibold">· 오늘 기준</span>}
        {trend && (
          <Sparkline
            points={data.netTrend.map((p) => p.netWorth)}
            label={`최근 ${data.netTrend.length}개월 순자산 흐름: ${since} ${formatKRW(trend.first.netWorth)}, 지금 ${formatKRW(trend.last.netWorth)}`}
          />
        )}
      </p>
      <BigWon value={netWorth} className={value} />
      <p className={note}>
        {!trend ? (
          "계좌를 추가하면 순자산을 보여 드려요"
        ) : change === 0 ? (
          `${josa(since, "과", "와")} 같아요`
        ) : (
          <>
            {since}보다 <Figure>{formatKRW(Math.abs(change))}</Figure> {change > 0 ? "늘었어요" : "줄었어요"}
          </>
        )}
      </p>
    </div>
  );
}

/** Tiny ink line of net worth over the last months; the dot is today. */
function Sparkline({ points, label: ariaLabel }: { points: number[]; label: string }) {
  const width = 64;
  const height = 20;
  const pad = 2.5;
  const min = Math.min(...points);
  const span = Math.max(...points) - min;
  const xy = points.map((v, i) => [
    pad + (i * (width - pad * 2)) / (points.length - 1),
    span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const [endX, endY] = xy[xy.length - 1];
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="ml-auto shrink-0 overflow-visible text-ink"
    >
      <polyline
        points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={endX} cy={endY} r="2.5" fill="currentColor" />
    </svg>
  );
}

/** The one lime element on the page: how many records wait in 확인할 것. */
function ReviewCell({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className={cell}>
        <p className={label}>확인할 것</p>
        <p className={cn(value, "flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.03em]")}>
          <CheckCircleIcon aria-hidden weight="fill" className="size-6 shrink-0 text-ink" />다 확인했어요
        </p>
        <p className={note}>볼 게 생기면 여기에 알려 드려요</p>
      </div>
    );
  }

  return (
    <Link
      href="/transactions?view=review"
      aria-label={`확인할 것 ${count}건, 기록함에서 확인하기`}
      className={cn(cell, "group -outline-offset-2 transition-colors duration-150 hover:bg-muted")}
    >
      <span className={label}>
        확인할 것
        <ArrowRightIcon
          aria-hidden
          weight="bold"
          className="ml-auto size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </span>
      <span className={value}>
        <span className="display inline-flex h-9 items-baseline rounded-lg bg-signal px-2.5 text-[26px] leading-9 text-signal-foreground">
          {count.toLocaleString("ko-KR")}
          <span className="ml-0.5 text-[0.5em] font-bold tracking-normal">건</span>
        </span>
      </span>
      <span className={note}>기록함에서 하나씩 확인해 주세요</span>
    </Link>
  );
}
