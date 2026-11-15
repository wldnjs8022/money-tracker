import { describe, expect, it } from "vitest";
import type { TransactionRow } from "@/server/queries";
import {
  applyRowOp,
  categoryInsight,
  dayLabel,
  fullDateLabel,
  groupByDay,
  inboxHref,
  isFiltered,
  keywordSuggestion,
  listKeyOf,
  monthLabel,
  neighborAfterRemoval,
  nextPendingId,
  quoted,
  rowSubtitle,
  rowTitle,
  SAME_MEMO_MAX_BARS,
  sameMemoInsight,
  survivingNeighbor,
  withRo,
  type InboxQuery,
  type StatRow,
} from "./model";

const TODAY = "2026-11-15";

let seq = 0;
function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  seq += 1;
  return {
    id: `id-${seq}`,
    type: "expense",
    amount: 10000,
    date: TODAY,
    memo: "",
    tags: [],
    walletId: "w-card",
    toWalletId: null,
    categoryId: "c-food",
    walletName: "신용카드",
    walletColor: "#e11d48",
    toWalletName: null,
    categoryName: "식비",
    categoryIcon: "🍚",
    categoryColor: "#f97316",
    createdAt: "2026-11-15T03:00:00.000Z",
    reviewReason: null,
    reviewedAt: null,
    pending: false,
    sourceText: "",
    ...overrides,
  };
}

const stat = (r: TransactionRow): StatRow => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  date: r.date,
  memo: r.memo,
  categoryId: r.categoryId,
});

describe("inboxHref", () => {
  const base: InboxQuery = { view: "all", month: "2026-11" };

  it("leaves defaults out of the URL", () => {
    expect(inboxHref(base, "2026-11")).toBe("/transactions");
  });

  it("keeps the other params when one changes", () => {
    const query: InboxQuery = { view: "all", month: "2026-10", type: "expense", q: "점심" };
    expect(inboxHref(query, "2026-11", { view: "review" })).toBe("/transactions?view=review&month=2026-10&type=expense&q=%EC%A0%90%EC%8B%AC");
  });

  it("clears a param patched to undefined", () => {
    expect(inboxHref({ ...base, wallet: "w1", category: "none" }, "2026-11", { wallet: undefined })).toBe(
      "/transactions?category=none",
    );
  });
});

describe("listKeyOf", () => {
  it("ignores the month in the review view, which spans every month", () => {
    expect(listKeyOf({ view: "review", month: "2026-10" })).toBe(listKeyOf({ view: "review", month: "2026-11" }));
    expect(listKeyOf({ view: "all", month: "2026-10" })).not.toBe(listKeyOf({ view: "all", month: "2026-11" }));
  });

  it("knows when a search or a filter narrows the list", () => {
    expect(isFiltered({ view: "review", month: "2026-11" })).toBe(false);
    expect(isFiltered({ view: "review", month: "2026-11", q: "스타벅스" })).toBe(true);
    expect(isFiltered({ view: "all", month: "2026-11", category: "none" })).toBe(true);
  });
});

describe("dates", () => {
  it("labels day groups", () => {
    expect(dayLabel("2026-11-15", TODAY)).toBe("오늘 · 11월 15일");
    expect(dayLabel("2026-11-14", TODAY)).toBe("어제 · 11월 14일");
    expect(dayLabel("2026-11-13", TODAY)).toBe("11월 13일 금요일");
    expect(dayLabel("2025-12-31", TODAY)).toBe("2025년 12월 31일 수요일");
  });

  it("names months relative to today", () => {
    expect(monthLabel("2026-11", TODAY)).toBe("이번 달");
    expect(monthLabel("2026-10", TODAY)).toBe("10월");
    expect(monthLabel("2025-10", TODAY)).toBe("2025년 10월");
    expect(fullDateLabel("2026-11-13", TODAY)).toBe("11월 13일 금요일");
  });
});

