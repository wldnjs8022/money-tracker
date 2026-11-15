import { describe, expect, it } from "vitest";
import {
  countAmountTokens,
  hasOneConfidentAmount,
  parseAmount,
  parseDate,
  parseQuickEntry,
  plausibleAmount,
  type QEContext,
} from "./quick-entry";

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
    { id: "c-life", name: "생활", kind: "expense", keywords: ["편의점", "마트", "GS25"] },
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
    expect(parseQuickEntry("껌50원", ctx)).toMatchObject({ amount: 50, memo: "껌" });
    expect(parseQuickEntry("택시1.5만", ctx)).toMatchObject({ amount: 15000, categoryId: "c-taxi", memo: "택시" });
  });

  it("keeps store names that end in digits whole", () => {
    // A keyword of its own stays one word and keeps its category.
    expect(parseQuickEntry("GS25", ctx)).toMatchObject({ amount: null, categoryId: "c-life", memo: "GS25" });
    expect(parseQuickEntry("gs25 음료", ctx)).toMatchObject({ amount: null, categoryId: "c-life", memo: "gs25 음료" });
    // A number under 100 with no unit or 원 is part of the name.
    expect(parseQuickEntry("이마트24", ctx)).toMatchObject({ amount: null, categoryId: "c-life", memo: "이마트24" });
    expect(parseQuickEntry("배스킨라빈스31", ctx)).toMatchObject({ amount: null, memo: "배스킨라빈스31" });
  });

  it("still finds the amount next to a store name that ends in digits", () => {
    expect(parseQuickEntry("GS25 3000", ctx)).toMatchObject({ amount: 3000, categoryId: "c-life", memo: "GS25" });
    expect(parseQuickEntry("GS25 우유2500", ctx)).toMatchObject({ amount: 2500, memo: "GS25 우유" });
    expect(parseQuickEntry("이마트24 1,200원", ctx)).toMatchObject({ amount: 1200, memo: "이마트24" });
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

describe("countAmountTokens", () => {
  it("counts amounts typed as tokens of their own", () => {
    expect(countAmountTokens("커피 4500")).toBe(1);
    expect(countAmountTokens("+50000 당근 판매")).toBe(1);
    expect(countAmountTokens("점심 12000 커피 4,500원")).toBe(2);
    expect(countAmountTokens("통장->현금 5만")).toBe(1);
  });

  it("skips dates, tags and amounts glued to a word", () => {
    expect(countAmountTokens("11/2 점심 9000")).toBe(1);
    expect(countAmountTokens("어제 15일 #4500 택시")).toBe(0);
    expect(countAmountTokens("커피4500")).toBe(0);
    expect(countAmountTokens("GS25")).toBe(0);
  });

  it("still counts a small number on its own, so AI can flag a line with two", () => {
    expect(countAmountTokens("이마트 24")).toBe(1);
    expect(countAmountTokens("아이폰 15 1200000")).toBe(2);
  });
});

describe("plausibleAmount", () => {
  it.each([
    ["4500", 4500, true],
    ["100", 100, true],
    ["50원", 50, true],
    ["₩50", 50, true],
    ["1.5만", 15000, true],
    ["24", 24, false],
    ["99", 99, false],
  ])("%s → %s", (token, value, expected) => {
    expect(plausibleAmount(token, value)).toBe(expected);
  });
});

describe("hasOneConfidentAmount", () => {
  it.each(["커피 4500", "껌 50원", "편의점 만원", "+50000 당근 판매", "통장 → 현금 5만"])("records %s", (input) => {
    expect(hasOneConfidentAmount(input)).toBe(true);
  });

  it.each(["이마트 24", "GS 25", "아이폰 15", "배스킨라빈스 31", "체크카드 1", "-30"])("searches %s", (input) => {
    expect(hasOneConfidentAmount(input)).toBe(false);
  });

  it("needs exactly one standalone amount", () => {
    expect(hasOneConfidentAmount("점심 12000 커피 4500")).toBe(false);
    expect(hasOneConfidentAmount("아이폰 15 1200000")).toBe(false);
    expect(hasOneConfidentAmount("커피4500")).toBe(false);
    expect(hasOneConfidentAmount("GS25")).toBe(false);
  });
});
