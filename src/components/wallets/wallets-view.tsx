"use client";

import { CaretRightIcon, PlusIcon, WalletIcon as WalletGlyph } from "@phosphor-icons/react";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState, FullBleed, PaneHeader, WALLET_KIND_LABEL } from "@/components/common";
import { WalletIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/lib/hotkeys";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteWallet, updateWallet } from "@/server/actions";
import type { TransactionRow, WalletWithBalance } from "@/server/queries";
import {
  attempt,
  ListKeysHint,
  ListRow,
  quoted,
  useCreateDialog,
  useListNavigation,
  useMirrorSelection,
  useSelection,
} from "./ledger-kit";
import { WalletCreateDialog } from "./wallet-create-dialog";
import { WalletDetail, type WalletPatch } from "./wallet-detail";
import { KIND_ORDER } from "./wallet-fields";

const PATH = "/wallets";

type OptimisticChange = { id: string; patch: WalletPatch } | { id: string; removed: true };

function applyPatch(wallet: WalletWithBalance, patch: WalletPatch): WalletWithBalance {
  const next = { ...wallet, ...patch };
  // The balance is the opening balance plus records, so it moves with the opening balance.
  if (patch.openingBalance !== undefined) next.balance = wallet.balance + patch.openingBalance - wallet.openingBalance;
  return next;
}

/**
 * 계좌 screen. Left: wallets grouped by kind with their balances, archived ones folded away, net worth
 * (assets − debts, every wallet as on 홈) at the bottom. Right: the selected wallet. The selection is
 * client state mirrored to ?id=; edits are optimistic and the server's refresh() brings the
 * confirmed data.
 */
export function WalletsView({
  wallets,
  records,
  month,
  today,
}: {
  wallets: WalletWithBalance[];
  /** This month's records of every wallet. */
  records: TransactionRow[];
  month: string;
  today: string;
}) {
  const [items, addOptimistic] = useOptimistic(wallets, (list: WalletWithBalance[], change: OptimisticChange) =>
    "removed" in change
      ? list.filter((w) => w.id !== change.id)
      : list.map((w) => (w.id === change.id ? applyPatch(w, change.patch) : w)),
  );
  const [, startTransition] = useTransition();
  const [selectedId, select] = useSelection(PATH);
  const [createOpen, setCreateOpen] = useCreateDialog(PATH);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Set when a delete takes the detail (and its confirm dialog) away: focus goes to this row next.
  const focusAfterRemoval = useRef<string | null | undefined>(undefined);

  // The same rows listTransactions({ month, walletId }) gives: records from or to the wallet.
  const recordsByWallet = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    const add = (walletId: string, row: TransactionRow) => {
      const list = map.get(walletId);
      if (list) list.push(row);
      else map.set(walletId, [row]);
    };
    for (const row of records) {
      add(row.walletId, row);
      if (row.toWalletId) add(row.toWalletId, row);
    }
    return map;
  }, [records]);

  const active = items.filter((w) => !w.archived);
  const archived = items.filter((w) => w.archived);
  const groups = KIND_ORDER.map((kind) => ({ kind, wallets: active.filter((w) => w.kind === kind) })).filter(
    (group) => group.wallets.length > 0,
  );
  const ordered = groups.flatMap((group) => group.wallets);
  const selected = items.find((w) => w.id === selectedId) ?? ordered[0] ?? archived[0] ?? null;
  const showArchived = archivedOpen || selected?.archived === true;
  const visibleIds = [...ordered, ...(showArchived ? archived : [])].map((w) => w.id);
  useMirrorSelection(PATH, selected?.id ?? null, wallets);

  // Net worth counts every wallet, archived ones too (as 홈 does): money left in a retired account
  // is still yours. The archived part is named under the total, since that section is folded.
  const netWorth = items.reduce((sum, w) => sum + w.balance, 0);
  const assets = items.reduce((sum, w) => sum + Math.max(0, w.balance), 0);
  const debts = items.reduce((sum, w) => sum + Math.max(0, -w.balance), 0);
  const archivedBalance = archived.reduce((sum, w) => sum + w.balance, 0);

  const { listRef, move, onKeyDown: onListKeyDown } = useListNavigation(
    visibleIds,
    selected?.id ?? null,
    select,
    selected?.archived ? "archived" : (selected?.kind ?? ""),
  );
  useHotkeys({ j: () => move("next"), k: () => move("prev") });

  useEffect(() => {
    const target = focusAfterRemoval.current;
    if (target === undefined) return;
    focusAfterRemoval.current = undefined;
    const row = target ? listRef.current?.querySelector<HTMLElement>(`[data-row-id="${target}"]`) : null;
    (row ?? addButtonRef.current)?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  });

  function patchWallet(wallet: WalletWithBalance, patch: WalletPatch, onSaved?: () => void) {
    // Pin the selection first: archiving or a new kind moves the row, and a selection that was only
    // "the first wallet" would otherwise jump to whichever wallet is first now.
    if (selectedId !== wallet.id) select(wallet.id);
    startTransition(async () => {
      addOptimistic({ id: wallet.id, patch });
      const next = applyPatch(wallet, patch);
      const result = await attempt(() =>
        updateWallet(wallet.id, {
          name: next.name,
          kind: next.kind,
          openingBalance: next.openingBalance,
          color: next.color,
          archived: next.archived,
        }),
      );
      if (!result.ok) toast.error(result.error);
      else onSaved?.();
    });
  }

  function toggleArchive(wallet: WalletWithBalance) {
    const archive = !wallet.archived;
    // Keep the wallet in view after it moves into the archived section.
    if (archive) setArchivedOpen(true);
    patchWallet(wallet, { archived: archive }, () =>
      toast.success(`${quoted(wallet.name, "을", "를")} ${archive ? "보관했어요" : "다시 꺼냈어요"}`),
    );
  }

  // Gone from the list at once, with the selection (and focus) on its neighbour; the wallet comes
  // back, selected, if the server refuses.
  function removeWallet(wallet: WalletWithBalance) {
    const at = visibleIds.indexOf(wallet.id);
    const neighbor = visibleIds[at + 1] ?? visibleIds[at - 1] ?? null;
    select(neighbor);
    focusAfterRemoval.current = neighbor;
    startTransition(async () => {
      addOptimistic({ id: wallet.id, removed: true });
      const result = await attempt(() => deleteWallet(wallet.id));
      if (!result.ok) {
        toast.error(result.error);
        select(wallet.id);
        return;
      }
      toast.success(`${quoted(wallet.name, "을", "를")} 지웠어요`);
    });
  }

  function toggleArchivedSection() {
    if (!showArchived) return setArchivedOpen(true);
    setArchivedOpen(false);
    if (selected?.archived) select(ordered[0]?.id ?? null);
  }

  const row = (wallet: WalletWithBalance) => {
    const count = recordsByWallet.get(wallet.id)?.length ?? 0;
    return (
      <ListRow key={wallet.id} id={wallet.id} selected={wallet.id === selected?.id} onSelect={select}>
        <WalletIcon kind={wallet.kind} color={wallet.color} className="size-8" />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold", wallet.archived && "text-ink-2")}>{wallet.name}</span>
          <span className="block truncate text-xs text-ink-3">{count > 0 ? `이번 달 ${count}건` : "이번 달 기록 없음"}</span>
        </span>
        <span className="num shrink-0 font-bold">{formatKRW(wallet.balance)}</span>
      </ListRow>
    );
  };

  return (
    <FullBleed>
      <section aria-label="계좌 목록" className="flex w-[300px] shrink-0 flex-col border-r border-line-soft lg:w-[340px]">
        <PaneHeader title="계좌">
          <Button ref={addButtonRef} variant="outline" aria-label="계좌 추가" onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden />
            추가
          </Button>
        </PaneHeader>

        <div ref={listRef} onKeyDown={onListKeyDown} className="min-h-0 flex-1 overflow-y-auto pb-3">
          {items.length === 0 ? (
            <EmptyState
              icon={<WalletGlyph aria-hidden />}
              title="아직 계좌가 없어요"
              description="통장이나 카드를 하나 만들면 기록을 시작할 수 있어요."
            />
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.kind} role="group" aria-labelledby={`wallet-group-${group.kind}`}>
                  <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1.5 text-xs font-bold text-ink-3">
                    <span id={`wallet-group-${group.kind}`}>{WALLET_KIND_LABEL[group.kind]}</span>
                    {group.wallets.length > 1 && (
                      <span className="num">{formatKRW(group.wallets.reduce((sum, w) => sum + w.balance, 0))}</span>
                    )}
                  </div>
                  {group.wallets.map(row)}
                </div>
              ))}
              {archived.length > 0 && (
                <div className="mt-3 border-t border-line-soft">
                  <button
                    type="button"
                    aria-expanded={showArchived}
                    onClick={toggleArchivedSection}
                    className="flex h-10 w-full items-center gap-2 px-4 text-xs font-bold text-ink-3 transition-colors duration-150 hover:text-foreground focus-visible:outline-offset-[-2px]"
                  >
                    <CaretRightIcon
                      aria-hidden
                      weight="bold"
                      className={cn("size-3 transition-transform duration-150", showArchived && "rotate-90")}
                    />
                    보관한 계좌
                    <span className="num font-semibold">{archived.length}</span>
                  </button>
                  {showArchived && <div role="group" aria-label="보관한 계좌">{archived.map(row)}</div>}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 space-y-2.5 border-t border-line-soft px-5 py-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-ink-3">순자산</span>
              <span className="text-xl font-extrabold tracking-[-0.03em] tabular-nums">{formatKRW(netWorth)}</span>
            </div>
            <div className="mt-0.5 flex justify-between gap-3 text-xs text-ink-3">
              <span>
                자산 <span className="num">{formatKRW(assets)}</span>
              </span>
              <span>
                부채 <span className="num">{formatKRW(debts)}</span>
              </span>
            </div>
            {archivedBalance !== 0 && (
              <p className="mt-0.5 text-right text-xs text-ink-3">
                보관한 계좌 <span className="num">{formatKRW(archivedBalance)}</span> 포함
              </p>
            )}
          </div>
          {visibleIds.length > 1 && <ListKeysHint />}
        </footer>
      </section>

      {selected ? (
        <WalletDetail
          key={selected.id}
          wallet={selected}
          records={recordsByWallet.get(selected.id) ?? []}
          month={month}
          today={today}
          onPatch={(patch) => patchWallet(selected, patch)}
          onToggleArchive={() => toggleArchive(selected)}
          onDelete={() => removeWallet(selected)}
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<WalletGlyph aria-hidden />}
            title="계좌를 만들어 볼까요?"
            description="잔액은 시작 잔액에 기록을 더해 자동으로 계산돼요. 카드값 납부는 통장 → 카드 이체로 적어요."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon aria-hidden />
                계좌 추가
              </Button>
            }
          />
        </div>
      )}

      <WalletCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          select(id);
        }}
      />
    </FullBleed>
  );
}
