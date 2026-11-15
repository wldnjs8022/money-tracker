"use client";

import { CircleNotchIcon, PlusIcon, TrashIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI, type TransactionDraft } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayKST } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import { parseAmount } from "@/lib/quick-entry";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/actions";
import type { EntryContext } from "@/server/queries";
import { notifyCreated, notifyDeleted } from "./notify";

type OpenForm = Extract<ReturnType<typeof useUI>["form"], { open: true }>;
type TxnType = TransactionDraft["type"];
type WalletOption = { id: string; name: string; color: string };
/**
 * What the form starts from. A record being edited may also carry its wallets' names, so an
 * archived wallet (absent from the context) still shows by name.
 */
type FormInitial = Partial<TransactionDraft> & { walletName?: string | null; toWalletName?: string | null };

const TYPES: { value: TxnType; label: string }[] = [
  { value: "expense", label: "지출" },
  { value: "income", label: "수입" },
  { value: "transfer", label: "이체" },
];

/** Select value for "no category" (Radix Select items can't use an empty string). */
const NO_CATEGORY = "none";
const NETWORK_ERROR = "서버에 닿지 못했어요. 연결을 확인하고 다시 해 주세요.";

/** Every record belongs to a wallet, so with no active one nothing can be saved (same words as the AI path). */
export const NO_WALLETS = "먼저 계좌를 하나 만들어 주세요";

/**
 * Said up front in quick entry and the form while there is no active wallet, with the way out:
 * 계좌 opens its add dialog for ?new=1. `onNavigate` closes the dialog this sits in.
 */
export function NoWalletsNotice({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-[10px] bg-muted py-2 pr-2 pl-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{NO_WALLETS}</p>
        <p className="mt-0.5 text-xs text-ink-3">보관한 계좌는 계좌 화면에서 다시 꺼낼 수 있어요</p>
      </div>
      <Button asChild variant="outline" className="shrink-0">
        <Link href="/wallets?new=1" onClick={onNavigate}>
          <PlusIcon aria-hidden />
          계좌 추가
        </Link>
      </Button>
    </div>
  );
}

/** "#출장 " → "출장". */
function cleanTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").slice(0, 30);
}

function addTags(list: string[], raw: string[]): string[] {
  const next = [...list];
  for (const tag of raw.map(cleanTag)) {
    if (tag && !next.includes(tag) && next.length < 10) next.push(tag);
  }
  return next;
}

