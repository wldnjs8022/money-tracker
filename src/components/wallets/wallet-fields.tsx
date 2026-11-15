"use client";

import { WALLET_KIND_LABEL } from "@/components/common";
import { WalletIcon } from "@/components/icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseAmount } from "@/lib/quick-entry";
import type { WalletWithBalance } from "@/server/queries";
import type { Swatch } from "./ledger-kit";

export type WalletKind = WalletWithBalance["kind"];

/** List and picker order: the kinds people have most of first. */
export const KIND_ORDER: readonly WalletKind[] = ["bank", "cash", "card", "invest", "other"];

export const WALLET_COLORS: readonly Swatch[] = [
  { value: "#16a34a", name: "초록" },
  { value: "#2563eb", name: "파랑" },
  { value: "#e11d48", name: "빨강" },
  { value: "#f59e0b", name: "호박색" },
  { value: "#7c3aed", name: "보라" },
  { value: "#0891b2", name: "청록" },
  { value: "#db2777", name: "분홍" },
  { value: "#475569", name: "회색" },
];

/**
 * A typed opening balance → won. Accepts "2,400,000", "240만", "-320000" or "−32만"; blank is 0.
 * Returns null when it isn't an amount.
 */
export function parseWon(text: string): number | null {
  const compact = text.replace(/\s/g, "");
  const negative = /^[-−]/.test(compact);
  const body = compact.replace(/^[-−]/, "");
  if (body === "" || /^[0,]+원?$/.test(body)) return 0;
  const abs = parseAmount(body);
  if (abs === null) return null;
  return negative ? -abs : abs;
}

/** The server's bound for an opening balance (±10조 원). */
const OPENING_LIMIT = 10_000_000_000_000;

/** A typed opening balance → won, or why it can't be saved. */
export function readOpening(text: string): { ok: true; value: number } | { ok: false; error: string } {
  const value = parseWon(text);
  if (value === null) return { ok: false, error: "시작 잔액은 숫자로 적어 주세요." };
  if (Math.abs(value) > OPENING_LIMIT) return { ok: false, error: "시작 잔액이 너무 커요. 10조 원 안쪽으로 적어 주세요." };
  return { ok: true, value };
}

export function formatWonInput(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function openingHelp(kind: WalletKind): string {
  return kind === "card"
    ? "기록을 시작할 때 이미 쓴 카드값이 있으면 마이너스로 적어요. 예: -320000"
    : "기록을 시작할 때의 잔액이에요. 그 뒤로는 기록으로 계산돼요.";
}

export function KindSelect({
  id,
  value,
  color,
  onChange,
}: {
  id: string;
  value: WalletKind;
  color: string;
  onChange: (kind: WalletKind) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as WalletKind)}>
      <SelectTrigger id={id} className="w-full">
        {/* Rendered explicitly so the value shows in the server HTML too, before Radix mounts. */}
        <SelectValue>
          <WalletIcon kind={value} color={color} className="size-6" />
          {WALLET_KIND_LABEL[value]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {KIND_ORDER.map((kind) => (
          <SelectItem key={kind} value={kind}>
            <WalletIcon kind={kind} color={color} className="size-6" />
            {WALLET_KIND_LABEL[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
