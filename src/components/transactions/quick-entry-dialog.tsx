"use client";

import { ArrowRightIcon, CalendarIcon, HashIcon, SparklesIcon, WalletIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useUI } from "@/components/app/ui-provider";
import { Kbd, TYPE_LABEL } from "@/components/common";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDateKo, todayKST } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import { parseQuickEntry, type QEResult } from "@/lib/quick-entry";
import { cn } from "@/lib/utils";
import { createTransaction } from "@/server/actions";
import type { EntryContext } from "@/server/queries";
import { notifyCreated } from "./notify";

const EXAMPLES = ["점심 김밥 4500 카드", "스벅 라떼 6500", "월급 3200000", "카드값 450000", "어제 택시 12만5천 #출장"];

export function useQuickParse(ctx: EntryContext) {
  const today = todayKST();
  return useMemo(() => {
    const qeCtx = { wallets: ctx.wallets, categories: ctx.categories, today, defaultWalletId: ctx.defaultWalletId };
    return (text: string) => parseQuickEntry(text, qeCtx);
  }, [ctx, today]);
}

/** Saves a parsed quick entry. Returns an error message, or null on success. */
export async function saveQuickEntry(parsed: QEResult, ctx: EntryContext): Promise<string | null> {
  if (!parsed.amount) return "금액이 필요해요";
  if (!parsed.walletId) return "계좌를 알 수 없어요";
  const result = await createTransaction({
    type: parsed.type,
    amount: parsed.amount,
    date: parsed.date,
    walletId: parsed.walletId,
    toWalletId: parsed.toWalletId,
    categoryId: parsed.categoryId,
    memo: parsed.memo,
    tags: parsed.tags,
  });
  if (!result.ok) return result.error;
  const category = ctx.categories.find((c) => c.id === parsed.categoryId);
  const what = parsed.type === "transfer" ? "이체" : (category?.name ?? "미분류");
  notifyCreated(result.data.id, `기록했어요 · ${what} ${formatKRW(parsed.amount)}`);
  return null;
}

export function QuickEntryDialog({ ctx }: { ctx: EntryContext }) {
  const { quickEntryOpen, setQuickEntryOpen } = useUI();
  return (
    <Dialog open={quickEntryOpen} onOpenChange={setQuickEntryOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[22%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">빠른 입력</DialogTitle>
        <DialogDescription className="sr-only">한 줄로 거래를 기록하세요</DialogDescription>
        {quickEntryOpen && <QuickEntry ctx={ctx} onClose={() => setQuickEntryOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function QuickEntry({ ctx, onClose }: { ctx: EntryContext; onClose: () => void }) {
  const { openNewTransaction } = useUI();
  const parse = useQuickParse(ctx);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = text.trim() ? parse(text) : null;

  async function submit(keepOpen: boolean) {
    if (!parsed || saving) return;
    if (parsed.type === "transfer" && (!parsed.walletId || !parsed.toWalletId)) {
      openNewTransaction(parsed);
      return;
    }
    setSaving(true);
    const message = await saveQuickEntry(parsed, ctx);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    if (keepOpen) {
      setText("");
      setError("");
      setSavedCount((n) => n + 1);
      inputRef.current?.focus();
    } else {
      onClose();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b px-4">
        <SparklesIcon className="size-5 shrink-0 text-brand" />
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // let the Korean IME finish the syllable first
            if (e.key === "Enter") {
              e.preventDefault();
              void submit(e.shiftKey);
            } else if (e.key === "Tab" && parsed) {
              e.preventDefault();
              openNewTransaction(parsed);
            }
          }}
          placeholder="점심 김밥 4500 카드"
          className="h-14 w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="min-h-28 px-4 py-4">
        {parsed ? (
          <Preview parsed={parsed} ctx={ctx} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">이렇게 써 보세요</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setText(example);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span>{savedCount > 0 ? `${savedCount}건 기록함` : "날짜·계좌·#태그도 같이 쓸 수 있어요"}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> 저장
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⇧ Enter</Kbd> 저장 후 계속
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd> 자세히
          </span>
        </span>
      </div>
    </div>
  );
}

function Preview({ parsed, ctx }: { parsed: QEResult; ctx: EntryContext }) {
  const category = ctx.categories.find((c) => c.id === parsed.categoryId);
  const wallet = ctx.wallets.find((w) => w.id === parsed.walletId);
  const toWallet = ctx.wallets.find((w) => w.id === parsed.toWalletId);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Chip
          className={cn(
            parsed.type === "income" && "bg-income/10 text-income",
            parsed.type === "transfer" && "bg-muted text-transfer",
          )}
        >
          {TYPE_LABEL[parsed.type]}
        </Chip>
        {parsed.type !== "transfer" && (
          <Chip muted={!category}>{category ? `${category.icon} ${category.name}` : "미분류"}</Chip>
        )}
        <Chip muted={!wallet}>
          <WalletIcon className="size-3.5" />
          {wallet?.name ?? "계좌?"}
          {parsed.type === "transfer" && (
            <>
              <ArrowRightIcon className="size-3.5" />
              {toWallet?.name ?? "받는 계좌?"}
            </>
          )}
        </Chip>
        <Chip>
          <CalendarIcon className="size-3.5" />
          {formatDateKo(parsed.date)}
        </Chip>
        {parsed.tags.map((tag) => (
          <Chip key={tag}>
            <HashIcon className="size-3.5" />
            {tag}
          </Chip>
        ))}
        {parsed.memo && <span className="px-1 text-muted-foreground">“{parsed.memo}”</span>}
      </div>
      <div
        className={cn(
          "num shrink-0 text-2xl font-bold",
          !parsed.amount && "text-muted-foreground/50",
          parsed.type === "income" && parsed.amount && "text-income",
        )}
      >
        {parsed.amount ? formatKRW(parsed.amount) : "금액?"}
      </div>
    </div>
  );
}

function Chip({ children, muted, className }: { children: React.ReactNode; muted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium",
        muted && "text-muted-foreground/70 italic",
        className,
      )}
    >
      {children}
    </span>
  );
}
