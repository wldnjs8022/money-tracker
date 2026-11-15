import { describe, expect, it } from "vitest";
import { aiReason, normalizeAiTransactions, normalizeKeywordSuggestions, type AiRefs } from "./ai-entry";
import { parseQuickEntry, type QEContext } from "./quick-entry";

const ctx: QEContext = {
  today: "2026-11-13",
  defaultWalletId: "w-card",
  wallets: [
    { id: "w-cash", name: "현금", kind: "cash" },
    { id: "w-bank", name: "주거래 통장", kind: "bank" },
    { id: "w-card", name: "신용카드", kind: "card" },
  ],
  categories: [
    { id: "c-food", name: "식비", kind: "expense", keywords: ["점심", "김밥"] },
    { id: "c-cafe", name: "카페·간식", kind: "expense", keywords: ["커피"] },
    { id: "c-salary", name: "급여", kind: "income", keywords: ["월급"] },
  ],
};

const refs: AiRefs = {
  wallets: { W1: { id: "w-cash", kind: "cash" }, W2: { id: "w-bank", kind: "bank" }, W3: { id: "w-card", kind: "card" } },
  categories: {
    C1: { id: "c-food", kind: "expense", name: "식비", keywords: ["점심", "김밥"] },
    C2: { id: "c-cafe", kind: "expense", name: "카페·간식", keywords: ["커피"] },
    C3: { id: "c-salary", kind: "income", name: "급여", keywords: ["월급"] },
  },
};

describe("aiReason", () => {
  const reason = (text: string) => aiReason(text, parseQuickEntry(text, ctx));

  it("stays quiet when the rule parser is confident", () => {
    expect(reason("점심 김밥 4500 카드")).toBeNull();
    expect(reason("카드값 450000")).toBeNull();
  });

  it("flags lines with several amounts", () => {
    expect(reason("점심 12000 커피 4500")).toBe("여러 건이 섞여 있는 것 같아요");
  });

  it("flags unknown categories and missing amounts", () => {
    expect(reason("올리브영 립밤 12000")).toBe("카테고리를 못 찾았어요");
    expect(reason("점심 김밥")).toBe("금액을 못 찾았어요");
  });

  it("ignores dates when counting amounts", () => {
    expect(reason("11/2 점심 9000")).toBeNull();
  });
});

describe("normalizeAiTransactions", () => {
  const base = { memo: "점심", tags: [], date: "2026-11-13", toWallet: null };

  it("maps refs to ids", () => {
    const [t] = normalizeAiTransactions(
      [{ ...base, type: "expense", amount: 12000, wallet: "W3", category: "C1" }],
      refs,
      "2026-11-13",
      "w-card",
    );
    expect(t).toMatchObject({ type: "expense", amount: 12000, walletId: "w-card", categoryId: "c-food" });
  });

  it("drops a category of the wrong kind and fills the default wallet", () => {
    const [t] = normalizeAiTransactions(
      [{ ...base, type: "expense", amount: 3000, wallet: null, category: "C3" }],
      refs,
      "2026-11-13",
      "w-card",
    );
    expect(t).toMatchObject({ walletId: "w-card", categoryId: null });
  });

  it("uses the bank account for income without a wallet", () => {
    const [t] = normalizeAiTransactions(
      [{ ...base, type: "income", amount: 3_200_000, wallet: null, category: "C3" }],
      refs,
      "2026-11-13",
      "w-card",
    );
    expect(t).toMatchObject({ walletId: "w-bank", categoryId: "c-salary" });
  });

  it("drops invalid amounts and broken transfers, clamps future dates", () => {
    const out = normalizeAiTransactions(
      [
        { ...base, type: "expense", amount: 0, wallet: "W3", category: "C1" },
        { ...base, type: "transfer", amount: 5000, wallet: "W2", toWallet: "W2", category: null },
        { ...base, type: "transfer", amount: 5000, wallet: "W2", toWallet: "W1", category: "C1" },
        { ...base, type: "expense", amount: 4500.4, date: "2027-01-01", wallet: "W1", category: "C2" },
      ],
      refs,
      "2026-11-13",
      "w-card",
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "transfer", walletId: "w-bank", toWalletId: "w-cash", categoryId: null });
    expect(out[1]).toMatchObject({ amount: 4500, date: "2026-11-13" });
  });

  it("cleans tags and memo", () => {
    const [t] = normalizeAiTransactions(
      [{ ...base, type: "expense", amount: 1000, wallet: "W1", category: "C1", memo: "  편의점  ", tags: ["#출장", "출장", ""] }],
      refs,
      "2026-11-13",
      null,
    );
    expect(t).toMatchObject({ memo: "편의점", tags: ["출장"] });
  });
});

describe("normalizeKeywordSuggestions", () => {
  it("keeps new words for real categories only", () => {
    expect(
      normalizeKeywordSuggestions(
        [
          { category: "C2", keyword: "메가커피" },
          { category: "C1", keyword: "김밥" }, // already a keyword
          { category: "C9", keyword: "마라탕" }, // unknown ref
          { category: "C1", keyword: "4500" }, // numbers aren't keywords
          { category: "C2", keyword: "메가커피" }, // duplicate
        ],
        refs,
      ),
    ).toEqual([{ categoryId: "c-cafe", categoryName: "카페·간식", keyword: "메가커피" }]);
  });

  it("drops a word another category already owns, as a keyword or a name", () => {
    expect(
      normalizeKeywordSuggestions(
        [
          { category: "C2", keyword: "점심" }, // 식비's keyword
          { category: "C2", keyword: "Kim Bap" }, // case and spaces don't count
          { category: "C1", keyword: "카페·간식" }, // another category's name
          { category: "C1", keyword: "국밥" },
        ],
        {
          ...refs,
          categories: { ...refs.categories, C1: { ...refs.categories.C1, keywords: ["점심", "김밥", "kimbap"] } },
        },
      ),
    ).toEqual([{ categoryId: "c-food", categoryName: "식비", keyword: "국밥" }]);
  });

  it("checks keywords the model wasn't shown", () => {
    const many = Array.from({ length: 30 }, (_, i) => `단어${i}`).concat("편의점");
    const withMany: AiRefs = {
      ...refs,
      categories: { ...refs.categories, C3: { ...refs.categories.C3, kind: "expense", name: "생활", keywords: many } },
    };
    expect(normalizeKeywordSuggestions([{ category: "C1", keyword: "편의점" }], withMany)).toEqual([]);
  });
});
