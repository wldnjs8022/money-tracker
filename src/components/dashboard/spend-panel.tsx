import { ChartLineIcon } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/common";
import { daysInMonth } from "@/lib/dates";
import { josa } from "@/lib/josa";
import { formatKRW } from "@/lib/money";
import type { Dashboard } from "@/server/queries";
import { CumulativeSpendChart } from "./charts";
import { previousMonthTotal, spentToDate } from "./format";
import { Figure, LineKey, Panel } from "./panel";

/** Round a projection to the thousand won: it's an estimate, not a figure to the won. */
const roughly = (value: number) => Math.round(value / 1000) * 1000;

/**
 * Cumulative spending this month against last month, with one sentence on where it's heading.
 * The line and the sentence use spending dated up to today; records entered ahead for later days
 * only set a floor under the projection.
 */
export function SpendPanel({ data, monthName, prevName }: { data: Dashboard; monthName: string; prevName: string }) {
  const days = daysInMonth(data.month);
  const { expense } = data.summary;
  const spent = spentToDate(data);
  const ahead = expense - spent;
  const prevTotal = previousMonthTotal(data);
  const markerDay = data.isCurrentMonth ? data.dayOfMonth : days;
  const markerValue = data.cumulative[markerDay - 1]?.current ?? null;
  const prevTopic = josa(prevName, "은", "는");
  const nothing = expense === 0 && prevTotal === 0;

  let description: React.ReactNode;
  if (data.isCurrentMonth) {
    if (spent === 0) description = "이번 달은 아직 쓴 돈이 없어요";
    else if (data.dayOfMonth === days)
      description = (
        <>
          이번 달 <Figure>{formatKRW(spent)}</Figure> 썼어요
        </>
      );
    else if (prevTotal > 0 && data.prevExpense > 0)
      // Follow last month's curve for the days left: rent and bills paid early in the month count
      // once, where a straight line from today would repeat them for every remaining day.
      description = (
        <>
          남은 날을 지난달처럼 쓰면 이번 달은 약{" "}
          <Figure>{formatKRW(roughly(Math.max(expense, spent + prevTotal - data.prevExpense)))}</Figure>이 돼요
        </>
      );
    else if (data.dayOfMonth >= 5)
      // No last month to follow: a straight line, and only from the 5th, when a pace starts to mean something.
      description = (
        <>
          이 속도면 이번 달 약 <Figure>{formatKRW(roughly(Math.max(expense, (spent / data.dayOfMonth) * days)))}</Figure> 쓰게 돼요
        </>
      );
    else if (prevTotal > 0)
      description = (
        <>
          {prevTopic} 한 달 동안 <Figure>{formatKRW(prevTotal)}</Figure> 썼어요
        </>
      );
    else description = "쓰는 대로 이번 달 흐름을 그려요";
  } else {
    description =
      expense === 0 ? (
        `${monthName}엔 지출 기록이 없어요`
      ) : (
        <>
          하루 평균 <Figure>{formatKRW(expense / days)}</Figure> 썼어요
        </>
      );
  }

  const ariaLabel = data.isCurrentMonth
    ? `${monthName} 누적 지출 그래프. 오늘(${data.dayOfMonth}일)까지 ${formatKRW(spent)}. ${prevTopic} 같은 기간 ${formatKRW(data.prevExpense)}, 한 달 동안 ${formatKRW(prevTotal)}.${ahead > 0 ? ` 앞으로 예정된 지출 ${josa(formatKRW(ahead), "은", "는")} 빼고 그렸어요.` : ""}`
    : `${monthName} 누적 지출 그래프. 한 달 동안 ${formatKRW(expense)}. ${prevTopic} ${formatKRW(prevTotal)}.`;

  const legend = (
    <>
      <span className="flex items-center gap-1.5 text-ink-2">
        <LineKey className="text-ink" />
        {monthName}
      </span>
      <span className="flex items-center gap-1.5 text-ink-2">
        <LineKey dashed className="text-ink-3" />
        {prevName}
      </span>
    </>
  );

  return (
    <Panel
      id="home-spend"
      title="누적 지출"
      description={nothing ? undefined : description}
      meta={nothing ? undefined : legend}
    >
      {nothing ? (
        <EmptyState
          icon={<ChartLineIcon />}
          title="그릴 지출이 없어요"
          description="지출을 적으면 지난달과 나란히 쌓아 보여 드려요"
          className="flex-1 py-10"
        />
      ) : (
        // The chart grows with the row (the category list beside it sets the height) but never below 232px.
        <div className="flex min-h-[232px] flex-1 flex-col px-3 pb-3">
          <CumulativeSpendChart
            data={data.cumulative}
            marker={markerValue === null ? null : { day: markerDay, value: markerValue }}
            markerLabel={data.isCurrentMonth ? "오늘" : undefined}
            currentLabel={monthName}
            previousLabel={prevName}
            ariaLabel={ariaLabel}
            className="h-auto min-h-[232px] flex-1"
          />
        </div>
      )}
    </Panel>
  );
}