export function TransactionFormDialog({ ctx }: { ctx: EntryContext }) {
  const { form, closeForm } = useUI();
  // Keep showing the last opened form while the dialog animates out, and remount it on every open
  // so each open starts from its own draft or record.
  const [shown, setShown] = useState<{ form: OpenForm; session: number } | null>(null);
  if (form.open && form !== shown?.form) setShown({ form, session: (shown?.session ?? 0) + 1 });
  const current = form.open ? form : shown?.form;

  return (
    <Dialog open={form.open} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]"
        onCloseAutoFocus={() => {
          // Radix hands focus back to the button that opened the form. When the save or delete took
          // the record out of the inbox list, that button is gone and focus falls to <body>; the
          // inbox's selected row takes it instead, so J/K/E keep working.
          requestAnimationFrame(() => {
            if (document.activeElement && document.activeElement !== document.body) return;
            document.querySelector<HTMLElement>('[data-row-id][aria-current="true"]')?.focus({ preventScroll: true });
          });
        }}
      >
        {current && (
          <TransactionForm
            key={shown?.session ?? 0}
            ctx={ctx}
            open={form.open}
            id={current.mode === "edit" ? current.transaction.id : null}
            initial={current.mode === "edit" ? current.transaction : current.draft}
            prefilled={current.mode === "create" && !!current.draft?.amount}
            onDone={closeForm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  ctx,
  open,
  id,
  initial,
  prefilled,
  onDone,
}: {
  ctx: EntryContext;
  /** False while the dialog animates out; nothing may save then. */
  open: boolean;
  id: string | null;
  initial?: FormInitial;
  /** A new record opened with a draft that already has an amount (e.g. quick entry's Tab). */
  prefilled: boolean;
  onDone: () => void;
}) {
  const fieldId = useId();
  const [type, setType] = useState<TxnType>(initial?.type ?? "expense");
  const [amountText, setAmountText] = useState(initial?.amount ? initial.amount.toLocaleString("ko-KR") : "");
  const [date, setDate] = useState(initial?.date ?? todayKST());
  const [walletId, setWalletId] = useState(initial?.walletId ?? ctx.defaultWalletId ?? ctx.wallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(initial?.toWalletId ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText.replace(/\s/g, ""));
  // Plain digits need no echo; "3만5천" or "₩4,500원" gets the amount it will save as.
  const amountHint = !amountText.trim()
    ? null
    : !amount
      ? "금액을 읽지 못했어요. 4,500이나 3만5천처럼 적어 주세요"
      : /[^\d,\s]/.test(amountText)
        ? `${formatKRW(amount)}으로 저장돼요`
        : null;

  const visibleCategories = useMemo(
    () => (type === "transfer" ? [] : ctx.categories.filter((c) => c.kind === type)),
    [ctx.categories, type],
  );
  // Switching between 지출/수입 ignores a category of the other kind.
  const selectedCategoryId = visibleCategories.some((c) => c.id === categoryId) ? categoryId : null;

  // An archived wallet isn't in the context but can still be on a record being edited. It shows by
  // the record's wallet name; without one, the two sides of a transfer still read differently.
  const walletOptions = useMemo(() => {
    const options: WalletOption[] = ctx.wallets.map(({ id, name, color }) => ({ id, name, color }));
    const archived = [
      { id: initial?.walletId, name: initial?.walletName, side: "보낸 쪽" },
      { id: initial?.toWalletId, name: initial?.toWalletName, side: "받는 쪽" },
    ];
    const unnamed = archived.filter((w) => w.id && !w.name && !options.some((o) => o.id === w.id)).length;
    for (const { id, name, side } of archived) {
      if (!id || options.some((o) => o.id === id)) continue;
      const label = name ? `${name} · 보관됨` : unnamed > 1 ? `보관한 계좌 · ${side}` : "보관한 계좌";
      options.push({ id, name: label, color: "var(--ink-3)" });
    }
    return options;
  }, [ctx.wallets, initial?.walletId, initial?.toWalletId, initial?.walletName, initial?.toWalletName]);
  // Only a new record can have no wallet to pick; the notice says why saving is off.
  const noWallets = walletOptions.length === 0;
  // The receiving wallet can never be the sending one.
  const effectiveToWalletId = toWalletId !== walletId ? toWalletId : "";

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  async function save() {
    if (!open || pending || noWallets) return;
    if (!amount) {
      setError("금액을 입력해 주세요.");
      amountRef.current?.focus();
      return;
    }
    const input = {
      type,
      amount,
      date,
      walletId,
      toWalletId: type === "transfer" ? effectiveToWalletId || null : null,
      categoryId: type === "transfer" ? null : selectedCategoryId,
      memo,
      tags: addTags(tags, [tagDraft]),
    };
    setPending(true);
    setError("");
    try {
      if (id) {
        const result = await updateTransaction(id, input);
        if (!result.ok) return setError(result.error);
        toast.success("고쳤어요");
      } else {
        const result = await createTransaction(input);
        if (!result.ok) return setError(result.error);
        const category = ctx.categories.find((c) => c.id === input.categoryId);
        const what = type === "transfer" ? "이체" : (category?.name ?? memo.trim());
        notifyCreated(result.data.id, `기록했어요 · ${what ? `${what} ` : ""}${formatKRW(amount)}`);
      }
      onDone();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!id || !open || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteTransaction(id);
      if (!result.ok) return setError(result.error);
      notifyDeleted(result.data);
      onDone();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  const description = id
    ? "고친 뒤 저장하면 바로 반영돼요."
    : prefilled
      ? "채워 둔 내용을 확인하고 저장해 주세요."
      : "금액과 계좌만 있으면 저장할 수 있어요.";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void save();
        }
      }}
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle>{id ? "기록 고치기" : "새 기록"}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {noWallets && <NoWalletsNotice onNavigate={onDone} />}

      <ToggleGroup
        type="single"
        value={type}
        onValueChange={(v) => v && setType(v as TxnType)}
        aria-label="종류"
        spacing={1}
        className="h-10 w-full rounded-[10px] bg-muted p-1"
      >
        {TYPES.map(({ value, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="h-full flex-1 rounded-[7px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:font-bold data-[state=on]:shadow-card data-[state=on]:hover:bg-card"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-amount`}>금액</Label>
        <div className="relative">
          <Input
            id={`${fieldId}-amount`}
            ref={amountRef}
            autoComplete="off"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => amount && setAmountText(amount.toLocaleString("ko-KR"))}
            placeholder="4,500 또는 3만5천"
            aria-invalid={(!!error && !amount) || undefined}
            aria-describedby={amountHint ? `${fieldId}-amount-hint` : undefined}
            className="num h-14 pr-10 text-[28px] font-extrabold tracking-[-0.04em] placeholder:text-lg placeholder:font-medium placeholder:tracking-normal md:text-[28px]"
          />
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-base font-bold text-ink-3">
            원
          </span>
        </div>
        {amountHint && (
          <p id={`${fieldId}-amount-hint`} aria-live="polite" className="text-xs text-ink-3">
            {amountHint}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-memo`}>메모</Label>
        <Input
          id={`${fieldId}-memo`}
          value={memo}
          maxLength={200}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="어디서, 무엇을"
        />
      </div>

      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {type === "transfer" ? (
          <>
            <Field label="보내는 계좌" htmlFor={`${fieldId}-wallet`}>
              <WalletSelect id={`${fieldId}-wallet`} wallets={walletOptions} value={walletId} onChange={setWalletId} />
            </Field>
            <Field label="받는 계좌" htmlFor={`${fieldId}-to-wallet`}>
              <WalletSelect
                id={`${fieldId}-to-wallet`}
                wallets={walletOptions.filter((w) => w.id !== walletId)}
                value={effectiveToWalletId}
                onChange={setToWalletId}
                placeholder="받는 계좌 선택"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="분류" htmlFor={`${fieldId}-category`}>
              <CategorySelect
                id={`${fieldId}-category`}
                categories={visibleCategories}
                value={selectedCategoryId}
                onChange={setCategoryId}
              />
            </Field>
            <Field label="계좌" htmlFor={`${fieldId}-wallet`}>
              <WalletSelect id={`${fieldId}-wallet`} wallets={walletOptions} value={walletId} onChange={setWalletId} />
            </Field>
          </>
        )}
        <Field label="날짜" htmlFor={`${fieldId}-date`}>
          <Input id={`${fieldId}-date`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="태그" htmlFor={`${fieldId}-tags`}>
          <TagInput id={`${fieldId}-tags`} tags={tags} onTagsChange={setTags} draft={tagDraft} onDraftChange={setTagDraft} />
        </Field>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-destructive">
          <WarningCircleIcon aria-hidden weight="bold" className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}

      <DialogFooter className="sm:items-center sm:justify-between">
        {id ? (
          <Button type="button" variant="destructive" onClick={() => void remove()} disabled={pending}>
            <TrashIcon aria-hidden />
            지우기
          </Button>
        ) : (
          <p className="hidden items-center gap-1 text-xs text-ink-3 sm:flex">
            <Kbd>⌘ Enter</Kbd> 저장
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" disabled={pending || noWallets}>
            {pending && <CircleNotchIcon aria-hidden weight="bold" className="animate-spin" />}
            저장
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function CategorySelect({
  id,
  categories,
  value,
  onChange,
}: {
  id: string;
  categories: EntryContext["categories"];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const shown = categories.find((c) => c.id === value);
  return (
    <Select value={value ?? NO_CATEGORY} onValueChange={(v) => onChange(v === NO_CATEGORY ? null : v)}>
      <SelectTrigger id={id} className="w-full">
        {/* Rendered here, not left to Radix, so the trigger is never blank for a frame. */}
        <SelectValue>
          {shown ? (
            <>
              <CategoryIcon icon={shown.icon} color={shown.color} className="size-[22px] rounded-[6px]" />
              {shown.name}
            </>
          ) : (
            <>
              <span aria-hidden className="size-[22px] shrink-0 rounded-[6px] border border-dashed border-line" />
              <span className="text-ink-3">분류 없음</span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>
          <span aria-hidden className="size-[22px] shrink-0 rounded-[6px] border border-dashed border-line" />
          <span className="text-ink-3">분류 없음</span>
        </SelectItem>
        {categories.length > 0 && <SelectSeparator />}
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <CategoryIcon icon={c.icon} color={c.color} className="size-[22px] rounded-[6px]" />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WalletSelect({
  id,
  wallets,
  value,
  onChange,
  placeholder = "계좌 선택",
}: {
  id: string;
  wallets: WalletOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const shown = wallets.find((w) => w.id === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {shown && (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: shown.color }} />
              {shown.name}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {wallets.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Tags as chips plus an inline input. Space, comma or Enter turns the typed word into a chip;
 * Backspace in an empty input takes the last chip back. Enter with nothing typed submits the form.
 */
function TagInput({
  id,
  tags,
  onTagsChange,
  draft,
  onDraftChange,
}: {
  id: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(words: string[], rest: string) {
    onTagsChange(addTags(tags, words));
    onDraftChange(rest);
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-[9px] border border-input bg-card px-2 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/12"
    >
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-0.5 rounded-[6px] bg-muted pr-0.5 pl-2 text-[13px] font-bold">
          #{tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTagsChange(tags.filter((t) => t !== tag));
            }}
            aria-label={`${tag} 태그 빼기`}
            className="flex size-5 items-center justify-center rounded-[4px] text-ink-3 transition-colors outline-none focus-ring hover:bg-card hover:text-foreground"
          >
            <XIcon aria-hidden weight="bold" className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        autoComplete="off"
        onChange={(e) => {
          const parts = e.target.value.split(/[\s,]+/);
          if (parts.length > 1) commit(parts.slice(0, -1), parts.at(-1) ?? "");
          else onDraftChange(e.target.value);
        }}
        onBlur={() => draft.trim() && commit([draft], "")}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && draft.trim()) {
            e.preventDefault();
            commit([draft], "");
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            e.preventDefault();
            onTagsChange(tags.slice(0, -1));
          }
        }}
        placeholder={tags.length > 0 ? "+ 추가" : "출장, 여행"}
        className="h-6 min-w-16 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

