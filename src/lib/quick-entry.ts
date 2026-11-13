/**
 * Quick entry parser: turns one line of free text into a transaction draft.
 *
 *   "점심 김밥 4500 카드"        → 지출 4,500원 · 식비 · 신용카드 · memo "점심 김밥"
 *   "월급 3,200,000"            → 수입 · 급여 · 통장
 *   "카드값 450000"             → 이체 통장 → 신용카드
 *   "통장 → 현금 5만"            → 이체 통장 → 현금
 *   "어제 택시 12만5천 #출장"     → date = yesterday, tags = [출장]
 *
 * Pure function, no I/O, so it can run on every keystroke and be unit tested.
 */

import { addDays, addMonths, isValidDate } from "./dates";

export type QEWalletKind = "cash" | "bank" | "card" | "invest" | "other";
export type QEType = "income" | "expense" | "transfer";

export type QEWallet = { id: string; name: string; kind: QEWalletKind };
export type QECategory = { id: string; name: string; kind: "income" | "expense"; keywords: string[] };

export type QEContext = {
  wallets: QEWallet[];
  categories: QECategory[];
  /** YYYY-MM-DD in KST */
  today: string;
  /** Wallet to use for expenses when none is mentioned (e.g. the most used one) */
  defaultWalletId?: string | null;
};

export type QEResult = {
  type: QEType;
  amount: number | null;
  date: string;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  memo: string;
  tags: string[];
};

const UNIT: Record<string, number> = { 억: 1e8, 만: 1e4, 천: 1e3, 백: 1e2 };
const WORD_AMOUNTS: Record<string, number> = { 천원: 1_000, 만원: 10_000, 십만원: 100_000 };

/** "4500", "4,500원", "₩4,500", "3만", "1.5만", "12만5천", "3만5000", "만원" → number */
export function parseAmount(token: string): number | null {
  if (WORD_AMOUNTS[token] !== undefined) return WORD_AMOUNTS[token];
  const s = token.replace(/^[₩\\]/, "").replace(/원$/, "").replace(/,/g, "");
  if (!/^\d/.test(s)) return null;

  const part = /(\d+(?:\.\d+)?)(억|만|천|백)?/y;
  let pos = 0;
  let total = 0;
  while (pos < s.length) {
    part.lastIndex = pos;
    const m = part.exec(s);
    if (!m) return null;
    const n = Number.parseFloat(m[1]);
    const unit = m[2];
    pos = part.lastIndex;
    if (!unit && pos < s.length) return null; // digits must end the token unless followed by a unit
    if (!unit && m[1].includes(".")) return null; // "4.5" without a unit isn't a won amount
    total += unit ? n * UNIT[unit] : n;
  }
  const rounded = Math.round(total);
  return rounded > 0 ? rounded : null;
}

/** "오늘", "어제", "그제", "11/2", "11.2", "2026-11-02", "15일" → YYYY-MM-DD (never in the future) */
export function parseDate(token: string, today: string): string | null {
  switch (token) {
    case "오늘":
      return today;
    case "어제":
      return addDays(today, -1);
    case "그제":
    case "그저께":
    case "엊그제":
      return addDays(today, -2);
  }

  if (isValidDate(token)) return token;

  const year = Number(today.slice(0, 4));
  const md = /^(\d{1,2})[./](\d{1,2})$/.exec(token);
  if (md) {
    const candidate = ymd(year, Number(md[1]), Number(md[2]));
    if (!candidate) return null;
    // "12/30" typed in January means last December
    return candidate > today ? ymd(year - 1, Number(md[1]), Number(md[2])) : candidate;
  }

  const dayOnly = /^(\d{1,2})일$/.exec(token);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    const thisMonth = today.slice(0, 7);
    const candidate = ymd(year, Number(thisMonth.slice(5)), day);
    if (candidate && candidate <= today) return candidate;
    const prev = addMonths(thisMonth, -1);
    return ymd(Number(prev.slice(0, 4)), Number(prev.slice(5)), day);
  }
  return null;
}

