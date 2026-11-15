"use server";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  normalizeAiTransactions,
  normalizeKeywordSuggestions,
  type AiRefs,
  type KeywordSuggestion,
} from "@/lib/ai-entry";
import { todayKST, weekdayKo } from "@/lib/dates";
import type { QEResult } from "@/lib/quick-entry";
import type { ActionResult } from "./actions";
import { AI_MODEL, isAiConfigured, supportsServerFallback } from "./ai-config";
import { getEntryContext } from "./queries";

export type AiParseResult = { transactions: QEResult[]; suggestions: KeywordSuggestion[]; note: string | null };

// Stable instructions first so they can be cached; the user's wallets, categories and text go in the message.
const SYSTEM_PROMPT = `You turn one line of Korean household-ledger text into transactions for a personal 가계부 app.

- One line can hold several purchases ("점심 12000 커피 4500" is two expenses). Split them; never merge or invent any.
- amount: integer won. Read Korean units: 4.5천 = 4500, 1만2천 = 12000, 만원 = 10000.
- type: "expense" by default. "income" for 월급, 급여, 용돈, 환급, 판매, 이자 or a leading "+". "transfer" only when money moves between the user's own wallets: 카드값/카드대금 is bank → card, ATM 출금 is bank → cash.
- date: YYYY-MM-DD. Resolve 오늘, 어제, 그제, weekdays and "11/2" against the given date. Never return a date after it.
- wallet: the ref of the wallet the line names (by name, or by 카드 / 현금 / 통장). If none is named, use the default wallet. For a transfer, wallet is the source and toWallet the destination; otherwise toWallet is null.
- category: the ref of the best category of the same kind (expense categories for expenses, income categories for income). null only when nothing fits; always null for transfers.
- memo: the short description (store or item) without the amount, date or wallet words.
- tags: only words written with #, without the #.
- keywordSuggestions: for each transaction, if the word that decided its category (a store or item name like 올리브영 or 마라탕) is not already a keyword of any category, suggest it. At most 3. Never suggest generic words, amounts or dates.
- If the line is not a transaction at all, return no transactions and put a one-sentence Korean reason in note. Otherwise note is null.`;

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export async function aiParseQuickEntry(input: string): Promise<ActionResult<AiParseResult>> {
  const text = input.trim().slice(0, 300);
  if (!text) return fail("정리할 내용을 입력해 주세요.");
  if (!isAiConfigured()) return fail("AI를 쓰려면 .env.local에 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작해 주세요.");

  const ctx = await getEntryContext(); // resolves the signed-in user
  const today = todayKST();

  // Short refs instead of UUIDs: the schema only allows these, so the model can't invent an id.
  const walletRefs = ctx.wallets.map((w, i) => ({ ref: `W${i + 1}`, ...w }));
  const categoryRefs = ctx.categories.map((c, i) => ({ ref: `C${i + 1}`, ...c }));
  if (walletRefs.length === 0) return fail("먼저 계좌를 하나 만들어 주세요.");

  const refs: AiRefs = {
    wallets: Object.fromEntries(walletRefs.map((w) => [w.ref, { id: w.id, kind: w.kind }])),
    categories: Object.fromEntries(
      categoryRefs.map((c) => [c.ref, { id: c.id, kind: c.kind, name: c.name, keywords: c.keywords }]),
    ),
  };

  const walletRef = z.enum(walletRefs.map((w) => w.ref) as [string, ...string[]]);
  const categoryRef = categoryRefs.length > 0 ? z.enum(categoryRefs.map((c) => c.ref) as [string, ...string[]]) : z.string();
  const schema = z.object({
    transactions: z.array(
      z.object({
        type: z.enum(["expense", "income", "transfer"]),
        amount: z.number(),
        date: z.string(),
        wallet: walletRef.nullable(),
        toWallet: walletRef.nullable(),
        category: categoryRef.nullable(),
        memo: z.string(),
        tags: z.array(z.string()),
      }),
    ),
    keywordSuggestions: z.array(z.object({ category: categoryRef, keyword: z.string() })),
    note: z.string().nullable(),
  });

  const defaultRef = walletRefs.find((w) => w.id === ctx.defaultWalletId)?.ref ?? walletRefs[0].ref;
  const context = [
    `오늘: ${today} (${weekdayKo(today)})`,
    `기본 계좌: ${defaultRef}`,
    "계좌:",
    ...walletRefs.map((w) => `- ${w.ref} ${w.name} (${w.kind})`),
    "카테고리:",
    ...categoryRefs.map(
      (c) => `- ${c.ref} ${c.name} (${c.kind})${c.keywords.length ? ` 키워드: ${c.keywords.slice(0, 20).join(", ")}` : ""}`,
    ),
    "",
    `입력: ${text}`,
  ].join("\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4096,
      // Simple extraction: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // If the model declines, retry on a fallback model inside the same call.
      ...(supportsServerFallback(AI_MODEL)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: context }],
    });

    if (response.stop_reason === "refusal") return fail("AI가 이 내용은 정리하지 못했어요. 직접 입력해 주세요.");
    const parsed = response.parsed_output;
    if (!parsed) return fail("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");

    const transactions = normalizeAiTransactions(parsed.transactions, refs, today, ctx.defaultWalletId);
    const suggestions = normalizeKeywordSuggestions(parsed.keywordSuggestions, refs);
    const note = parsed.note ?? (transactions.length === 0 ? "거래로 읽을 수 있는 내용이 없어요." : null);
    return { ok: true, data: { transactions, suggestions, note } };
  } catch (error) {
    console.error("[ai] quick entry failed", error);
    if (error instanceof Anthropic.AuthenticationError) return fail("API 키가 올바르지 않아요. .env.local을 확인해 주세요.");
    if (error instanceof Anthropic.RateLimitError) return fail("요청이 많아요. 잠시 후 다시 시도해 주세요.");
    if (error instanceof Anthropic.APIConnectionError) return fail("AI 서버에 연결하지 못했어요.");
    if (error instanceof Anthropic.APIError) return fail(`AI 요청이 실패했어요 (${error.status ?? "?"}).`);
    return fail("AI 정리 중 문제가 생겼어요.");
  }
}
