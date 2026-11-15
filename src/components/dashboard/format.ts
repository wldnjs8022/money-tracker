// Small pure helpers shared by the home page's server and client pieces.
import { weekdayKo } from "@/lib/dates";
import type { Dashboard } from "@/server/queries";

/** "2026-11-15" → "11월 15일 토요일" */
export function longDateKo(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 ${weekdayKo(date)}요일`;
}

/** "2026-11" → "11월" ("2025년 11월" when it isn't the given current year). */
export function monthNameKo(month: string, currentYear?: string): string {
  const [y, m] = month.split("-");
  const name = `${Number(m)}월`;
  return currentYear && y !== currentYear ? `${y}년 ${name}` : name;
}

/**
 * Square-root scale on [0, 1]: one huge value (rent) doesn't flatten every other bar or cell.
 * Returns 0 for non-positive values.
 */
export function sqrtShare(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(1, Math.sqrt(value / max));
}

export type CalendarDay = { date: string; expense: number; future: boolean };

/** Days of the month so far with no spending at all. */
export function countNoSpendDays(days: CalendarDay[]): number {
  return days.filter((d) => !d.future && d.expense === 0).length;
}

/**
 * The month's spending dated up to today (all of it for a past month). summary.expense also counts
 * records entered ahead for later days, so comparisons and the pace read this instead.
 */
export function spentToDate(data: Pick<Dashboard, "cumulative" | "dayOfMonth">): number {
  return data.cumulative[data.dayOfMonth - 1]?.current ?? 0;
}

/** All of last month's spending: the end of its cumulative line (prevExpense may stop short of it). */
export function previousMonthTotal(data: Pick<Dashboard, "cumulative">): number {
  return data.cumulative.findLast((p) => p.previous !== null)?.previous ?? 0;
}

/**
 * Net worth over every wallet, archived ones included, as 계좌 and the trend count it.
 * data.activeNetWorth covers the active wallets only; the trend's last point is today.
 */
export function totalNetWorth(data: Pick<Dashboard, "netTrend" | "activeNetWorth">): number {
  return data.netTrend.at(-1)?.netWorth ?? data.activeNetWorth;
}
