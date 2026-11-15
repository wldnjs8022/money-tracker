"use client";

import {
  ArrowElbowDownLeftIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  PencilSimpleIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { InboxView } from "@/components/app/nav";
import { EmptyState, Kbd, TYPE_LABEL } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addDays, isValidDate, monthOf, todayKST } from "@/lib/dates";
import { passKeyToShortcuts } from "@/lib/hotkeys";
import { parseAmount } from "@/lib/quick-entry";
import { reviewSentence } from "@/lib/review";
import { cn } from "@/lib/utils";
import type { TransactionPatch } from "@/server/actions";
import type { EntryContext, TransactionRow } from "@/server/queries";
import { InsightBlocks, type Insights } from "./insights";
import { fullDateLabel, type KeywordSuggestion } from "./model";

const NONE = "none";
const MAX_TAGS = 10;

/** Inline-edit look shared by the title and the amount: text until hovered or focused. */
const INLINE_FIELD =
  "rounded-[8px] bg-transparent outline-none transition-colors duration-150 hover:bg-muted/70 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

export type DetailHandlers = {
  onSave: (row: TransactionRow, patch: TransactionPatch) => void;
  onConfirm: (row: TransactionRow) => void;
  onOpenCategory: () => void;
  onDuplicate: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
  onEdit: (row: TransactionRow) => void;
  onSaveKeyword: (suggestion: KeywordSuggestion) => Promise<void>;
};

export function DetailPane({
  ref,
  row,
  view,
  filtered,
  ctx,
  today,
  insights,
  titleRef,
  categoryOpen,
  onCategoryOpenChange,
  onCategoryCloseAutoFocus,
  onSelectCloseAutoFocus,
  onBack,
  handlers,
  className,
}: {
  ref?: React.Ref<HTMLElement>;
  row: TransactionRow | null;
  /** Which list is beside it, and whether a search or filter narrows it, for the empty pane's line. */
  view: InboxView;
  filtered: boolean;
  ctx: EntryContext;
  today: string;
  insights: Insights | null;
  titleRef: React.RefObject<HTMLTextAreaElement | null>;
  categoryOpen: boolean;
  onCategoryOpenChange: (open: boolean) => void;
  onCategoryCloseAutoFocus: (event: Event) => void;
  /** For the wallet selects: where focus goes when one closes (not back to its trigger). */
  onSelectCloseAutoFocus: (event: Event) => void;
  onBack: () => void;
  handlers: DetailHandlers;
  className?: string;
}) {
  // "모두 확인했어요" only when the queue itself is empty, not when a search or filter matches nothing.
  const allChecked = view === "review" && !filtered;
  return (
    // tabIndex -1: below 900px the list is hidden while a record shows, so focus that leaves with a
    // record (확인, 지우기) lands here instead of on <body>. Not a field, so J/K/E keep working.
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="기록 상세"
      className={cn("flex min-h-0 min-w-0 flex-col overflow-y-auto outline-none", className)}
    >
      <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-line-soft bg-card px-2 min-[900px]:hidden">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeftIcon aria-hidden />
          목록
        </Button>
      </div>
      {row ? (
        <DetailBody
          key={row.id}
          row={row}
          ctx={ctx}
          today={today}
          insights={insights}
          titleRef={titleRef}
          categoryOpen={categoryOpen}
          onCategoryOpenChange={onCategoryOpenChange}
          onCategoryCloseAutoFocus={onCategoryCloseAutoFocus}
          onSelectCloseAutoFocus={onSelectCloseAutoFocus}
          handlers={handlers}
        />
      ) : (
        // Only when the list is empty (otherwise something is always selected). The list's own
        // empty state carries the actions; this pane just stays quiet.
        <EmptyState
          className="flex-1"
          title={allChecked ? "모두 확인했어요" : "고른 기록이 없어요"}
          description={
            allChecked
              ? "새로 확인할 기록이 생기면 여기서 하나씩 보여 드려요."
              : filtered
                ? "검색어나 필터를 바꾸면 여기서 기록을 볼 수 있어요."
                : "목록에서 기록을 고르면 여기서 바로 고칠 수 있어요."
          }
        />
      )}
    </section>
  );
}