function ymd(y: number, m: number, d: number): string | null {
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidDate(s) ? s : null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

const KIND_ALIASES: Record<string, QEWalletKind> = {
  현금: "cash",
  카드: "card",
  신용카드: "card",
  체크카드: "card",
  통장: "bank",
  계좌: "bank",
  은행: "bank",
};

const TYPE_WORDS: Record<string, QEType> = { 수입: "income", 지출: "expense", 이체: "transfer" };
const CARD_PAYMENT_WORDS = new Set(["카드값", "카드대금", "카드결제"]);

function matchWallet(token: string, wallets: QEWallet[]): QEWallet | null {
  const t = norm(token);
  const exact = wallets.find((w) => norm(w.name) === t);
  if (exact) return exact;
  const kind = KIND_ALIASES[t];
  if (kind) return wallets.find((w) => w.kind === kind) ?? null;
  if (t.length >= 2) {
    const partial = wallets.filter((w) => norm(w.name).includes(t));
    if (partial.length === 1) return partial[0];
  }
  return null;
}

type CategoryMatch = { category: QECategory; score: number; exactName: boolean; word: string };

function matchCategory(words: string[], categories: QECategory[]): CategoryMatch | null {
  let best: CategoryMatch | null = null;
  for (const word of words) {
    const w = norm(word);
    for (const category of categories) {
      if (norm(category.name) === w) {
        const match = { category, score: 1000, exactName: true, word };
        if (!best || match.score > best.score) best = match;
        continue;
      }
      for (const keyword of category.keywords) {
        const k = norm(keyword);
        // One-letter keywords (밥, 약, 옷) only match the whole word: "예약" is not 약.
        const hit = k.length === 1 ? w === k : k.length > 0 && w.includes(k);
        if (hit && (!best || k.length > best.score)) {
          best = { category, score: k.length, exactName: false, word };
        }
      }
    }
  }
  return best;
}

export function parseQuickEntry(input: string, ctx: QEContext): QEResult {
  const text = input.replace(/->|=>|→/g, " → ").trim();
  const tokens = text.split(/\s+/).filter(Boolean);

  let date = ctx.today;
  let amount: number | null = null;
  let typeHint: QEType | null = null;
  let cardPayment = false;
  let sawArrow = false;
  const tags: string[] = [];
  const memoWords: string[] = [];
  const walletsBefore: QEWallet[] = [];
  const walletsAfter: QEWallet[] = [];

  for (const token of tokens) {
    if (token === "→") {
      sawArrow = true;
      continue;
    }
    if (token.startsWith("#") && token.length > 1) {
      tags.push(token.slice(1));
      continue;
    }
    const parsedDate = parseDate(token, ctx.today);
    if (parsedDate) {
      date = parsedDate;
      continue;
    }
    if (amount === null) {
      const sign = token[0] === "+" || token[0] === "-" ? token[0] : "";
      const parsed = parseAmount(sign ? token.slice(1) : token);
      if (parsed !== null) {
        amount = parsed;
        if (sign === "+") typeHint ??= "income";
        if (sign === "-") typeHint ??= "expense";
        continue;
      }
    }
    if (TYPE_WORDS[token]) {
      typeHint = TYPE_WORDS[token];
      continue;
    }
    if (CARD_PAYMENT_WORDS.has(token)) {
      cardPayment = true;
      continue;
    }
    const wallet = matchWallet(token, ctx.wallets);
    if (wallet) {
      (sawArrow ? walletsAfter : walletsBefore).push(wallet);
      continue;
    }
    memoWords.push(token);
  }

  // "커피4500" — amount glued to a word. Only when no standalone amount was found.
  if (amount === null) {
    for (let i = memoWords.length - 1; i >= 0; i--) {
      const glued = /^(.*?[^\d,.+\-₩])(\d[\d,.]*(?:[억만천백][\d,.]*)*원?)$/.exec(memoWords[i]);
      const parsed = glued ? parseAmount(glued[2]) : null;
      if (glued && parsed !== null) {
        amount = parsed;
        memoWords[i] = glued[1];
        break;
      }
    }
  }

  const allWallets = [...walletsBefore, ...walletsAfter];
  const isTransfer =
    typeHint === "transfer" || cardPayment || sawArrow || (allWallets.length >= 2 && typeHint === null);

  if (isTransfer) {
    let from: QEWallet | null;
    let to: QEWallet | null;
    if (cardPayment) {
      from = allWallets.find((w) => w.kind !== "card") ?? ctx.wallets.find((w) => w.kind === "bank") ?? null;
      to = allWallets.find((w) => w.kind === "card") ?? ctx.wallets.find((w) => w.kind === "card") ?? null;
    } else if (sawArrow) {
      from = walletsBefore[0] ?? null;
      to = walletsAfter[0] ?? walletsBefore[1] ?? null;
    } else {
      from = allWallets[0] ?? null;
      to = allWallets[1] ?? null;
    }
    const memo = memoWords.join(" ") || (cardPayment ? "카드값" : "");
    return {
      type: "transfer",
      amount,
      date,
      walletId: from?.id ?? null,
      toWalletId: to && to.id !== from?.id ? to.id : null,
      categoryId: null,
      memo,
      tags,
    };
  }

  const candidates = typeHint ? ctx.categories.filter((c) => c.kind === typeHint) : ctx.categories;
  const match = matchCategory(memoWords, candidates);
  const type: QEType = typeHint ?? match?.category.kind ?? "expense";

  // A typed category name ("식비") is a label, not memo text. Keywords ("김밥") stay in the memo.
  const memo = memoWords.filter((w) => !(match?.exactName && w === match.word)).join(" ");

  const fallbackWallet =
    type === "income"
      ? (ctx.wallets.find((w) => w.kind === "bank") ?? ctx.wallets[0])
      : (ctx.wallets.find((w) => w.id === ctx.defaultWalletId) ?? ctx.wallets[0]);

  return {
    type,
    amount,
    date,
    walletId: walletsBefore[0]?.id ?? fallbackWallet?.id ?? null,
    toWalletId: null,
    categoryId: match?.category.id ?? null,
    memo,
    tags,
  };
}
