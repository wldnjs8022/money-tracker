// Pure helpers for the 기록함 (inbox): URL building, day grouping, selection moves, optimistic
// row updates and the side-pane insights. No React here, so all of it is unit-tested.
import type { InboxView } from "@/components/app/nav";
// Relative imports: vitest runs this file without the "@/" alias (type-only imports are erased).
import { addDays, daysInMonth, monthOf, weekdayKo } from "../../lib/dates";
import { quoted, withRo } from "../../lib/josa";
import { formatKRW } from "../../lib/money";
import { placeKey } from "../../lib/review";
import type { EntryContext, TransactionRow } from "@/server/queries";

export type TypeFilter = "income" | "expense";

/** Everything the inbox reads from the URL (except the selected id). */
export type InboxQuery = {
  view: InboxView;
  /** YYYY-MM. The review view spans every month and ignores it. */
  month: string;
  type?: TypeFilter;
  wallet?: string;
  /** A category id, or "none" for uncategorized records. */
  category?: string;
  q?: string;
};

/** Link to the inbox with some of the query changed. Defaults (전체, this month) stay out of the URL. */
export function inboxHref(query: InboxQuery, currentMonth: string, patch: Partial<InboxQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.view !== "all") params.set("view", next.view);
  if (next.month !== currentMonth) params.set("month", next.month);
  if (next.type) params.set("type", next.type);
  if (next.wallet) params.set("wallet", next.wallet);
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

/** Identity of the list being shown: when it changes, a missing selection falls back to the top. */
export function listKeyOf(query: InboxQuery): string {
  const month = query.view === "review" ? "" : query.month;
  return [query.view, month, query.type, query.wallet, query.category, query.q].map((v) => v ?? "").join("|");
}

/** Whether a search or a filter narrows the list (an empty list then says so, not "nothing here"). */
export function isFiltered(query: InboxQuery): boolean {
  return Boolean(query.type || query.wallet || query.category || query.q);
}

// ───────────────────────── Dates ─────────────────────────

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** "11월 13일 금요일", with the year in front when it isn't this year. */
export function fullDateLabel(date: string, today: string): string {
  const { y, m, d } = parts(date);
  const year = date.slice(0, 4) === today.slice(0, 4) ? "" : `${y}년 `;
  return `${year}${m}월 ${d}일 ${weekdayKo(date)}요일`;
}

/** Day-group header: "오늘 · 11월 15일", "어제 · 11월 14일", "11월 13일 금요일". */
export function dayLabel(date: string, today: string): string {
  const { m, d } = parts(date);
  if (date === today) return `오늘 · ${m}월 ${d}일`;
  if (date === addDays(today, -1)) return `어제 · ${m}월 ${d}일`;
  return fullDateLabel(date, today);
}

/** "이번 달" for the current month, else "10월" (or "2025년 10월" in another year). */
export function monthLabel(month: string, today: string): string {
  if (month === monthOf(today)) return "이번 달";
  const [y, m] = month.split("-").map(Number);
  return month.slice(0, 4) === today.slice(0, 4) ? `${m}월` : `${y}년 ${m}월`;
}

/** "11월" for a YYYY-MM month (the category card title). */
export function shortMonth(month: string): string {
  return `${Number(month.slice(5, 7))}월`;
}

// ───────────────────────── List ─────────────────────────

export type DayGroup = { date: string; rows: TransactionRow[]; expense: number; income: number };

/** Groups rows (already newest first) by date, keeping the order. */
export function groupByDay(rows: TransactionRow[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const row of rows) {
    let group = groups.get(row.date);
    if (!group) {
      group = { date: row.date, rows: [], expense: 0, income: 0 };
      groups.set(row.date, group);
    }
    group.rows.push(row);
    if (row.type === "expense") group.expense += row.amount;
    if (row.type === "income") group.income += row.amount;
  }
  return [...groups.values()];
}

/** The row's title in lists: its memo, else what it is. */
export function rowTitle(row: Pick<TransactionRow, "memo" | "type" | "categoryName">): string {
  if (row.memo) return row.memo;
  if (row.type === "transfer") return "이체";
  return row.categoryName ?? "분류 없음";
}

/** "식비 · 신용카드", "이체 · 주거래 통장 → 신용카드". */
export function rowSubtitle(row: TransactionRow): string {
  if (row.type === "transfer") return `이체 · ${row.walletName} → ${row.toWalletName ?? "?"}`;
  return `${row.categoryName ?? "분류 없음"} · ${row.walletName}`;
}

/** Who gets selected after a row leaves the list: the one below it, else the one above. */
export function neighborAfterRemoval(rows: TransactionRow[], id: string): string | null {
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return null;
  return rows[index + 1]?.id ?? rows[index - 1]?.id ?? null;
}

/**
 * Who takes over when the selected record left the list without leave() (saved out of the filter or
 * search, moved or deleted in 전체 편집): the nearest record below it in the list it was last seen in
 * (`before`, ids in order) that is still in `after`, else the nearest above. Null when it wasn't in
 * `before` or none of those records are left.
 */
