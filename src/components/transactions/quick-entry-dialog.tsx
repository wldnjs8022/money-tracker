"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  CircleNotchIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  SparkleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/components/app/ui-provider";
import { Amount, Kbd } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { aiReason, type KeywordSuggestion } from "@/lib/ai-entry";
import { formatDateKo, todayKST } from "@/lib/dates";
import { josa } from "@/lib/josa";
import { formatKRW } from "@/lib/money";
import { parseQuickEntry, type QEResult } from "@/lib/quick-entry";
import { deriveReviewReason, REVIEW_CHIP, type EntryOrigin } from "@/lib/review";
import { cn } from "@/lib/utils";
import { addCategoryKeyword, createTransaction } from "@/server/actions";
import { aiParseQuickEntry, type AiParseResult } from "@/server/ai";
import type { EntryContext } from "@/server/queries";
import { notifyCreated, notifyCreatedMany } from "./notify";
import { NO_WALLETS, NoWalletsNotice } from "./transaction-form";

const EXAMPLES = ["점심 김밥 4500 카드", "스벅 라떼 6500", "월급 3200000", "카드값 450000", "어제 택시 12만5천 #출장"];

const NETWORK_ERROR = "서버에 닿지 못했어요. 연결을 확인하고 다시 해 주세요.";

export function useQuickParse(ctx: EntryContext) {
  const today = todayKST();
  return useMemo(() => {
    const qeCtx = { wallets: ctx.wallets, categories: ctx.categories, today, defaultWalletId: ctx.defaultWalletId };
    return (text: string) => parseQuickEntry(text, qeCtx);
  }, [ctx, today]);
}

/** A draft that has what the server needs, as createTransaction input. */
function toInput(d: QEResult & { amount: number; walletId: string }) {
  return {
    type: d.type,
    amount: d.amount,
    date: d.date,
    walletId: d.walletId,
    toWalletId: d.toWalletId,
    categoryId: d.categoryId,
    memo: d.memo,
    tags: d.tags,
  };
}

function isSaveable(d: QEResult): d is QEResult & { amount: number; walletId: string } {
  return d.amount !== null && d.amount > 0 && d.walletId !== null;
}

/** What a toast calls a draft: the category, "이체", or the memo when there's no category. */
function draftLabel(d: QEResult, ctx: EntryContext): string {
  if (d.type === "transfer") return "이체";
  return ctx.categories.find((c) => c.id === d.categoryId)?.name ?? (d.memo || REVIEW_CHIP.uncategorized);
}

/** Sum of several drafts, only when they are all expenses (adding income to spending means nothing). */
function expenseTotal(drafts: QEResult[]): number | null {
  if (drafts.length === 0 || drafts.some((d) => d.type !== "expense")) return null;
  return drafts.reduce((sum, d) => sum + (d.amount ?? 0), 0);
}

/** The particle alone, for words shown in quotes: particle("김밥", "을", "를") → "을". */
function particle(word: string, withBatchim: string, withoutBatchim: string): string {
  return josa(word, withBatchim, withoutBatchim).slice(word.length);
}

/**
 * Saves a rule-parsed quick entry line (origin "quick", with the typed line as sourceText).
 * Returns an error message, or null on success.
 */
export async function saveQuickEntry(parsed: QEResult, ctx: EntryContext, sourceText: string): Promise<string | null> {
  // Naming a wallet can't help when there is none to match.
  if (ctx.wallets.length === 0) return NO_WALLETS;
  if (!parsed.amount) return "금액을 같이 적어 주세요";
  if (!parsed.walletId) return "어느 계좌인지 적어 주세요 (예: 카드, 현금)";
  const draft = { ...parsed, amount: parsed.amount, walletId: parsed.walletId };
  const result = await createTransaction({ ...toInput(draft), origin: "quick", sourceText });
  if (!result.ok) return result.error;
  notifyCreated(result.data.id, `기록했어요 · ${draftLabel(parsed, ctx)} ${formatKRW(parsed.amount)}`);
  return null;
}

type SaveManyOutcome = { saved: number; remaining: QEResult[]; error: string | null };

/**
 * Saves AI drafts in order (origin "ai"), with one undo toast for everything that was saved.
 * On a failure it stops and hands back the drafts that were not saved, so a retry never
 * creates the saved ones twice.
 */
