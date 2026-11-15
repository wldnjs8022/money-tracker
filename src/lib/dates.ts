// All dates in the app are plain "YYYY-MM-DD" strings in Korea time.
// Never use Date#toISOString() for "today": before 9am KST it returns yesterday.

const KST = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const kstDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayKST(now: Date = new Date()): string {
  return kstDateFormat.format(now);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonthKST(): string {
  return monthOf(todayKST());
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseYM(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y, m];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = parseYM(month);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

/** Exclusive upper bound: first day of the following month. */
export function nextMonthStart(month: string): string {
  return `${addMonths(month, 1)}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = parseYM(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function weekdayKo(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function formatMonthKo(month: string): string {
  const [y, m] = parseYM(month);
  return `${y}년 ${m}월`;
}

export function formatDateKo(date: string, today: string = todayKST()): string {
  if (date === today) return "오늘";
  if (date === addDays(today, -1)) return "어제";
  const [y, m, d] = date.split("-").map(Number);
  const prefix = date.slice(0, 4) === today.slice(0, 4) ? "" : `${y}년 `;
  return `${prefix}${m}월 ${d}일 (${weekdayKo(date)})`;
}

export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}
