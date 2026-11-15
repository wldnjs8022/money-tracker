/** How a word ends when read aloud: no final consonant, a final ㄹ (which takes 로, not 으로), or another one. */
export type FinalSound = "none" | "rieul" | "other";

// Digits by their reading: 영, 일, 이, 삼, 사, 오, 육, 칠, 팔, 구. A final 0 always closes on a consonant
// (영, 십, 백, 천, 만), so "1,000" and "10" count as "other" too.
const DIGIT_SOUNDS: readonly FinalSound[] = [
  "other", "rieul", "none", "other", "none", "none", "other", "rieul", "rieul", "none",
];

/**
 * The final sound of the last character as Korean reads it. Hangul uses its own final consonant.
 * A digit is read as a Sino-Korean number ("카드1" 일, "29" 구). Capital letters are read by name
 * ("29CM" 엠, "XL" 엘, "GS" 에스), and only L, M, N and R end in a consonant. A word in lower case
 * reads as an English word instead: final l, m, n or ng keep their consonant (호텔, 스팀, 쿠팡) and
 * the rest, including a silent r (우버), count as a vowel. Anything else counts as a vowel ending.
 */
export function finalSound(word: string): FinalSound {
  const text = word.trim();
  const last = text.at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) {
    const jong = code % 28;
    return jong === 0 ? "none" : jong === 8 ? "rieul" : "other";
  }
  if (/\d/.test(last)) return DIGIT_SOUNDS[Number(last)];
  const letters = /[A-Za-z]+$/.exec(text)?.[0];
  if (!letters) return "none";
  if (letters === letters.toUpperCase()) {
    return /[LR]$/.test(letters) ? "rieul" : /[MN]$/.test(letters) ? "other" : "none";
  }
  const lower = letters.toLowerCase();
  if (lower.endsWith("l")) return "rieul";
  return /(m|n|ng)$/.test(lower) ? "other" : "none";
}

/** Picks the Korean particle by the word's final sound: josa("교통", "이", "가") → "교통이", "29CM을". */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return `${word}${finalSound(word) === "none" ? withoutBatchim : withBatchim}`;
}

/** "식비로", "교통으로", "생활로", "카드1로": 로 after a vowel or ㄹ, 으로 after any other final consonant. */
export function withRo(word: string): string {
  return `${word}${finalSound(word) === "other" ? "으로" : "로"}`;
}

/** ‘신용카드’를 / ‘29CM’을: quotes around the value, particle chosen by how the value ends. */
export function quoted(word: string, withBatchim: string, withoutBatchim: string): string {
  return `‘${word}’${josa(word, withBatchim, withoutBatchim).slice(word.length)}`;
}
