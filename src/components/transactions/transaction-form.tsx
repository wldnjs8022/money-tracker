"use client";

import { ArrowRightIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI, type TransactionDraft } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayKST } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import { parseAmount } from "@/lib/quick-entry";
import { cn } from "@/lib/utils";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/actions";
import type { EntryContext } from "@/server/queries";
import { notifyCreated, notifyDeleted } from "./notify";

export function TransactionFormDialog({ ctx }: { ctx: EntryContext }) {
  const { form, closeForm } = useUI();
  return (
    <Dialog open={form.open} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent className="sm:max-w-lg">
        {form.open && (
          <TransactionForm
            key={form.mode === "edit" ? form.transaction.id : "new"}
            ctx={ctx}
            id={form.mode === "edit" ? form.transaction.id : null}
            initial={form.mode === "edit" ? form.transaction : form.draft}
            onDone={closeForm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  ctx,
  id,
  initial,
  onDone,
}: {
  ctx: EntryContext;
  id: string | null;
  initial?: Partial<TransactionDraft>;
  onDone: () => void;
}) {
  const [type, setType] = useState<TransactionDraft["type"]>(initial?.type ?? "expense");
  const [amountText, setAmountText] = useState(initial?.amount ? initial.amount.toLocaleString("ko-KR") : "");
  const [date, setDate] = useState(initial?.date ?? todayKST());
  const [walletId, setWalletId] = useState(initial?.walletId ?? ctx.defaultWalletId ?? ctx.wallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(initial?.toWalletId ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(" "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText.replace(/\s/g, ""));
  const visibleCategories = useMemo(
    () => (type === "transfer" ? [] : ctx.categories.filter((c) => c.kind === type)),
    [ctx.categories, type],
  );

  // Switching between 지출/수입 ignores a category of the other kind.
  const selectedCategoryId = visibleCategories.some((c) => c.id === categoryId) ? categoryId : null;

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  async function save() {
    if (!amount) {
      setError("금액을 입력해 주세요.");
      amountRef.current?.focus();
      return;
    }
    setPending(true);
    setError("");
    const input = {
      type,
      amount,
      date,
      walletId,
      toWalletId: type === "transfer" ? toWalletId || null : null,
      categoryId: selectedCategoryId,
      memo,
      tags: tagsText.split(/[\s,]+/).filter(Boolean),
    };
    if (id) {
      const result = await updateTransaction(id, input);
      setPending(false);
      if (!result.ok) return setError(result.error);
      toast.success("수정했어요");
    } else {
      const result = await createTransaction(input);
      setPending(false);
      if (!result.ok) return setError(result.error);
      notifyCreated(result.data.id, `기록했어요 · ${formatKRW(amount)}`);
    }
    onDone();
  }

  async function remove() {
    if (!id) return;
    setPending(true);
    const result = await deleteTransaction(id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    notifyDeleted(result.data);
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void save();
        }
      }}
      className="space-y-5"
    >
      <DialogHeader>
        <DialogTitle>{id ? "거래 수정" : "새 거래"}</DialogTitle>
      </DialogHeader>

      <ToggleGroup
        type="single"
        variant="outline"
        value={type}
        onValueChange={(v) => v && setType(v as TransactionDraft["type"])}
        className="w-full"
      >
        <ToggleGroupItem value="expense" className="flex-1">
          지출
        </ToggleGroupItem>
        <ToggleGroupItem value="income" className="flex-1">
          수입
        </ToggleGroupItem>
        <ToggleGroupItem value="transfer" className="flex-1">
          이체
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="space-y-2">
        <Label htmlFor="amount">금액</Label>
        <div className="relative">
          <Input
            id="amount"
            ref={amountRef}
            inputMode="numeric"
            autoComplete="off"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => amount && setAmountText(amount.toLocaleString("ko-KR"))}
            placeholder="4,500 또는 3만5천"
            className="num h-12 pr-10 text-right text-2xl font-semibold"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">원</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">날짜</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={cn("space-y-2", type === "transfer" && "col-span-2")}>
          <Label>{type === "transfer" ? "보내는 계좌 → 받는 계좌" : "계좌"}</Label>
          <div className="flex items-center gap-2">
            <WalletSelect wallets={ctx.wallets} value={walletId} onChange={setWalletId} />
            {type === "transfer" && (
              <>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                <WalletSelect
                  wallets={ctx.wallets.filter((w) => w.id !== walletId)}
                  value={toWalletId}
                  onChange={setToWalletId}
                  placeholder="받는 계좌"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {type !== "transfer" && (
        <div className="space-y-2">
          <Label>카테고리</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {visibleCategories.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id === selectedCategoryId ? null : c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                  c.id === selectedCategoryId && "border-transparent ring-2 ring-brand",
                )}
              >
                <span>{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-2">
          <Label htmlFor="memo">메모</Label>
          <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="어디서, 무엇을" />
        </div>
        <div className="w-40 space-y-2">
          <Label htmlFor="tags">태그</Label>
          <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="출장 여행" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="items-center sm:justify-between">
        {id ? (
          <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2Icon />
            삭제
          </Button>
        ) : (
          <span className="hidden text-xs text-muted-foreground sm:block">
            <Kbd>⌘</Kbd> <Kbd>Enter</Kbd> 저장
          </span>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            저장
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function WalletSelect({
  wallets,
  value,
  onChange,
  placeholder = "계좌 선택",
}: {
  wallets: EntryContext["wallets"];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {wallets.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span className="size-2 rounded-full" style={{ backgroundColor: w.color }} />
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