describe("list helpers", () => {
  it("groups by day with the day's totals", () => {
    const rows = [
      row({ date: "2026-11-15", amount: 8500 }),
      row({ date: "2026-11-15", amount: 3000 }),
      row({ date: "2026-11-14", type: "income", amount: 50000 }),
      row({ date: "2026-11-14", type: "transfer", amount: 500000 }),
    ];
    const groups = groupByDay(rows);
    expect(groups.map((g) => [g.date, g.rows.length, g.expense, g.income])).toEqual([
      ["2026-11-15", 2, 11500, 0],
      ["2026-11-14", 2, 0, 50000],
    ]);
  });

  it("titles and subtitles rows", () => {
    expect(rowTitle(row({ memo: "점심 국밥" }))).toBe("점심 국밥");
    expect(rowTitle(row({ memo: "", categoryName: null }))).toBe("분류 없음");
    const transfer = row({ type: "transfer", walletName: "주거래 통장", toWalletName: "신용카드", categoryName: null });
    expect(rowTitle({ ...transfer, memo: "" })).toBe("이체");
    expect(rowSubtitle(transfer)).toBe("이체 · 주거래 통장 → 신용카드");
    expect(rowSubtitle(row({ categoryName: null }))).toBe("분류 없음 · 신용카드");
  });

  it("picks the neighbor below, then above", () => {
    const [a, b, c] = [row(), row(), row()];
    expect(neighborAfterRemoval([a, b, c], b.id)).toBe(c.id);
    expect(neighborAfterRemoval([a, b, c], c.id)).toBe(b.id);
    expect(neighborAfterRemoval([a], a.id)).toBeNull();
  });

  it("hands a record that left the list to its nearest survivor, below first", () => {
    const before = ["a", "x", "b", "c"];
    expect(survivingNeighbor(before, "x", ["a", "b", "c"])).toBe("b");
    // Records added above it in the same refresh don't shift the handover.
    expect(survivingNeighbor(before, "x", ["n1", "n2", "a", "b", "c"])).toBe("b");
    // Its neighbor below left too: the next one down, then up.
    expect(survivingNeighbor(before, "x", ["a", "c"])).toBe("c");
    expect(survivingNeighbor(before, "c", ["a", "x"])).toBe("x");
    expect(survivingNeighbor(before, "x", ["n1"])).toBeNull();
    expect(survivingNeighbor(before, "unknown", ["a", "b"])).toBeNull();
  });

  it("finds the closest other pending row, looking down first", () => {
    const [a, b, c, d] = [row({ pending: true }), row(), row({ pending: true }), row()];
    expect(nextPendingId([a, b, c, d], a.id)).toBe(c.id);
    expect(nextPendingId([a, b, c, d], c.id)).toBe(a.id);
    expect(nextPendingId([b, d], b.id)).toBeNull();
  });

  it("applies optimistic ops and re-sorts on a date change", () => {
    const [a, b, c] = [row({ date: "2026-11-15" }), row({ date: "2026-11-14" }), row({ date: "2026-11-13" })];
    expect(applyRowOp([a, b, c], { kind: "remove", id: b.id }).map((r) => r.id)).toEqual([a.id, c.id]);
    const moved = applyRowOp([a, b, c], { kind: "patch", id: a.id, patch: { date: "2026-11-13" } });
    expect(moved.map((r) => r.id)).toEqual([b.id, a.id, c.id]);
    expect(moved[1].date).toBe("2026-11-13");
  });
});

