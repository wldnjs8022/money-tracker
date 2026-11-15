"use client";

import { ArchiveIcon, BoxArrowUpIcon, PlusIcon, ReceiptIcon, TrashIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/components/app/ui-provider";
import { EmptyState, WALLET_KIND_LABEL } from "@/components/common";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKRW } from "@/lib/money";
import type { TransactionRow, WalletWithBalance } from "@/server/queries";
import { BigAmount, ColorPicker, InlineTitle, MonthRecords, quoted, RecordsHeader } from "./ledger-kit";
import { formatWonInput, KindSelect, openingHelp, readOpening, WALLET_COLORS } from "./wallet-fields";

export type WalletPatch = Partial<Pick<WalletWithBalance, "name" | "kind" | "color" | "openingBalance" | "archived">>;

function statusSentence(wallet: WalletWithBalance): string {
  if (wallet.archived) return "보관한 계좌예요. 기록할 때 고르는 목록에는 안 나와요";
  if (wallet.kind === "card") return "쓴 만큼 잔액이 내려가요. 카드값을 낼 땐 통장 → 카드 이체로 적어요";
  return "잔액은 시작 잔액에 기록을 더해 자동으로 계산돼요";
}

function actionNote(wallet: WalletWithBalance): string {
  if (wallet.archived) return "다시 꺼내면 기록할 때 고를 수 있어요.";
  if (wallet.txnCount > 0) return "기록이 있는 계좌는 지울 수 없어요. 안 쓰는 계좌는 보관해 두세요.";
  return "보관하면 기록할 때 고르는 목록에서 빠져요.";
}

/**
 * The selected wallet: name (edit in place), balance, kind, opening balance and colour (each saves
 * on change), archive / delete, then this month's records of the wallet.
 */
export function WalletDetail({
  wallet,
  records,
  month,
  today,
  onPatch,
  onToggleArchive,
  onDelete,
}: {
  wallet: WalletWithBalance;
  /** This month's records from or to this wallet, newest first. */
  records: TransactionRow[];
  month: string;
  today: string;
  onPatch: (patch: WalletPatch) => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const { openNewTransaction } = useUI();
  const monthNo = Number(month.slice(5));
  // A card that's been spent on carries debt: show what's owed, not a negative balance.
  const owes = wallet.kind === "card" && wallet.balance < 0;

  let inflow = 0;
  let outflow = 0;
  for (const row of records) {
    if (row.type === "income") inflow += row.amount;
    else if (row.type === "expense") outflow += row.amount;
    else if (row.toWalletId === wallet.id) inflow += row.amount;
    else outflow += row.amount;
  }

  return (
    <section aria-label={`${wallet.name} 상세`} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="flex max-w-3xl flex-col gap-7 px-8 pt-7 pb-14">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="page" size="lg">
              {WALLET_KIND_LABEL[wallet.kind]}
            </Badge>
            {wallet.archived && (
              <Badge variant="outline" size="lg">
                보관함
              </Badge>
            )}
            <span className="text-[13px] text-ink-2">{statusSentence(wallet)}</span>
          </div>

          <div>
            <InlineTitle
              key={`${wallet.id}:${wallet.name}`}
              value={wallet.name}
              label="계좌 이름"
              maxLength={40}
              onSave={(name) => onPatch({ name })}
            />
            <BigAmount className="mt-1">{formatKRW(owes ? -wallet.balance : wallet.balance)}</BigAmount>
            <p className="mt-1 text-sm text-ink-3">
              {owes ? "갚을 카드값" : "지금 잔액"} · 시작 잔액 <span className="num">{formatKRW(wallet.openingBalance)}</span> ·
              기록 <span className="num">{wallet.txnCount.toLocaleString("ko-KR")}</span>건
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wallet-detail-kind">종류</Label>
            <KindSelect
              id="wallet-detail-kind"
              value={wallet.kind}
              color={wallet.color}
              onChange={(kind) => {
                if (kind !== wallet.kind) onPatch({ kind });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-detail-opening">시작 잔액</Label>
            <OpeningBalanceInput
              key={`${wallet.id}:${wallet.openingBalance}`}
              id="wallet-detail-opening"
              describedBy="wallet-detail-opening-help"
              value={wallet.openingBalance}
              onCommit={(openingBalance) => onPatch({ openingBalance })}
            />
            <p id="wallet-detail-opening-help" className="text-xs text-ink-3">
              {openingHelp(wallet.kind)}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <p id="wallet-detail-color" className="text-xs font-bold text-ink-3">
              색
            </p>
            <ColorPicker
              swatches={WALLET_COLORS}
              value={wallet.color}
              onChange={(color) => onPatch({ color })}
              labelledBy="wallet-detail-color"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="outline" size="lg" onClick={onToggleArchive}>
            {wallet.archived ? <BoxArrowUpIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
            {wallet.archived ? "다시 꺼내기" : "보관하기"}
          </Button>
          {wallet.txnCount === 0 && <DeleteWalletButton name={wallet.name} onConfirm={onDelete} />}
          <p className="text-xs text-ink-3">{actionNote(wallet)}</p>
        </div>

        <section aria-labelledby="wallet-records-title" className="space-y-3">
          <RecordsHeader
            id="wallet-records-title"
            title={
              <>
                {monthNo}월 기록 <span className="num font-semibold text-ink-3">{records.length}건</span>
              </>
            }
            summary={
              records.length > 0 ? (
                <>
                  들어온 돈 <span className="num font-semibold text-income">+{formatKRW(inflow)}</span> · 나간 돈{" "}
                  <span className="num font-semibold text-foreground">−{formatKRW(outflow)}</span>
                </>
              ) : undefined
            }
            href={`/transactions?wallet=${wallet.id}`}
          />
          <MonthRecords
            rows={records}
            today={today}
            subline={(row) =>
              row.type === "transfer" ? `${row.walletName} → ${row.toWalletName ?? ""}` : (row.categoryName ?? "분류 없음")
            }
            empty={
              <EmptyState
                icon={<ReceiptIcon aria-hidden />}
                title={`${monthNo}월엔 이 계좌 기록이 없어요`}
                description="이 계좌로 쓰거나 받은 돈을 적으면 여기에 모여요."
                action={
                  wallet.archived ? undefined : (
                    <Button variant="outline" onClick={() => openNewTransaction({ walletId: wallet.id })}>
                      <PlusIcon aria-hidden />이 계좌로 기록하기
                    </Button>
                  )
                }
                className="rounded-xl border border-line-soft py-10"
              />
            }
          />
        </section>
      </div>
    </section>
  );
}

/** Opening balance, edited in place: commits on Enter or blur, Esc puts the old value back. */
function OpeningBalanceInput({
  id,
  describedBy,
  value,
  onCommit,
}: {
  id: string;
  describedBy: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatWonInput(value));
  const cancelled = useRef(false);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(formatWonInput(value));
      return;
    }
    const opening = readOpening(draft);
    if (!opening.ok) {
      toast.error(opening.error);
      setDraft(formatWonInput(value));
      return;
    }
    setDraft(formatWonInput(opening.value));
    if (opening.value !== value) onCommit(opening.value);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-describedby={describedBy}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className="num pr-8 text-right font-semibold"
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">
        원
      </span>
    </div>
  );
}

function DeleteWalletButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg">
          <TrashIcon aria-hidden className="text-ink-3" />
          지우기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{quoted(name, "을", "를")} 지울까요?</AlertDialogTitle>
          <AlertDialogDescription>기록이 하나도 없는 계좌라 바로 지워져요. 지운 계좌는 되돌릴 수 없어요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            지우기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