async function saveMany(drafts: QEResult[], ctx: EntryContext, sourceText: string): Promise<SaveManyOutcome> {
  const ids: string[] = [];
  let error: string | null = null;
  let stoppedAt = drafts.length;

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (!isSaveable(d)) {
      error = "금액이나 계좌가 빠진 줄이 있어요";
      stoppedAt = i;
      break;
    }
    let result: Awaited<ReturnType<typeof createTransaction>>;
    try {
      result = await createTransaction({ ...toInput(d), origin: "ai", sourceText });
    } catch {
      result = { ok: false, error: NETWORK_ERROR };
    }
    if (!result.ok) {
      error = result.error;
      stoppedAt = i;
      break;
    }
    ids.push(result.data.id);
  }

  if (ids.length === 1) {
    const d = drafts[0];
    notifyCreated(ids[0], `기록했어요 · ${draftLabel(d, ctx)} ${formatKRW(d.amount ?? 0)}`);
  } else if (ids.length > 1) {
    const total = expenseTotal(drafts.slice(0, ids.length));
    const label = error ? `${ids.length}건만 기록했어요` : `AI가 정리한 ${ids.length}건을 기록했어요`;
    notifyCreatedMany(ids, total === null ? label : `${label} · ${formatKRW(total)}`);
  }
  return { saved: ids.length, remaining: drafts.slice(stoppedAt), error };
}