describe("sameMemoInsight", () => {
  it("counts the same place word this month and compares with the average", () => {
    const current = row({ memo: "점심 국밥", amount: 8500, date: "2026-11-13" });
    const others = [
      row({ memo: "점심 김밥", amount: 12500, date: "2026-11-12" }),
      row({ memo: "점심", amount: 9000, date: "2026-11-02" }),
      row({ memo: "저녁", amount: 30000, date: "2026-11-02" }),
      row({ memo: "점심", amount: 9000, date: "2026-11-02", type: "income" }),
    ];
    const insight = sameMemoInsight(current, [...others, current].map(stat), TODAY);
    expect(insight?.headline).toBe("점심, 이번 달 3번");
    expect(insight?.bars.map((b) => b.amount)).toEqual([9000, 12500, 8500]);
    expect(insight?.bars.find((b) => b.current)?.id).toBe(current.id);
    expect(insight?.bars[1].height).toBe(1);
    expect(insight?.note).toBe("평균 10,000원 · 이번 건은 평균보다 싼 편");
  });

  it("uses the selected row's unsaved values", () => {
    const current = row({ memo: "점심", amount: 9000 });
    const stale = { ...stat(current), amount: 1 };
    const other = row({ memo: "점심", amount: 9200 });
    expect(sameMemoInsight(current, [stale, stat(other)], TODAY)?.note).toBe("평균 9,100원 · 평균과 비슷해요");
  });

  it("draws at most SAME_MEMO_MAX_BARS bars, always including this record", () => {
    const day = (i: number) => `2026-11-${String(i).padStart(2, "0")}`;
    // 30 days × 1 commute, plus 10 more on the first days: 40 in all.
    const commutes = [
      ...Array.from({ length: 30 }, (_, i) => row({ memo: "지하철", amount: 1550, date: day(i + 1) })),
      ...Array.from({ length: 10 }, (_, i) => row({ memo: "지하철", amount: 1550, date: day(i + 1) })),
    ];
    const latest = commutes[29];
    const recent = sameMemoInsight(latest, commutes.map(stat), TODAY);
    expect(recent?.headline).toBe("지하철, 이번 달 40번");
    expect(recent?.bars).toHaveLength(SAME_MEMO_MAX_BARS);
    expect(recent?.bars.at(-1)?.id).toBe(latest.id);
    expect(recent?.label).toBe(`지하철 기록 40건 중 ${SAME_MEMO_MAX_BARS}건을 막대로 표시, 이번 건 1,550원`);

    const early = commutes[0];
    const around = sameMemoInsight(early, commutes.map(stat), TODAY);
    expect(around?.bars).toHaveLength(SAME_MEMO_MAX_BARS);
    expect(around?.bars.some((b) => b.current && b.id === early.id)).toBe(true);
  });

  it("says when it's the first one and skips empty memos", () => {
    const first = row({ memo: "공차 버블티", date: "2026-10-03" });
    expect(sameMemoInsight(first, [], TODAY)?.note).toBe("10월엔 이번 한 번이에요");
    expect(sameMemoInsight(row({ memo: "  " }), [], TODAY)).toBeNull();
  });

  it("skips transfers, which the side pane shows as two wallets instead", () => {
    const current = row({ type: "transfer", memo: "적금", amount: 500000, categoryId: null, categoryName: null });
    const other = row({ type: "transfer", memo: "적금", amount: 300000, categoryId: null, categoryName: null });
    expect(sameMemoInsight(current, [stat(current), stat(other)], TODAY)).toBeNull();
  });
});