export function survivingNeighbor(before: string[], id: string, after: string[]): string | null {
  const index = before.indexOf(id);
  if (index < 0) return null;
  const left = new Set(after);
  for (let i = index + 1; i < before.length; i++) if (left.has(before[i])) return before[i];
  for (let i = index - 1; i >= 0; i--) if (left.has(before[i])) return before[i];
  return null;
}

/** The closest other pending row: first looking down the list, then up. */
export function nextPendingId(rows: TransactionRow[], id: string): string | null {
  const index = rows.findIndex((r) => r.id === id);
  for (let i = index + 1; i < rows.length; i++) if (rows[i].pending) return rows[i].id;
  for (let i = index - 1; i >= 0; i--) if (rows[i].pending) return rows[i].id;
  return null;
}

/** An optimistic change to the visible rows while a server action runs. */
export type RowOp = { kind: "remove"; id: string } | { kind: "patch"; id: string; patch: Partial<TransactionRow> };

export function applyRowOp(rows: TransactionRow[], op: RowOp): TransactionRow[] {
  if (op.kind === "remove") return rows.filter((r) => r.id !== op.id);
  const next = rows.map((r) => (r.id === op.id ? { ...r, ...op.patch } : r));
  // A new date moves the row to its day; the sort is stable, so the rest keep their order.
  return op.patch.date ? next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) : next;
}

// ───────────────────────── Insights (side pane) ─────────────────────────

/** The fields of a month's records the insights need. */
export type StatRow = Pick<TransactionRow, "id" | "type" | "amount" | "date" | "memo" | "categoryId">;

export type MonthStats = {
  rows: StatRow[];
  /** Category id → usual monthly total (getCategoryUsual). */
  usual: Record<string, number>;
};

/** The month's records with the selected row's latest (possibly unsaved) values swapped in. */
function withCurrent(monthRows: StatRow[], row: TransactionRow): StatRow[] {
  const current: StatRow = {
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    memo: row.memo,
    categoryId: row.categoryId,
  };
  const inMonth = monthOf(row.date);
  const others = monthRows.filter((r) => r.id !== row.id && monthOf(r.date) === inMonth);
  return [...others, current];
}

export type SameMemoInsight = {
  /** The memo's first word as typed, e.g. "점심". */
  word: string;
  headline: string;
  /**
   * Occurrences this month, oldest first, at most SAME_MEMO_MAX_BARS of them (the latest, or the
   * ones around this record when it is older). `height` is a 0–1 square-root scale.
   */
  bars: { id: string; amount: number; date: string; current: boolean; height: number }[];
  note: string;
  label: string;
};

/** A daily commute logs 40+ of the same memo a month; more bars than this stop fitting the pane. */
export const SAME_MEMO_MAX_BARS = 24;

/** The [start, end) slice of `count` bars to draw: the latest ones, or a window around `current`. */
function barWindow(count: number, current: number, max: number): [number, number] {
  if (count <= max) return [0, count];
  const latest = count - max;
  if (current >= latest) return [latest, count];
  const start = Math.max(0, current - Math.floor(max / 2));
  return [start, start + max];
}

/**
 * "점심, 이번 달 8번" with one bar per occurrence and how this one compares to the average. Not for
 * transfers: the side pane shows the two wallets for those, and "싼/비싼" would judge one like a purchase.
 */
export function sameMemoInsight(row: TransactionRow, monthRows: StatRow[], today: string): SameMemoInsight | null {
  if (row.type === "transfer") return null;
  const key = placeKey(row.memo);
  if (!key) return null;
  const word = row.memo.trim().split(/\s+/)[0];
  const matches = withCurrent(monthRows, row)
    .filter((r) => r.type === row.type && placeKey(r.memo) === key)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const [start, end] = barWindow(
    matches.length,
    matches.findIndex((r) => r.id === row.id),
    SAME_MEMO_MAX_BARS,
  );
  const shown = matches.slice(start, end);
  const max = Math.max(...shown.map((r) => r.amount), 1);
  const bars = shown.map((r) => ({
    id: r.id,
    amount: r.amount,
    date: r.date,
    current: r.id === row.id,
    height: Math.sqrt(r.amount / max),
  }));
  const month = monthOf(row.date);
  const when = monthLabel(month, today);
  const count = matches.length;

  let note: string;
  if (count < 2) {
    note = month === monthOf(today) ? "이번 달엔 처음이에요" : `${when}엔 이번 한 번이에요`;
  } else {
    const average = Math.round(matches.reduce((s, r) => s + r.amount, 0) / count);
    const diff = (row.amount - average) / average;
    const less = row.type === "income" ? "적은" : "싼";
    const more = row.type === "income" ? "많은" : "비싼";
    const verdict =
      Math.abs(diff) < 0.1 ? "평균과 비슷해요" : diff < 0 ? `이번 건은 평균보다 ${less} 편` : `이번 건은 평균보다 ${more} 편`;
    note = `평균 ${formatKRW(average)} · ${verdict}`;
  }
  const drawn = bars.length < count ? ` 중 ${bars.length}건을 막대로 표시` : "";
  return {
    word,
    headline: `${word}, ${when} ${count}번`,
    bars,
    note,
    label: `${word} 기록 ${count}건${drawn}, 이번 건 ${formatKRW(row.amount)}`,
  };
}

