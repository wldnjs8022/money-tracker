"use client";

import { ArchiveIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { WALLET_KIND_LABEL } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatKRW } from "@/lib/money";
import { parseAmount } from "@/lib/quick-entry";
import { cn } from "@/lib/utils";
import { createWallet, deleteWallet, updateWallet } from "@/server/actions";
import type { WalletWithBalance } from "@/server/queries";

const COLORS = ["#16a34a", "#2563eb", "#e11d48", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#475569"];
type Kind = WalletWithBalance["kind"];

export function WalletsView({ wallets, startWithNew }: { wallets: WalletWithBalance[]; startWithNew: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<WalletWithBalance | "new" | null>(startWithNew ? "new" : null);

  const close = () => {
    setEditing(null);
    if (startWithNew) router.replace(pathname);
  };

  const active = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          계좌 추가
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {active.map((w) => (
          <WalletCard key={w.id} wallet={w} onEdit={() => setEditing(w)} />
        ))}
      </div>
      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ArchiveIcon className="size-4" />
            보관한 계좌
          </h2>
          <div className="grid grid-cols-2 gap-4 opacity-60 xl:grid-cols-3">
            {archived.map((w) => (
              <WalletCard key={w.id} wallet={w} onEdit={() => setEditing(w)} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          {editing && <WalletForm wallet={editing === "new" ? null : editing} onDone={close} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function WalletCard({ wallet, onEdit }: { wallet: WalletWithBalance; onEdit: () => void }) {
  const isCard = wallet.kind === "card";
  return (
    <Card className="group relative gap-0 overflow-hidden py-0">
      <div className="h-1.5" style={{ backgroundColor: wallet.color }} />
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{wallet.name}</p>
            <p className="text-xs text-muted-foreground">{WALLET_KIND_LABEL[wallet.kind]}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onEdit} className="opacity-0 group-hover:opacity-100" aria-label="편집">
            <PencilIcon />
          </Button>
        </div>
        <div>
          <p className={cn("num text-2xl font-bold tracking-tight", wallet.balance < 0 && "text-expense")}>
            {formatKRW(wallet.balance)}
          </p>
          <p className="text-xs text-muted-foreground">
            {isCard && wallet.balance < 0 ? "갚아야 할 카드값" : "현재 잔액"}
          </p>
        </div>
        <Link
          href={`/transactions?wallet=${wallet.id}`}
          className="block text-xs text-muted-foreground hover:text-foreground"
        >
          거래 {wallet.txnCount}건 보기 ›
        </Link>
      </CardContent>
    </Card>
  );
}

function WalletForm({ wallet, onDone }: { wallet: WalletWithBalance | null; onDone: () => void }) {
  const [name, setName] = useState(wallet?.name ?? "");
  const [kind, setKind] = useState<Kind>(wallet?.kind ?? "bank");
  const [opening, setOpening] = useState(wallet ? wallet.openingBalance.toLocaleString("ko-KR") : "");
  const [color, setColor] = useState(wallet?.color ?? COLORS[1]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const negative = opening.trim().startsWith("-") || opening.trim().startsWith("−");
  const openingAbs = parseAmount(opening.replace(/^[-−]/, "").replace(/\s/g, "")) ?? 0;
  const openingBalance = negative ? -openingAbs : openingAbs;

  async function save(archived = wallet?.archived ?? false) {
    setPending(true);
    setError("");
    const input = { name, kind, openingBalance, color, archived };
    const result = wallet ? await updateWallet(wallet.id, input) : await createWallet(input);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success(wallet ? (archived !== wallet.archived ? (archived ? "보관했어요" : "다시 꺼냈어요") : "저장했어요") : "계좌를 추가했어요");
    onDone();
  }

  async function remove() {
    if (!wallet) return;
    setPending(true);
    const result = await deleteWallet(wallet.id);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success("삭제했어요");
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <DialogHeader>
        <DialogTitle>{wallet ? "계좌 편집" : "계좌 추가"}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="wallet-name">이름</Label>
          <Input id="wallet-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 토스뱅크, 현대카드" />
        </div>
        <div className="space-y-2">
          <Label>종류</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WALLET_KIND_LABEL) as Kind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {WALLET_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wallet-opening">시작 잔액</Label>
        <div className="relative">
          <Input
            id="wallet-opening"
            inputMode="numeric"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            onBlur={() => opening && setOpening(openingBalance.toLocaleString("ko-KR"))}
            placeholder="0"
            className="num pr-8 text-right"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">원</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {kind === "card"
            ? "기록을 시작하는 시점에 이미 쓴 카드값이 있으면 마이너스로 적어요. 예: -320000"
            : "기록을 시작하는 시점의 잔액이에요. 이후 잔액은 거래로 자동 계산돼요."}
        </p>
      </div>

      <div className="space-y-2">
        <Label>색</Label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-background", c === color && "ring-2 ring-foreground")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="items-center sm:justify-between">
        <div className="flex gap-1">
          {wallet && wallet.txnCount === 0 && (
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              <Trash2Icon />
              삭제
            </Button>
          )}
          {wallet && (
            <Button type="button" variant="ghost" onClick={() => save(!wallet.archived)} disabled={pending}>
              <ArchiveIcon />
              {wallet.archived ? "보관 해제" : "보관"}
            </Button>
          )}
        </div>
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