describe("categoryInsight", () => {
  it("compares month-to-date spending with the usual month and today's position", () => {
    const current = row({ amount: 20000 });
    const stats = { rows: [stat(row({ amount: 30000 })), stat(row({ amount: 5000, categoryId: "c-cafe" }))], usual: { "c-food": 200000 } };
    const insight = categoryInsight(current, stats, TODAY);
    expect(insight?.title).toBe("식비 · 11월");
    expect(insight?.total).toBe(50000);
    expect(insight?.fill).toBe(0.25);
    expect(insight?.tick).toBe(0.5);
    expect(insight?.sentence).toBe("오늘 위치(눈금)보다 덜 썼어요");
  });

  it("counts records entered ahead in the amount but not in the pace", () => {
    const current = row({ amount: 20000 });
    const rent = row({ id: "t-rent", date: "2026-11-25", amount: 180000 });
    const insight = categoryInsight(current, { rows: [stat(rent)], usual: { "c-food": 200000 } }, TODAY);
    expect(insight?.total).toBe(200000);
    expect(insight?.ahead).toBe(180000);
    expect(insight?.fill).toBe(0.1);
    expect(insight?.sentence).toBe("오늘 위치(눈금)보다 덜 썼어요");
  });

  it("says when the usual month is already passed", () => {
    const insight = categoryInsight(row({ amount: 250000 }), { rows: [], usual: { "c-food": 200000 } }, TODAY);
    expect(insight?.fill).toBe(1);
    expect(insight?.sentence).toBe("벌써 평소 한 달보다 50,000원 더 썼어요");
  });

  it("handles past months, missing history and transfers", () => {
    const past = row({ date: "2026-10-10", amount: 150000 });
    expect(categoryInsight(past, { rows: [], usual: { "c-food": 200000 } }, TODAY)?.sentence).toBe(
      "평소 한 달보다 50,000원 덜 썼어요",
    );
    expect(categoryInsight(row(), { rows: [], usual: {} }, TODAY)?.usual).toBeNull();
    expect(categoryInsight(row({ type: "transfer" }), { rows: [], usual: {} }, TODAY)).toBeNull();
  });

  it("reports income this month as a share so far, never as a shortfall", () => {
    const income = (overrides: Partial<TransactionRow>) =>
      row({ type: "income", categoryId: "c-allowance", categoryName: "용돈", amount: 50000, ...overrides });
    const usual = { "c-allowance": 200000 };
    expect(categoryInsight(income({}), { rows: [], usual }, TODAY)?.sentence).toBe("평소 한 달의 25%가 들어왔어요");
    expect(categoryInsight(income({ amount: 200000 }), { rows: [], usual }, TODAY)?.sentence).toBe(
      "평소 한 달만큼 들어왔어요",
    );
    expect(categoryInsight(income({ amount: 260000 }), { rows: [], usual }, TODAY)?.sentence).toBe(
      "평소 한 달보다 60,000원 더 들어왔어요",
    );
    // A month that is over can fall short.
    expect(categoryInsight(income({ date: "2026-10-05" }), { rows: [], usual }, TODAY)?.sentence).toBe(
      "평소 한 달보다 150,000원 덜 들어왔어요",
    );
  });
});

describe("keywordSuggestion", () => {
  const categories = [
    { id: "c-food", name: "식비", kind: "expense" as const, icon: "🍚", color: "#f97316", keywords: ["점심", "밥"] },
    { id: "c-cafe", name: "카페·간식", kind: "expense" as const, icon: "☕", color: "#a16207", keywords: ["커피"] },
  ];

  it("offers the place word of a pending record with the right particle", () => {
    const pending = row({ memo: "공차 버블티", pending: true, categoryId: "c-cafe", categoryName: "카페·간식" });
    expect(keywordSuggestion(pending, categories)).toEqual({
      word: "공차",
      categoryId: "c-cafe",
      categoryName: "카페·간식",
      text: '‘공차’를 카페·간식 키워드로 저장할까요? 다음부터 알아서 나눠요.',
    });
    const withBatchim = row({ memo: "국밥집", pending: true });
    expect(keywordSuggestion(withBatchim, categories)?.text.startsWith('‘국밥집’을 식비')).toBe(true);
  });

  it("skips words a category already recognizes, confirmed records and transfers", () => {
    expect(keywordSuggestion(row({ memo: "점심 마라탕", pending: true }), categories)).toBeNull();
    expect(keywordSuggestion(row({ memo: "스타커피", pending: true }), categories)).toBeNull();
    expect(keywordSuggestion(row({ memo: "밥집", pending: true }), categories)).not.toBeNull();
    expect(keywordSuggestion(row({ memo: "공차", pending: false }), categories)).toBeNull();
    expect(keywordSuggestion(row({ memo: "공차", pending: true, categoryId: null }), categories)).toBeNull();
    expect(keywordSuggestion(row({ memo: "12000", pending: true }), categories)).toBeNull();
  });
});

describe("particles", () => {
  it("quotes a word and attaches the particle", () => {
    expect(quoted("공차", "을", "를")).toBe('‘공차’를');
    expect(quoted("국밥", "을", "를")).toBe('‘국밥’을');
  });

  it("uses 로 after ㄹ", () => {
    expect(withRo("식비")).toBe("식비로");
    expect(withRo("생활")).toBe("생활로");
    expect(withRo("교육")).toBe("교육으로");
    // Same reading as lib/josa: a final 1/7/8/L/R takes 로.
    expect(withRo("카드1")).toBe("카드1로");
    expect(withRo("카드3")).toBe("카드3으로");
  });
});