export function QuickEntryDialog({ ctx }: { ctx: EntryContext }) {
  const { quickEntryOpen, setQuickEntryOpen } = useUI();
  return (
    <Dialog open={quickEntryOpen} onOpenChange={setQuickEntryOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[16%] flex max-h-[calc(84dvh-1rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">한 줄 입력</DialogTitle>
        <DialogDescription className="sr-only">
          한 줄로 적으면 금액, 분류, 계좌를 알아서 읽어요. Enter로 저장해요.
        </DialogDescription>
        {/* Always rendered: Radix unmounts the content after the close animation, so the entry
            stays visible while it fades out and starts fresh on the next open. */}
        <QuickEntry ctx={ctx} open={quickEntryOpen} onClose={() => setQuickEntryOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

type AiState =
  | { status: "idle" }
  | { status: "loading"; forText: string }
  | { status: "done"; forText: string; result: AiParseResult }
  | { status: "error"; forText: string; message: string };

type KeywordStatus = "saving" | "done";

/** A line whose AI drafts were only partly saved, with the drafts still to save. */
type PartlySaved = { forText: string; result: AiParseResult };

const keywordKey = (s: KeywordSuggestion) => `${s.categoryId}:${s.keyword}`;

function QuickEntry({ ctx, open, onClose }: { ctx: EntryContext; open: boolean; onClose: () => void }) {
  const { openNewTransaction } = useUI();
  const parse = useQuickParse(ctx);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [keywords, setKeywords] = useState<Record<string, KeywordStatus>>({});
  const [partlySaved, setPartlySaved] = useState<PartlySaved | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiRequest = useRef(0);

  const parsed = text.trim() ? parse(text) : null;
  const reason = aiReason(text, parsed);
  // Nothing can be saved, by rules or by AI; the notice says so up front instead of asking for a wallet.
  const noWallets = ctx.wallets.length === 0;

  // An AI answer only counts for the exact text it was asked about; editing the line drops it.
  // After a partial save, the drafts left to save are the only answer this line can have.
  const aiCurrent = "forText" in ai && ai.forText === text ? ai : null;
  const leftover = partlySaved?.forText === text ? partlySaved.result : null;
  const aiResult = leftover ?? (aiCurrent?.status === "done" ? aiCurrent.result : null);
  const aiLoading = aiCurrent?.status === "loading";
  const aiError = aiCurrent?.status === "error" ? aiCurrent.message : null;
  const aiRows = aiResult?.transactions ?? null;

  // Tab carries one draft into the full form; several AI rows can't be carried, so it stays off then.
  const detailDraft = parsed && (!aiRows || aiRows.length <= 1) ? (aiRows?.[0] ?? parsed) : null;
  const canSave = open && !noWallets && !!parsed && !saving && !aiLoading && (aiRows === null || aiRows.length > 0);

  async function runAi() {
    const line = text;
    if (!open || noWallets || !line.trim() || aiLoading || saving) return;
    if (!ctx.aiEnabled) {
      setError("AI를 쓰려면 .env.local에 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작해 주세요.");
      return;
    }
    // A fresh answer would list the rows that already saved again, and the next Enter would duplicate them.
    if (leftover) {
      setError(`이미 일부를 기록했어요. 남은 ${leftover.transactions.length}건은 Enter로 저장해요.`);
      return;
    }
    // The AI button that started this turns into the loading row; keep Enter, Tab and typing working.
    inputRef.current?.focus();
    setError("");
    const request = ++aiRequest.current;
    setAi({ status: "loading", forText: line });
    let next: AiState;
    try {
      const result = await aiParseQuickEntry(line);
      next = result.ok
        ? { status: "done", forText: line, result: result.data }
        : { status: "error", forText: line, message: result.error };
    } catch {
      next = { status: "error", forText: line, message: NETWORK_ERROR };
    }
    // A newer request (for an edited line) replaced this one.
    if (request === aiRequest.current) setAi(next);
  }

  function finish(keepOpen: boolean, count: number) {
    setSavedCount((n) => n + count);
    setPartlySaved(null);
    if (!keepOpen) {
      onClose();
      return;
    }
    setText("");
    setError("");
    setAi({ status: "idle" });
    inputRef.current?.focus();
  }

  async function submit(keepOpen: boolean) {
    // `open` is false while the dialog animates out: a stray Enter then must not save again.
    // Without a wallet the notice already explains; a transfer mustn't open an empty form either.
    if (!open || noWallets || !parsed || saving || aiLoading) return;
    const line = text;

    if (aiResult) {
      if (aiResult.transactions.length === 0) {
        setError("저장할 기록이 없어요. 줄을 고치면 다시 읽어요.");
        return;
      }
      setSaving(true);
      try {
        const outcome = await saveMany(aiResult.transactions, ctx, line);
        if (!outcome.error) {
          finish(keepOpen, outcome.saved);
          return;
        }
        if (outcome.saved > 0) {
          // Keep only the drafts that didn't save, so neither the next Enter nor ⌘Enter can duplicate the rest.
          setPartlySaved({ forText: line, result: { ...aiResult, transactions: outcome.remaining } });
          setSavedCount((n) => n + outcome.saved);
          setError(`${outcome.saved}건은 기록했어요. 남은 ${outcome.remaining.length}건은 저장하지 못했어요: ${outcome.error}`);
        } else {
          setError(outcome.error);
        }
      } catch {
        setError(NETWORK_ERROR);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (parsed.type === "transfer" && (!parsed.walletId || !parsed.toWalletId)) {
      openNewTransaction(parsed);
      return;
    }
    setSaving(true);
    try {
      const message = await saveQuickEntry(parsed, ctx, line);
      if (message) setError(message);
      else finish(keepOpen, 1);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  function openDetail() {
    // While a save is in flight the same draft would be saved twice (once here, once in the form).
    if (!open || saving || !detailDraft) return;
    openNewTransaction(detailDraft);
  }

  async function addKeyword(s: KeywordSuggestion) {
    const key = keywordKey(s);
    if (keywords[key]) return;
    setKeywords((map) => ({ ...map, [key]: "saving" }));
    let message: string | null;
    try {
      const result = await addCategoryKeyword(s.categoryId, s.keyword);
      message = result.ok ? null : result.error;
    } catch {
      message = NETWORK_ERROR;
    }
    if (message) {
      setKeywords((map) => {
        const next = { ...map };
        delete next[key];
        return next;
      });
      toast.error(message);
      return;
    }
    setKeywords((map) => ({ ...map, [key]: "done" }));
    toast.success(
      `'${s.keyword}'${particle(s.keyword, "을", "를")} ${s.categoryName} 키워드로 저장했어요. 다음부터 알아서 나눠요.`,
    );
  }

  // The line and the footer stay put; only the preview scrolls when AI returns many rows.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft px-5">
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-ink-3">
          {aiLoading ? (
            <CircleNotchIcon weight="bold" className="size-[18px] animate-spin" />
          ) : (
            <PencilSimpleLineIcon className="size-5" />
          )}
        </span>
        <input
          ref={inputRef}
          autoFocus
          value={text}
          readOnly={!open}
          aria-label="한 줄 입력"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // let the Korean IME finish the syllable first
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void runAi();
            } else if (e.key === "Enter") {
              e.preventDefault();
              void submit(e.shiftKey);
            } else if (e.key === "Tab" && !e.shiftKey && detailDraft && !saving) {
              e.preventDefault();
              openDetail();
            }
          }}
          placeholder="점심 김밥 4500 카드"
          className="h-full min-w-0 flex-1 bg-transparent text-[20px] font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:font-medium placeholder:text-ink-3"
        />
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="min-h-[156px] space-y-3 px-5 py-4">
          {noWallets && <NoWalletsNotice onNavigate={onClose} />}
          {!parsed ? (
            <Examples
              onPick={(example) => {
                setText(example);
                setError("");
                inputRef.current?.focus();
              }}
            />
          ) : aiResult ? (
            <AiPreview result={aiResult} ctx={ctx} keywords={keywords} onAddKeyword={addKeyword} />
          ) : (
            <>
              <section aria-label="미리보기">
                <p className="mb-1.5 text-xs font-bold text-ink-3">이렇게 기록돼요</p>
                <div className="overflow-hidden rounded-xl border border-line">
                  <DraftRow draft={parsed} ctx={ctx} origin="quick" />
                </div>
              </section>
              {!noWallets && (reason || aiLoading || aiError) && (
                <AiOffer
                  loading={aiLoading}
                  message={aiError ?? reason}
                  isError={!!aiError}
                  enabled={ctx.aiEnabled}
                  onRun={() => void runAi()}
                />
              )}
            </>
          )}
        </div>
      </div>
      {/* Outside the scrolling preview, so it shows even below a long list of AI rows. */}
      {error && (
        <p role="alert" className="flex shrink-0 items-start gap-1.5 px-5 pb-4 text-[13px] font-medium text-destructive">
          <WarningCircleIcon aria-hidden weight="bold" className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft bg-side px-4 py-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {savedCount > 0 && (
            <span className="flex items-center gap-1 font-bold text-foreground">
              <CheckIcon aria-hidden weight="bold" className="size-3.5" />
              {savedCount}건 기록했어요
            </span>
          )}
          <span className="flex items-center gap-1">
            <Kbd>⇧ Enter</Kbd> 저장하고 계속
          </span>
          {ctx.aiEnabled && (
            <span className="flex items-center gap-1">
              <Kbd>⌘ Enter</Kbd> AI로 정리
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" disabled={!open || saving || !detailDraft} onClick={openDetail}>
            자세히
            <Kbd className="text-ink-3">Tab</Kbd>
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void submit(false)}>
            {saving && <CircleNotchIcon aria-hidden weight="bold" className="animate-spin" />}
            {aiRows && aiRows.length > 1 ? `${aiRows.length}건 모두 저장` : "저장"}
            <Kbd>Enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Examples({ onPick }: { onPick: (example: string) => void }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-bold text-ink-3">이렇게 적어 보세요</p>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPick(example)}
            className="inline-flex h-8 items-center rounded-[8px] border border-line bg-card px-2.5 text-[13px] font-medium text-ink-2 transition-colors duration-150 outline-none focus-ring hover:bg-muted hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-3">날짜(어제, 11/2) · 계좌(카드, 현금) · #태그도 같이 적으면 알아서 나눠요.</p>
    </div>
  );
}

/** Shown when the rule parser isn't sure (or AI failed): why, plus the AI button. */
function AiOffer({
  loading,
  message,
  isError,
  enabled,
  onRun,
}: {
  loading: boolean;
  message: string | null;
  isError: boolean;
  enabled: boolean;
  onRun: () => void;
}) {
  if (loading) {
    return (
      <div role="status" className="flex min-h-14 items-center gap-2.5 rounded-[10px] bg-muted px-3.5 text-[13px] font-semibold">
        <CircleNotchIcon aria-hidden weight="bold" className="size-4 animate-spin text-ink-2" />
        AI가 정리하는 중…
      </div>
    );
  }
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-[10px] bg-muted py-2 pr-2 pl-3.5">
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-semibold", isError ? "text-destructive" : "text-foreground")}>{message}</p>
        {!enabled && <p className="mt-0.5 text-xs text-ink-3">AI 정리는 API 키를 넣으면 쓸 수 있어요</p>}
      </div>
      <Button type="button" variant="outline" disabled={!enabled} onClick={onRun} className="shrink-0">
        <SparkleIcon aria-hidden weight="fill" />
        {isError ? "다시 정리" : "AI로 정리"}
        {enabled && <Kbd className="text-ink-3">⌘ Enter</Kbd>}
      </Button>
    </div>
  );
}

/** AI drafts as P rows, with keyword suggestions underneath. */
function AiPreview({
  result,
  ctx,
  keywords,
  onAddKeyword,
}: {
  result: AiParseResult;
  ctx: EntryContext;
  keywords: Record<string, KeywordStatus>;
  onAddKeyword: (s: KeywordSuggestion) => void;
}) {
  const rows = result.transactions;
  const total = rows.length > 1 ? expenseTotal(rows) : null;
  return (
    <section aria-label="AI가 정리한 기록">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant="signal">
          <SparkleIcon aria-hidden weight="fill" />
          AI 정리
        </Badge>
        <span className="text-xs font-bold text-ink-3">
          {rows.length === 0 ? "기록으로 읽을 게 없어요" : rows.length === 1 ? "이렇게 기록돼요" : `${rows.length}건으로 나눴어요`}
        </span>
        {total !== null && (
          <span className="ml-auto text-xs text-ink-3">
            합계 <span className="num font-bold text-foreground">{formatKRW(total)}</span>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center">
          <p className="text-sm font-semibold">{result.note ?? "거래로 읽을 수 있는 내용이 없어요."}</p>
          <p className="mt-1 text-xs text-ink-3">줄을 고치면 다시 읽어요.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line">
          {rows.map((draft, i) => (
            <li key={i}>
              <DraftRow draft={draft} ctx={ctx} origin="ai" />
            </li>
          ))}
        </ul>
      )}

      {result.suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-ink-3">키워드로 기억할까요?</span>
          {result.suggestions.map((s) => {
            const status = keywords[keywordKey(s)];
            const done = status === "done";
            return (
              <button
                key={keywordKey(s)}
                type="button"
                disabled={!!status}
                onClick={() => onAddKeyword(s)}
                aria-label={`'${s.keyword}'${particle(s.keyword, "을", "를")} ${s.categoryName} 키워드로 ${done ? "저장함" : "저장"}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-[8px] border px-2.5 text-[13px] font-semibold transition-colors duration-150 outline-none focus-ring",
                  done
                    ? "border-transparent bg-muted text-foreground"
                    : "border-line bg-card text-ink-2 hover:bg-muted hover:text-foreground disabled:opacity-60",
                )}
              >
                {status === "saving" ? (
                  <CircleNotchIcon aria-hidden weight="bold" className="size-3.5 animate-spin" />
                ) : done ? (
                  <CheckIcon aria-hidden weight="bold" className="size-3.5" />
                ) : (
                  <PlusIcon aria-hidden weight="bold" className="size-3.5" />
                )}
                {s.keyword}
                <ArrowRightIcon aria-hidden className="size-3 text-ink-3" />
                {s.categoryName}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * One draft in the 기록함 row style: status dot (lime when it will land in 확인할 것), memo with the
 * reason chip it will get, "분류 · 계좌 · 날짜 · #태그", and the amount.
 */
function DraftRow({ draft, ctx, origin }: { draft: QEResult; ctx: EntryContext; origin: EntryOrigin }) {
  const isTransfer = draft.type === "transfer";
  const category = ctx.categories.find((c) => c.id === draft.categoryId);
  const wallet = ctx.wallets.find((w) => w.id === draft.walletId);
  const toWallet = ctx.wallets.find((w) => w.id === draft.toWalletId);
  // "새 곳" needs the user's history, so only the server knows it; the rest is known here.
  const reason = deriveReviewReason({ origin, type: draft.type, categoryId: draft.categoryId });

  // Without a category the chip already says "분류 없음", so the sub line doesn't repeat it.
  const kind = isTransfer ? "이체" : (category?.name ?? null);
  const title = draft.memo || kind || "메모 없음";
  const sub = [
    title === kind ? null : kind,
    isTransfer ? `${wallet?.name ?? "보내는 계좌?"} → ${toWallet?.name ?? "받는 계좌?"}` : (wallet?.name ?? "계좌?"),
    formatDateKo(draft.date),
    ...draft.tags.map((tag) => `#${tag}`),
  ].filter(Boolean);

  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
      <span
        className={cn("size-2.5 shrink-0 rounded-full", reason ? "bg-signal ring-3 ring-signal/35" : "bg-dot dark:bg-ink-4/60")}
        role={reason ? "img" : undefined}
        aria-label={reason ? "확인할 것에 들어가요" : undefined}
        aria-hidden={reason ? undefined : true}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
          {reason && <Badge variant="tint">{REVIEW_CHIP[reason]}</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-3">{sub.join(" · ")}</p>
      </div>
      {draft.amount ? (
        <Amount value={draft.amount} type={draft.type} className="text-base" />
      ) : (
        <span className="text-sm font-semibold text-ink-3">금액?</span>
      )}
    </div>
  );
}
