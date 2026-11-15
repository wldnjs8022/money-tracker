/**
 * Pure helpers for AI quick entry: when to offer AI, and how to turn the model's answer back into
 * safe transaction drafts. No I/O, so both the server action and the client can use them, and tests
 * can cover them without calling the API.
 */

import { isValidDate } from "./dates";
import { countAmountTokens, wordKey, type QEResult, type QEType, type QEWalletKind } from "./quick-entry";

/** Why the rule-based parser isn't confident, or null when it is. Shown next to the "AI로 정리" button. */
export function aiReason(text: string, parsed: QEResult | null): string | null {
  if (!parsed || !text.trim()) return null;
  if (countAmountTokens(text) >= 2) return "여러 건이 섞여 있는 것 같아요";
  if (parsed.amount === null) return "금액을 못 찾았어요";
  if (parsed.type === "transfer" && (!parsed.walletId || !parsed.toWalletId)) return "이체할 계좌가 애매해요";
  if (parsed.type !== "transfer" && !parsed.categoryId) return "카테고리를 못 찾았어요";
  return null;
}

/** What the model returns per transaction. Wallets and categories are short refs like "W1" / "C3". */
export type AiRawTransaction = {
  type: QEType;
  amount: number;
  date: string;
  wallet: string | null;
  toWallet: string | null;
  category: string | null;
  memo: string;
  tags: string[];
};

export type AiRefs = {
  wallets: Record<string, { id: string; kind: QEWalletKind }>;
  categories: Record<string, { id: string; kind: "income" | "expense"; name: string; keywords: string[] }>;
};

/**
 * Maps refs back to ids and drops anything that can't be saved. The model is constrained to valid
 * refs by the schema, but this still re-checks kinds, amounts, dates and transfer shape.
 */
export function normalizeAiTransactions(
  raw: AiRawTransaction[],
  refs: AiRefs,
  today: string,
  defaultWalletId: string | null,
): QEResult[] {
  const firstOfKind = (kind: QEWalletKind) => Object.values(refs.wallets).find((w) => w.kind === kind)?.id ?? null;
  const out: QEResult[] = [];

  for (const t of raw.slice(0, 20)) {
    const amount = Math.round(t.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) continue;

    const date = isValidDate(t.date) && t.date <= today ? t.date : today;
    const wallet = t.wallet ? refs.wallets[t.wallet] : undefined;

    if (t.type === "transfer") {
      const to = t.toWallet ? refs.wallets[t.toWallet] : undefined;
      if (!wallet || !to || wallet.id === to.id) continue; // a transfer needs two different wallets
      out.push({ type: "transfer", amount, date, walletId: wallet.id, toWalletId: to.id, categoryId: null, ...text(t) });
      continue;
    }

    const walletId =
      wallet?.id ?? (t.type === "income" ? (firstOfKind("bank") ?? defaultWalletId) : defaultWalletId) ?? null;
    if (!walletId) continue;

    const category = t.category ? refs.categories[t.category] : undefined;
    const categoryId = category && category.kind === t.type ? category.id : null;
    out.push({ type: t.type, amount, date, walletId, toWalletId: null, categoryId, ...text(t) });
  }
  return out;
}

function text(t: AiRawTransaction) {
  const tags = [...new Set(t.tags.map((x) => x.replace(/^#/, "").trim()).filter((x) => x && x.length <= 30))].slice(0, 10);
  return { memo: t.memo.trim().slice(0, 200), tags };
}

export type KeywordSuggestion = { categoryId: string; categoryName: string; keyword: string };

/**
 * Keeps suggestions that point at a real category and that no category already owns, as a keyword
 * or as its name. A word in two categories would tie in the parser (the first one keeps winning) and
 * the categories screen refuses it, so a word another category owns is dropped, not moved.
 */
export function normalizeKeywordSuggestions(
  raw: { category: string; keyword: string }[],
  refs: AiRefs,
): KeywordSuggestion[] {
  // refs holds every keyword, including the ones past the 20 per category the model was shown.
  const owned = new Set(Object.values(refs.categories).flatMap((c) => [c.name, ...c.keywords]).map(wordKey));
  const seen = new Set<string>();
  const out: KeywordSuggestion[] = [];
  for (const s of raw) {
    const category = refs.categories[s.category];
    const keyword = s.keyword.trim();
    if (!category || !keyword || keyword.length > 30 || /\d/.test(keyword)) continue;
    const key = wordKey(keyword);
    if (owned.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ categoryId: category.id, categoryName: category.name, keyword });
    if (out.length === 3) break;
  }
  return out;
}