export type CategoryInsight = {
  name: string;
  title: string;
  total: number;
  /** Part of total dated after today (entered ahead); it isn't spent yet, so the pace leaves it out. */
  ahead: number;
  usual: number | null;
  /** Month-to-date / usual, capped at 1 for the bar. */
  fill: number;
  /** Today's position in the month (0–1) when the record is in the current month. */
  tick: number | null;
  sentence: string;
  label: string;
};

/** Month-to-date total of the record's category against what it usually comes to. */
export function categoryInsight(
  row: TransactionRow,
  stats: MonthStats,
  today: string,
): CategoryInsight | null {
  if (row.type === "transfer" || !row.categoryId || !row.categoryName) return null;
  const month = monthOf(row.date);
  const inCategory = withCurrent(stats.rows, row).filter((r) => r.type === row.type && r.categoryId === row.categoryId);
  const total = inCategory.reduce((s, r) => s + r.amount, 0);
  const usual = stats.usual[row.categoryId] ?? null;
  const isCurrent = month === monthOf(today);
  const tick = isCurrent ? Number(today.slice(8)) / daysInMonth(month) : null;
  // As on 홈 and 카테고리: the amount is the whole month (it matches the list), but records entered
  // ahead for later days haven't happened yet, so the pace and the sentence use the month to date.
  const spent = isCurrent ? inCategory.filter((r) => r.date <= today).reduce((s, r) => s + r.amount, 0) : total;
  const ahead = total - spent;
  const fill = usual ? Math.min(1, spent / usual) : 0;
  const title = `${row.categoryName} · ${shortMonth(month)}`;

  let sentence: string;
  if (!usual) {
    sentence = "지난 석 달 기록이 없어서 아직 비교할 게 없어요";
  } else if (row.type === "income") {
    // No pace against the tick: income comes in lumps (payday), so mid-month it is only "so far".
    if (spent > usual) sentence = `평소 한 달보다 ${formatKRW(spent - usual)} 더 들어왔어요`;
    else if (spent === usual) sentence = "평소 한 달만큼 들어왔어요";
    else if (isCurrent) sentence = `평소 한 달의 ${Math.round((spent / usual) * 100)}%가 들어왔어요`;
    else sentence = `평소 한 달보다 ${formatKRW(usual - spent)} 덜 들어왔어요`;
  } else if (spent > usual) {
    sentence = `${isCurrent ? "벌써 " : ""}평소 한 달보다 ${formatKRW(spent - usual)} 더 썼어요`;
  } else if (tick !== null) {
    const expected = usual * tick;
    sentence =
      spent < expected * 0.9
        ? "오늘 위치(눈금)보다 덜 썼어요"
        : spent > expected * 1.1
          ? "오늘 위치(눈금)보다 많이 썼어요"
          : "오늘 위치(눈금)와 비슷하게 쓰고 있어요";
  } else {
    sentence = spent === usual ? "평소 한 달과 같아요" : `평소 한 달보다 ${formatKRW(usual - spent)} 덜 썼어요`;
  }

  const percent = usual ? Math.round((spent / usual) * 100) : null;
  const label =
    percent === null
      ? `${title} ${formatKRW(total)}`
      : `평소 한 달의 ${percent}%${tick !== null ? `, 오늘은 이달의 ${Math.round(tick * 100)}% 지점` : ""}`;
  return { name: row.categoryName, title, total, ahead, usual, fill, tick, sentence, label };
}

export type KeywordSuggestion = { word: string; categoryId: string; categoryName: string; text: string };

/**
 * For a pending record, offer to save the memo's place word as a keyword of its category, so the
 * next quick entry files it alone. Skipped when any category already recognizes the word (same
 * rule as the quick-entry parser: a keyword inside the word, one-letter keywords whole only),
 * since saving it would be redundant or would make two categories compete.
 */
export function keywordSuggestion(
  row: TransactionRow,
  categories: EntryContext["categories"],
): KeywordSuggestion | null {
  if (!row.pending || row.type === "transfer" || !row.categoryId || !row.categoryName) return null;
  const word = row.memo.trim().split(/\s+/)[0] ?? "";
  if (!word || word.length > 30 || /^[\d,.]+$/.test(word)) return null;
  const w = word.toLowerCase();
  const known = categories.some(
    (c) =>
      c.name.toLowerCase().replace(/\s+/g, "") === w ||
      c.keywords.some((keyword) => {
        const k = keyword.toLowerCase().replace(/\s+/g, "");
        return k.length === 1 ? w === k : k.length > 0 && w.includes(k);
      }),
  );
  if (known) return null;
  return {
    word,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    text: `${quoted(word, "을", "를")} ${row.categoryName} 키워드로 저장할까요? 다음부터 알아서 나눠요.`,
  };
}

// One reading of final sounds (digits, Latin letters, ㄹ) for the whole app; see lib/josa.ts.
export { quoted, withRo };
