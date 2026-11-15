"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWallet } from "@/server/actions";
import { attempt, ColorPicker, quoted } from "./ledger-kit";
import { formatWonInput, KindSelect, openingHelp, parseWon, readOpening, WALLET_COLORS, type WalletKind } from "./wallet-fields";

/** "+ 추가" in the wallet list (and ?new=1 from the command palette). */
export function WalletCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The content unmounts after the close animation, so every open starts from a blank form. */}
        <WalletCreateForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function WalletCreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WalletKind>("bank");
  const [opening, setOpening] = useState("");
  const [color, setColor] = useState(WALLET_COLORS[1].value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (pending) return;
    if (!name.trim()) return setError("이름을 적어 주세요.");
    const openingBalance = readOpening(opening);
    if (!openingBalance.ok) return setError(openingBalance.error);
    setPending(true);
    setError("");
    const result = await attempt(() =>
      createWallet({ name, kind, openingBalance: openingBalance.value, color, archived: false }),
    );
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success(`${quoted(name.trim(), "을", "를")} 추가했어요`);
    onCreated(result.data.id);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle>계좌 추가</DialogTitle>
        <DialogDescription>통장, 현금, 카드처럼 돈이 들어 있는 곳을 하나씩 만들어요.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wallet-new-name">이름</Label>
          <Input
            id="wallet-new-name"
            autoFocus
            autoComplete="off"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 토스뱅크, 현대카드"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wallet-new-kind">종류</Label>
          <KindSelect id="wallet-new-kind" value={kind} color={color} onChange={setKind} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wallet-new-opening">시작 잔액</Label>
        <div className="relative">
          <Input
            id="wallet-new-opening"
            inputMode="numeric"
            autoComplete="off"
            aria-describedby="wallet-new-opening-help"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            onBlur={() => {
              const parsed = parseWon(opening);
              if (opening.trim() && parsed !== null) setOpening(formatWonInput(parsed));
            }}
            placeholder="0"
            className="num pr-8 text-right font-semibold"
          />
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">
            원
          </span>
        </div>
        <p id="wallet-new-opening-help" className="text-xs text-ink-3">
          {openingHelp(kind)}
        </p>
      </div>

      <div className="space-y-1.5">
        <p id="wallet-new-color" className="text-xs font-bold text-ink-3">
          색
        </p>
        <ColorPicker swatches={WALLET_COLORS} value={color} onChange={setColor} labelledBy="wallet-new-color" />
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <CircleNotchIcon aria-hidden className="animate-spin" />}
          추가
        </Button>
      </DialogFooter>
    </form>
  );
}
