import { describe, expect, it } from "vitest";
import {
  deriveReviewReason,
  placeKey,
  REVIEW_CHIP,
  REVIEW_REASONS,
  reviewSentence,
  WHITESPACE_CLASS,
  type EntryOrigin,
} from "./review";

const ORIGINS: EntryOrigin[] = ["form", "quick", "ai"];

describe("deriveReviewReason", () => {
  it("never flags transfers", () => {
    for (const origin of ORIGINS) {
      expect(deriveReviewReason({ origin, type: "transfer", categoryId: null })).toBeNull();
      expect(deriveReviewReason({ origin, type: "transfer", categoryId: null, isNewPlace: true })).toBeNull();
    }
  });

  it("flags a record without a category, whatever its origin", () => {
    for (const origin of ORIGINS) {
      expect(deriveReviewReason({ origin, type: "expense", categoryId: null })).toBe("uncategorized");
      expect(deriveReviewReason({ origin, type: "income", categoryId: null })).toBe("uncategorized");
    }
  });

  it("puts a missing category ahead of AI and new place", () => {
    expect(deriveReviewReason({ origin: "ai", type: "expense", categoryId: null, isNewPlace: true })).toBe(
      "uncategorized",
    );
    expect(deriveReviewReason({ origin: "quick", type: "expense", categoryId: null, isNewPlace: true })).toBe(
      "uncategorized",
    );
  });

  it("flags every categorized AI draft as ai, even at a new place", () => {
    expect(deriveReviewReason({ origin: "ai", type: "expense", categoryId: "c-food" })).toBe("ai");
    expect(deriveReviewReason({ origin: "ai", type: "income", categoryId: "c-salary" })).toBe("ai");
    expect(deriveReviewReason({ origin: "ai", type: "expense", categoryId: "c-food", isNewPlace: true })).toBe("ai");
  });

  it("flags a quick entry at a place never seen before", () => {
    expect(deriveReviewReason({ origin: "quick", type: "expense", categoryId: "c-life", isNewPlace: true })).toBe(
      "new_place",
    );
    expect(deriveReviewReason({ origin: "quick", type: "expense", categoryId: "c-life", isNewPlace: false })).toBeNull();
    expect(deriveReviewReason({ origin: "quick", type: "expense", categoryId: "c-life" })).toBeNull();
  });

  it("only flags form entries when they have no category", () => {
    expect(deriveReviewReason({ origin: "form", type: "expense", categoryId: "c-food" })).toBeNull();
    expect(deriveReviewReason({ origin: "form", type: "expense", categoryId: "c-food", isNewPlace: true })).toBeNull();
    expect(deriveReviewReason({ origin: "form", type: "income", categoryId: "c-salary" })).toBeNull();
  });
});

describe("placeKey", () => {
  it("takes the first word, lowercased", () => {
    expect(placeKey("쿠팡 생필품")).toBe("쿠팡");
    expect(placeKey("CGV 영화")).toBe("cgv");
    expect(placeKey("Starbucks")).toBe("starbucks");
    expect(placeKey("GS25 음료")).toBe("gs25");
  });

  it("ignores surrounding and repeated whitespace of any kind", () => {
    expect(placeKey("   다이소   수납함  ")).toBe("다이소");
    expect(placeKey("점심\t국밥")).toBe("점심");
    expect(placeKey("\n점심\n국밥\n")).toBe("점심");
    expect(placeKey("점심　국밥")).toBe("점심");
  });

  it("splits on no-break spaces too (Option+Space, pasted bank texts)", () => {
    expect(placeKey("다이소\u00a0수납함")).toBe("다이소");
    expect(placeKey("\u202f스타벅스\u2007라떼")).toBe("스타벅스");
    expect(placeKey("\ufeff쿠팡 생필품")).toBe("쿠팡");
  });

  it("returns an empty key for an empty memo", () => {
    expect(placeKey("")).toBe("");
    expect(placeKey("   ")).toBe("");
    expect(placeKey("\t\n")).toBe("");
  });

  it("keeps punctuation that is part of the word", () => {
    expect(placeKey("카페·간식 디저트")).toBe("카페·간식");
    expect(placeKey("#회식 고기")).toBe("#회식");
  });
});

describe("REVIEW_CHIP", () => {
  it("has a label for every reason", () => {
    expect(Object.keys(REVIEW_CHIP).sort()).toEqual([...REVIEW_REASONS].sort());
    expect(REVIEW_CHIP).toEqual({ ai: "AI 분류", new_place: "새 곳", uncategorized: "분류 없음" });
  });
});

describe("reviewSentence", () => {
  it("says which category the AI picked, with 로/으로", () => {
    expect(reviewSentence("ai", "식비")).toBe("한 줄 입력에서 AI가 식비로 나눴어요");
    expect(reviewSentence("ai", "교통")).toBe("한 줄 입력에서 AI가 교통으로 나눴어요");
    expect(reviewSentence("ai", "카페·간식")).toBe("한 줄 입력에서 AI가 카페·간식으로 나눴어요");
    expect(reviewSentence("ai", "구독")).toBe("한 줄 입력에서 AI가 구독으로 나눴어요");
  });

  it("uses 로 after a final ㄹ", () => {
    expect(reviewSentence("ai", "생활")).toBe("한 줄 입력에서 AI가 생활로 나눴어요");
    expect(reviewSentence("ai", "기타 지출")).toBe("한 줄 입력에서 AI가 기타 지출로 나눴어요");
  });

  it("reads a name that ends in a digit or a capital letter aloud", () => {
    expect(reviewSentence("ai", "OTT")).toBe("한 줄 입력에서 AI가 OTT로 나눴어요");
    expect(reviewSentence("ai", "모임 1")).toBe("한 줄 입력에서 AI가 모임 1로 나눴어요");
    expect(reviewSentence("ai", "모임 3")).toBe("한 줄 입력에서 AI가 모임 3으로 나눴어요");
    expect(reviewSentence("new_place", "모임 1")).toBe("처음 보는 곳이에요. 모임 1이 맞는지 봐 주세요");
  });

  it("asks for a category when the AI record has none", () => {
    expect(reviewSentence("ai", null)).toBe("한 줄 입력에서 AI가 정리했어요. 분류를 골라 주세요");
  });

  it("asks whether a new place's category fits, with 이/가", () => {
    expect(reviewSentence("new_place", "생활")).toBe("처음 보는 곳이에요. 생활이 맞는지 봐 주세요");
    expect(reviewSentence("new_place", "식비")).toBe("처음 보는 곳이에요. 식비가 맞는지 봐 주세요");
    expect(reviewSentence("new_place", null)).toBe("처음 보는 곳이에요. 분류를 골라 주세요");
  });

  it("asks for a category when there is none", () => {
    expect(reviewSentence("uncategorized", null)).toBe("분류가 없어요. 골라 주세요");
  });

  it("asks to check a category added to an uncategorized record", () => {
    expect(reviewSentence("uncategorized", "건강")).toBe("분류가 없던 기록이에요. 건강이 맞는지 봐 주세요");
  });
});

describe("WHITESPACE_CLASS", () => {
  it("matches exactly what JS \\s matches, so the SQL twin of placeKey splits the same way", () => {
    const spelled = new RegExp(`[${WHITESPACE_CLASS}]`);
    const mismatches: string[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      const ch = String.fromCharCode(code);
      if (/\s/.test(ch) !== spelled.test(ch)) mismatches.push(code.toString(16));
    }
    expect(mismatches).toEqual([]);
  });
});
