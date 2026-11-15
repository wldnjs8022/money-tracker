import type { TransactionInput } from "@/server/actions";
import { josa, withRo } from "./josa";

// The review queue (확인할 것): records the app filed on its own, so the user takes one look.
// A record is pending while it has a reviewReason and no reviewedAt. The reason stays after
// review so the detail pane can still say why the record was flagged.

export const REVIEW_REASONS = ["ai", "new_place", "uncategorized"] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

/** Where a new record came from: the full form, the rule-parsed quick entry line, or an AI draft. */
export const ENTRY_ORIGINS = ["form", "quick", "ai"] as const;
export type EntryOrigin = (typeof ENTRY_ORIGINS)[number];

/** Short chip shown next to a pending record in lists. */
export const REVIEW_CHIP: Record<ReviewReason, string> = {
  ai: "AI 분류",
  new_place: "새 곳",
  uncategorized: "분류 없음",
};

/**
 * Why a new record needs a look, or null when it doesn't.
 * Priority: no category > filed by AI > a place the user hasn't recorded before.
 * Transfers never need review, and form entries only ever get "uncategorized".
 */
export function deriveReviewReason(input: {
  origin: EntryOrigin;
  type: "income" | "expense" | "transfer";
  categoryId: string | null;
  isNewPlace?: boolean;
}): ReviewReason | null {
  if (input.type === "transfer") return null;
  if (!input.categoryId) return "uncategorized";
  if (input.origin === "ai") return "ai";
  if (input.origin === "quick" && input.isNewPlace) return "new_place";
  return null;
}

/**
 * Every character JS `\s` matches, as a regex class body that reads the same in JS and Postgres.
 * Postgres `\s` follows the server locale and misses the no-break spaces (U+00A0, U+2007, U+202F)
 * and U+FEFF, so the SQL twin of placeKey() spells the class out. A test checks it against `\s`.
 */
export const WHITESPACE_CLASS = String.raw`\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff`;

/**
 * The "place" a memo names: its first word, lowercased ("쿠팡 생필품" → "쿠팡").
 * An empty memo has no place, so it is never a new one.
 * Twin of placeKeySql in server/actions.ts, which collapses runs of WHITESPACE_CLASS the same way:
 * lower(split_part(btrim(regexp_replace(memo, '[WHITESPACE_CLASS]+', ' ', 'g')), ' ', 1))
 */
export function placeKey(memo: string): string {
  return memo.replace(/\s+/g, " ").trim().split(" ")[0].toLowerCase();
}

/** One sentence for the detail pane explaining why the record was flagged. */
export function reviewSentence(reason: ReviewReason, categoryName: string | null): string {
  switch (reason) {
    case "ai":
      return categoryName
        ? `한 줄 입력에서 AI가 ${withRo(categoryName)} 나눴어요`
        : "한 줄 입력에서 AI가 정리했어요. 분류를 골라 주세요";
    case "new_place":
      return categoryName
        ? `처음 보는 곳이에요. ${josa(categoryName, "이", "가")} 맞는지 봐 주세요`
        : "처음 보는 곳이에요. 분류를 골라 주세요";
    case "uncategorized":
      return categoryName
        ? `분류가 없던 기록이에요. ${josa(categoryName, "이", "가")} 맞는지 봐 주세요`
        : "분류가 없어요. 골라 주세요";
  }
}

/**
 * Everything deleteTransaction removed, so restoreTransaction can put the record back
 * exactly as it was: same id, creation time (so list order holds), review state and source line.
 * Timestamps are ISO strings so the snapshot crosses the server/client boundary as plain data.
 */
export type DeletedTransaction = TransactionInput & {
  id: string;
  createdAt: string;
  reviewReason: ReviewReason | null;
  reviewedAt: string | null;
  sourceText: string;
};
