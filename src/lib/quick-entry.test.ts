import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, parseQuickEntry, type QEContext } from "./quick-entry";

const ctx: QEContext = {
  today: "2026-11-13",
  defaultWalletId: "w-card",
  wallets: [
    { id: "w-cash", name: "현금", kind: "cash" },
    { id: "w-bank", name: "주거래 통장", kind: "bank" },
    { id: "w-card", name: "신용카드", kind: "card" },
    { id: "w-kb", name: "국민체크", kind: "card" },
  ],
  categories: [
    { id: "c-food", name: "식비", kind: "expense", keywords: ["점심", "김밥", "밥", "치킨"] },
    { id: "c-cafe", name: "카페·간식", kind: "expense", keywords: ["커피", "스벅", "라떼"] },
    { id: "c-delivery", name: "배달", kind: "expense", keywords: ["배민", "배달"] },
    { id: "c-taxi", name: "교통", kind: "expense", keywords: ["택시", "지하철"] },
    { id: "c-life", name: "생활", kind: "expense", keywords: ["편의점", "마트"] },
    { id: "c-sub", name: "구독", kind: "expense", keywords: ["넷플릭스"] },
    { id: "c-health", name: "건강", kind: "expense", keywords: ["약", "병원"] },
    { id: "c-house", name: "주거·통신", kind: "expense", keywords: ["관리비"] },
    { id: "c-fun", name: "문화·여가", kind: "expense", keywords: ["영화"] },
    { id: "c-salary", name: "급여", kind: "income", keywords: ["월급"] },
    { id: "c-etc-in", name: "기타 수입", kind: "income", keywords: ["당근", "판매"] },
  ],
};

describe("parseAmount", () => {
  it.each([
    ["4500", 4500],
    ["4,500", 4500],
    ["4,500원", 4500],
    ["₩12,000", 12000],
    ["3만", 30000],
    ["3만원", 30000],
    ["1.5만", 15000],
    ["12만5천", 125000],
    ["3만5000", 35000],
    ["1억2000만", 120000000],
    ["만원", 10000],
    ["천원", 1000],
  ])("%s → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["김밥", "4.5", "만", "0", "12ab", ""])("rejects %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("parseDate", () => {
  const today = "2026-11-13";
  it.each([
    ["오늘", "2026-11-13"],
    ["어제", "2026-11-12"],
    ["그제", "2026-11-11"],
    ["11/2", "2026-11-02"],
    ["11.2", "2026-11-02"],
    ["12/30", "2025-12-30"], // a future date means last year
    ["2026-10-01", "2026-10-01"],
    ["3일", "2026-11-03"],
    ["15일", "2026-10-15"], // the 15th hasn't happened yet this month
  ])("%s → %s", (input, expected) => {
    expect(parseDate(input, today)).toBe(expected);
  });

  it.each(["13/40", "2/30", "김밥"])("rejects %s", (input) => {
    expect(parseDate(input, today)).toBeNull();
  });
});

describe("parseQuickEntry", () => {
  it("parses a typical expense", () => {
    expect(parseQuickEntry("점심 김밥 4500 카드", ctx)).toEqual({
      type: "expense",
      amount: 4500,
      date: "2026-11-13",
      walletId: "w-card",
      toWalletId: null,
      categoryId: "c-food",
      memo: "점심 김밥",
      tags: [],
    });
  });

  it("falls back to the default wallet for expenses", () => {
    const r = parseQuickEntry("스벅 라떼 6,500", ctx);
    expect(r).toMatchObject({ type: "expense", amount: 6500, categoryId: "c-cafe", walletId: "w-card" });
  });

  it("detects income from the category and uses the bank account", () => {
    const r = parseQuickEntry("월급 3,200,000", ctx);
    expect(r).toMatchObject({ type: "income", amount: 3200000, categoryId: "c-salary", walletId: "w-bank" });
  });

  it("treats a + sign as income", () => {
    const r = parseQuickEntry("+50000 당근 판매", ctx);
    expect(r).toMatchObject({ type: "income", amount: 50000, categoryId: "c-etc-in" });
  });

  it("turns 카드값 into a bank → card transfer", () => {
    expect(parseQuickEntry("카드값 450000", ctx)).toMatchObject({
      type: "transfer",
      amount: 450000,
      walletId: "w-bank",
      toWalletId: "w-card",
      categoryId: null,
      memo: "카드값",
    });
  });

  it("parses an arrow transfer", () => {
    expect(parseQuickEntry("통장 → 현금 5만", ctx)).toMatchObject({
      type: "transfer",
      amount: 50000,
      walletId: "w-bank",
      toWalletId: "w-cash",
    });
    expect(parseQuickEntry("통장->현금 5만", ctx)).toMatchObject({ walletId: "w-bank", toWalletId: "w-cash" });
  });

  it("treats two wallets without a category as a transfer (ATM withdrawal)", () => {
    expect(parseQuickEntry("통장 현금 100000", ctx)).toMatchObject({
      type: "transfer",
      walletId: "w-bank",
      toWalletId: "w-cash",
    });
  });

  it("reads dates and tags", () => {
    expect(parseQuickEntry("어제 택시 12만5천 #출장 #회사", ctx)).toMatchObject({
      type: "expense",
      amount: 125000,
      date: "2026-11-12",
      categoryId: "c-taxi",
      memo: "택시",
      tags: ["출장", "회사"],
    });
    expect(parseQuickEntry("11/2 넷플릭스 17000", ctx)).toMatchObject({ date: "2026-11-02", categoryId: "c-sub" });
  });

  it("splits an amount glued to a word", () => {
    expect(parseQuickEntry("커피4500", ctx)).toMatchObject({ amount: 4500, categoryId: "c-cafe", memo: "커피" });
  });

  it("understands Korean unit amounts", () => {
    expect(parseQuickEntry("1.5만 배민", ctx)).toMatchObject({ amount: 15000, categoryId: "c-delivery" });
    expect(parseQuickEntry("편의점 만원", ctx)).toMatchObject({ amount: 10000, categoryId: "c-life" });
  });

  it("drops a typed category name from the memo but keeps keywords", () => {
    expect(parseQuickEntry("식비 12000", ctx)).toMatchObject({ categoryId: "c-food", memo: "" });
  });

  it("matches a wallet by part of its name", () => {
    expect(parseQuickEntry("치킨 23000 국민", ctx)).toMatchObject({ walletId: "w-kb", categoryId: "c-food" });
  });

  it("does not match one-letter keywords inside other words", () => {
    expect(parseQuickEntry("미용실 예약 30000", ctx).categoryId).toBeNull();
    expect(parseQuickEntry("약 8000", ctx).categoryId).toBe("c-health");
  });

  it("respects an explicit type word over the category", () => {
    const r = parseQuickEntry("지출 월급 10000", ctx);
    expect(r.type).toBe("expense");
    expect(r.categoryId).toBeNull();
  });

  it("returns a null amount when none is typed", () => {
    expect(parseQuickEntry("점심", ctx)).toMatchObject({ amount: null, categoryId: "c-food" });
  });
});