/** Keyed by the record id, so drafts never leak from one record to the next. Nothing autofocuses. */
function DetailBody({
  row,
  ctx,
  today,
  insights,
  titleRef,
  categoryOpen,
  onCategoryOpenChange,
  onCategoryCloseAutoFocus,
  onSelectCloseAutoFocus,
  handlers,
}: {
  row: TransactionRow;
  ctx: EntryContext;
  today: string;
  insights: Insights | null;
  titleRef: React.RefObject<HTMLTextAreaElement | null>;
  categoryOpen: boolean;
  onCategoryOpenChange: (open: boolean) => void;
  onCategoryCloseAutoFocus: (event: Event) => void;
  onSelectCloseAutoFocus: (event: Event) => void;
  handlers: DetailHandlers;
}) {
  const save = (patch: TransactionPatch) => handlers.onSave(row, patch);
  const ids = useId();
  const isTransfer = row.type === "transfer";
  const walletText = isTransfer ? `${row.walletName} → ${row.toWalletName ?? "?"}` : row.walletName;

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-[18px] px-6 pt-[26px] pb-10 min-[900px]:px-8">
      <div className="flex flex-wrap items-center gap-2">
        {row.pending ? (
          <Badge variant="signal" size="lg">
            확인할 것
          </Badge>
        ) : (
          <Badge variant="page" size="lg">
            {row.reviewReason ? "확인함" : TYPE_LABEL[row.type]}
          </Badge>
        )}
        <span className="text-[13px] text-ink-2">{statusSentence(row, today)}</span>
      </div>

      <div>
        <h2>
          <TitleField ref={titleRef} row={row} onSave={save} />
        </h2>
        <AmountField row={row} onSave={save} />
        <p className="mt-1 text-sm text-ink-3">
          {fullDateLabel(row.date, today)} · {walletText}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-[520px]:grid-cols-1">
        {isTransfer ? (
          <TransferWalletsField row={row} ctx={ctx} onCloseAutoFocus={onSelectCloseAutoFocus} onSave={save} />
        ) : (
          <>
            <Field label="분류" htmlFor={`${ids}-category`}>
              <CategoryField
                id={`${ids}-category`}
                row={row}
                ctx={ctx}
                open={categoryOpen}
                onOpenChange={onCategoryOpenChange}
                onCloseAutoFocus={onCategoryCloseAutoFocus}
                onSave={save}
              />
            </Field>
            <Field label="계좌" htmlFor={`${ids}-wallet`}>
              <WalletSelect
                id={`${ids}-wallet`}
                value={row.walletId}
                current={{ id: row.walletId, name: row.walletName, color: row.walletColor }}
                ctx={ctx}
                onCloseAutoFocus={onSelectCloseAutoFocus}
                onChange={(walletId) => save({ walletId })}
              />
            </Field>
          </>
        )}
        <Field label="날짜" htmlFor={`${ids}-date`}>
          <DateField id={`${ids}-date`} row={row} onSave={save} />
        </Field>
        <Field label="태그" labelId={`${ids}-tags`}>
          <TagsField labelId={`${ids}-tags`} row={row} onSave={save} />
        </Field>
        {row.sourceText && (
          <Field label="처음 적은 그대로" className="col-span-full">
            <p className="flex min-h-[42px] items-center gap-2 rounded-[9px] bg-muted px-3 py-2 font-mono text-[13px] break-all">
              <ArrowElbowDownLeftIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
              {row.sourceText}
            </p>
          </Field>
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        {row.pending && (
          <Button variant="signal" size="lg" onClick={() => handlers.onConfirm(row)} aria-keyshortcuts="E">
            <CheckIcon aria-hidden weight="bold" />
            확인
            <Kbd className="ml-0.5">E</Kbd>
          </Button>
        )}
        {!isTransfer && (
          <Button variant="outline" size="lg" onClick={handlers.onOpenCategory} aria-keyshortcuts="C">
            <TagIcon aria-hidden />
            분류 바꾸기
            <Kbd className="ml-0.5 text-ink-3">C</Kbd>
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => handlers.onDuplicate(row)}>
          <CopyIcon aria-hidden />
          복제
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="전체 편집"
              onClick={() => handlers.onEdit(row)}
              className="text-ink-2"
            >
              <PencilSimpleIcon aria-hidden className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>전체 편집 · 종류도 바꿀 수 있어요</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="지우기"
              aria-keyshortcuts="Backspace Delete"
              onClick={() => handlers.onDelete(row)}
              className="text-ink-3"
            >
              <TrashIcon aria-hidden className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            지우기 <Kbd>⌫</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      {insights && (
        <InsightBlocks
          insights={insights}
          onSaveKeyword={handlers.onSaveKeyword}
          className="grid gap-5 border-t border-line-soft pt-6 md:grid-cols-2 xl:hidden"
        />
      )}
    </div>
  );
}

function statusSentence(row: TransactionRow, today: string): string {
  if (row.pending && row.reviewReason) return reviewSentence(row.reviewReason, row.categoryName);
  if (row.reviewReason && row.reviewedAt) {
    const day = todayKST(new Date(row.reviewedAt));
    if (day === today) return "오늘 확인했어요";
    if (day === addDays(today, -1)) return "어제 확인했어요";
    const [, m, d] = day.split("-").map(Number);
    return `${m}월 ${d}일에 확인했어요`;
  }
  if (row.type === "transfer") return "계좌끼리 옮긴 돈이에요";
  return row.sourceText ? "한 줄 입력으로 적은 기록이에요" : "직접 적은 기록이에요";
}

function Field({
  label,
  htmlFor,
  labelId,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label id={labelId} htmlFor={htmlFor} className="mb-[5px]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * The memo as the pane's title. It wraps (a memo runs up to 200 characters) but stays one line of
 * text: Enter saves, Esc puts it back, both leave the field, and pasted line breaks become spaces.
 */
function TitleField({
  row,
  onSave,
  ref,
}: {
  row: TransactionRow;
  onSave: (patch: TransactionPatch) => void;
  ref: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const value = draft ?? row.memo;
  const placeholder = row.type === "transfer" ? "이체" : (row.categoryName ?? "메모 없음");
  useFitHeight(ref, value);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label="메모"
      value={value}
      placeholder={placeholder}
      maxLength={200}
      autoComplete="off"
      enterKeyHint="done"
      onFocus={() => setDraft(row.memo)}
      onChange={(event) => setDraft(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
      onBlur={() => {
        const next = value.trim();
        setDraft(null);
        if (cancelled.current) {
          cancelled.current = false;
          return;
        }
        if (next !== row.memo) onSave({ memo: next });
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          cancelled.current = event.key === "Escape";
          event.currentTarget.blur();
        }
      }}
      className={cn(
        INLINE_FIELD,
        "-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden px-2 py-0.5 text-[28px] leading-tight font-bold tracking-[-0.035em] break-words [field-sizing:content] placeholder:text-ink-3",
      )}
    />
  );
}

/**
 * Grows a one-row textarea with its text where CSS can't (browsers without field-sizing: content):
 * on every change, and when the pane's width changes the wrapping.
 */
function useFitHeight(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, value]);
}

/** 48px amount. Shows "8,500" at rest and raw digits while editing; accepts "1.2만", "8,500원". */
function AmountField({ row, onSave }: { row: TransactionRow; onSave: (patch: TransactionPatch) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const shown = draft ?? row.amount.toLocaleString("ko-KR");
  const sign = row.type === "expense" ? "−" : row.type === "income" ? "+" : "";

  const commit = () => {
    const raw = (draft ?? "").trim();
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft === null || raw === String(row.amount)) return;
    const amount = parseAmount(raw);
    if (amount === null || amount > 1e13) {
      toast.error("금액을 숫자로 적어 주세요");
      return;
    }
    if (amount !== row.amount) onSave({ amount });
  };

  return (
    <div
      className={cn(
        "mt-0.5 flex items-baseline text-[48px] leading-[1.15] font-extrabold tracking-[-0.05em] tabular-nums",
        row.type === "income" && "text-income",
        row.type === "transfer" && "text-ink-3",
      )}
    >
      {sign && <span aria-hidden>{sign}</span>}
      <input
        aria-label={`금액 (${TYPE_LABEL[row.type]})`}
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        size={Math.max(shown.length, 1)}
        onFocus={(event) => {
          setDraft(String(row.amount));
          const input = event.currentTarget;
          requestAnimationFrame(() => input.select());
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            cancelled.current = event.key === "Escape";
            event.currentTarget.blur();
          }
        }}
        className={cn(INLINE_FIELD, "max-w-full min-w-[1ch] px-1 [field-sizing:content]")}
      />
      <span className="ml-0.5">원</span>
    </div>
  );
}

/**
 * A closed Radix Select still runs typeahead on its focused trigger: a printable key picks the first
 * option starting with it, which here saves the record unseen while the same key also runs a page
 * shortcut (K moves on, E confirms). So letters skip the trigger's typeahead and go on to the
 * shortcuts alone (passKeyToShortcuts); Space, Enter and the arrows still open it, and typeahead
 * works in the open list.
 */
function noClosedTypeahead(event: React.KeyboardEvent) {
  if (event.key.length === 1 && event.key !== " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    passKeyToShortcuts(event.nativeEvent);
  }
}

function CategoryField({
  id,
  row,
  ctx,
  open,
  onOpenChange,
  onCloseAutoFocus,
  onSave,
}: {
  id: string;
  row: TransactionRow;
  ctx: EntryContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onSave: (patch: TransactionPatch) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = ctx.categories.filter((c) => c.kind === row.type);
  // A category archived since keeps showing by its stored name.
  const shown = options.find((c) => c.id === row.categoryId);
  const missing = row.categoryId && !shown;

  // Opened from the keyboard (C) the field may sit below the fold; bring it into view first.
  useEffect(() => {
    if (open) triggerRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <Select
      open={open}
      onOpenChange={onOpenChange}
      value={row.categoryId ?? NONE}
      onValueChange={(value) => {
        const categoryId = value === NONE ? null : value;
        if (categoryId !== row.categoryId) onSave({ categoryId });
      }}
    >
      <SelectTrigger ref={triggerRef} id={id} onKeyDown={noClosedTypeahead} className="w-full">
        {/* Rendered here, not left to Radix, so the trigger isn't blank before hydration or on a new record. */}
        <SelectValue>
          {row.categoryId ? (
            <>
              <CategoryIcon icon={shown?.icon ?? row.categoryIcon} color={shown?.color ?? row.categoryColor} className="size-[22px] rounded-[6px]" />
              {shown?.name ?? row.categoryName ?? "보관된 분류"}
            </>
          ) : (
            <>
              <CategoryIcon icon="❔" className="size-[22px] rounded-[6px]" />
              분류 없음
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[min(420px,var(--radix-select-content-available-height))]">
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <CategoryIcon icon={c.icon} color={c.color} className="size-[22px] rounded-[6px]" />
            {c.name}
          </SelectItem>
        ))}
        {missing && (
          <SelectItem value={row.categoryId!} disabled>
            <CategoryIcon icon={row.categoryIcon} color={row.categoryColor} className="size-[22px] rounded-[6px]" />
            {row.categoryName ?? "보관된 분류"}
          </SelectItem>
        )}
        <SelectSeparator />
        <SelectItem value={NONE}>
          <CategoryIcon icon="❔" className="size-[22px] rounded-[6px]" />
          분류 없음
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

type WalletOption = { id: string; name: string; color: string };

/** Active wallets, plus the record's own wallet if it has been archived since (shown, not pickable). */
function WalletSelect({
  id,
  value,
  current,
  ctx,
  exclude,
  onChange,
  onCloseAutoFocus,
  ariaLabel,
}: {
  id?: string;
  value: string | null;
  current: WalletOption | null;
  ctx: EntryContext;
  exclude?: string | null;
  onChange: (walletId: string) => void;
  onCloseAutoFocus: (event: Event) => void;
  ariaLabel?: string;
}) {
  const archived = current && !ctx.wallets.some((w) => w.id === current.id) ? current : null;
  const shown = ctx.wallets.find((w) => w.id === value) ?? (archived?.id === value ? archived : null);
  return (
    <Select value={value ?? undefined} onValueChange={(next) => next !== value && onChange(next)}>
      <SelectTrigger id={id} aria-label={ariaLabel} onKeyDown={noClosedTypeahead} className="w-full min-w-0">
        <SelectValue placeholder="계좌 고르기">
          {shown && (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: shown.color }} />
              {shown.name}
              {shown === archived && " · 보관됨"}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={onCloseAutoFocus}>
        {ctx.wallets.map((w) => (
          <SelectItem key={w.id} value={w.id} disabled={w.id === exclude}>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
            {w.name}
          </SelectItem>
        ))}
        {archived && (
          <SelectItem value={archived.id} disabled>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: archived.color }} />
            {archived.name} · 보관됨
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

function TransferWalletsField({
  row,
  ctx,
  onCloseAutoFocus,
  onSave,
}: {
  row: TransactionRow;
  ctx: EntryContext;
  onCloseAutoFocus: (event: Event) => void;
  onSave: (patch: TransactionPatch) => void;
}) {
  const labelId = useId();
  const to = row.toWalletId
    ? {
        id: row.toWalletId,
        name: row.toWalletName ?? "알 수 없는 계좌",
        // The row carries no colour for the receiving wallet; an archived one gets a neutral dot.
        color: ctx.wallets.find((w) => w.id === row.toWalletId)?.color ?? "var(--ink-4)",
      }
    : null;
  return (
    <div role="group" aria-labelledby={labelId} className="col-span-full min-w-0">
      <Label id={labelId} className="mb-[5px]">
        계좌 · 보내는 곳 → 받는 곳
      </Label>
      <div className="flex items-center gap-2">
        <WalletSelect
          ariaLabel="보내는 계좌"
          value={row.walletId}
          current={{ id: row.walletId, name: row.walletName, color: row.walletColor }}
          exclude={row.toWalletId}
          ctx={ctx}
          onCloseAutoFocus={onCloseAutoFocus}
          onChange={(walletId) => onSave({ walletId })}
        />
        <ArrowRightIcon aria-hidden className="size-4 shrink-0 text-ink-3" />
        <WalletSelect
          ariaLabel="받는 계좌"
          value={row.toWalletId}
          current={to}
          exclude={row.walletId}
          ctx={ctx}
          onCloseAutoFocus={onCloseAutoFocus}
          onChange={(toWalletId) => onSave({ toWalletId })}
        />
      </div>
    </div>
  );
}

/**
 * Native date input. Saves on blur or Enter; Esc puts back the date it had when focused. A new day
 * in the same month also saves shortly after the change, so picking from the calendar saves without
 * leaving the field. A date in another month waits for blur or Enter: typing or stepping through the
 * segments passes through other months and years (11 → 1 → 10, 0002 → 2026), and saving one of those
 * would move the record out of this list mid-edit.
 */
function DateField({
  id,
  row,
  onSave,
}: {
  id: string;
  row: TransactionRow;
  onSave: (patch: TransactionPatch) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelled = useRef(false);
  /** The date when the field took focus, and the last one saved since. */
  const original = useRef(row.date);
  const saved = useRef(row.date);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (value: string) => {
    clearTimeout(timer.current);
    if (isValidDate(value) && value !== saved.current) {
      saved.current = value;
      onSave({ date: value });
    }
  };

  return (
    <Input
      id={id}
      type="date"
      value={draft ?? row.date}
      required
      onFocus={() => {
        original.current = row.date;
        saved.current = row.date;
        setDraft(row.date);
      }}
      onChange={(event) => {
        const value = event.target.value;
        setDraft(value);
        clearTimeout(timer.current);
        if (isValidDate(value) && monthOf(value) === monthOf(row.date)) {
          timer.current = setTimeout(() => commit(value), 700);
        }
      }}
      onBlur={() => {
        clearTimeout(timer.current);
        if (cancelled.current) {
          cancelled.current = false;
          // Undoes a same-month save made while the field had focus.
          commit(original.current);
        } else if (draft !== null) {
          commit(draft);
        }
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          cancelled.current = event.key === "Escape";
          event.currentTarget.blur();
        }
      }}
      className="font-semibold tabular-nums"
    />
  );
}

/** Tag chips with a remove button each, and "+ 추가" that opens a small input (Enter adds). */
function TagsField({
  labelId,
  row,
  onSave,
}: {
  labelId: string;
  row: TransactionRow;
  onSave: (patch: TransactionPatch) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const refocusAdd = useRef(false);

  // Esc unmounts the focused input: "+ 추가" takes focus back once it renders again (the last chip's
  // × when ten tags leave no "+ 추가").
  useLayoutEffect(() => {
    if (adding || !refocusAdd.current) return;
    refocusAdd.current = false;
    (addButton.current ?? [...removeButtons.current.values()].at(-1))?.focus();
  }, [adding]);

  // The chip (and its focused ×) goes away at once, so focus moves to the next chip's ×, else the
  // previous one's, else "+ 추가" (always there once a tag is gone), as in KeywordEditor.
  const remove = (tag: string, index: number) => {
    const neighbor = row.tags[index + 1] ?? row.tags[index - 1];
    onSave({ tags: row.tags.filter((t) => t !== tag) });
    (neighbor === undefined ? addButton.current : removeButtons.current.get(neighbor))?.focus();
  };

  const add = () => {
    const tag = draft.trim().replace(/^#+/, "").trim().slice(0, 30);
    setDraft("");
    if (!tag || row.tags.includes(tag)) return;
    if (row.tags.length >= MAX_TAGS) {
      toast.error(`태그는 ${MAX_TAGS}개까지 달 수 있어요`);
      return;
    }
    onSave({ tags: [...row.tags, tag] });
  };

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-[9px] border border-input bg-card px-2 py-1.5"
    >
      {row.tags.map((tag, index) => (
        <span key={tag} className="inline-flex h-7 items-center gap-0.5 rounded-[6px] bg-muted pr-0.5 pl-2 text-[13px] font-bold">
          #{tag}
          <button
            ref={(el) => {
              if (!el) return;
              removeButtons.current.set(tag, el);
              return () => {
                removeButtons.current.delete(tag);
              };
            }}
            type="button"
            aria-label={`#${tag} 태그 빼기`}
            onClick={() => remove(tag, index)}
            className="flex size-6 items-center justify-center rounded-[5px] text-ink-3 transition-colors hover:bg-card hover:text-foreground"
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          // Opened by a click on "+ 추가", so taking focus here is what the user asked for.
          autoFocus
          aria-label="새 태그"
          value={draft}
          maxLength={31}
          placeholder="태그 입력 후 Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            } else if (event.key === "Escape") {
              event.preventDefault();
              refocusAdd.current = true;
              setDraft("");
              setAdding(false);
            }
          }}
          onBlur={() => {
            // Esc cancels: a blur fired as the input unmounts mustn't add what it had.
            if (!refocusAdd.current) add();
            setAdding(false);
          }}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-ink-3"
        />
      ) : (
        row.tags.length < MAX_TAGS && (
          <button
            ref={addButton}
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[13px] text-ink-3 transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon aria-hidden className="size-3" />
            추가
          </button>
        )
      )}
    </div>
  );
}
