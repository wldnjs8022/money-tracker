"use client";

import { ArrowRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/components/app/ui-provider";
import { Amount, CategoryIcon, Kbd } from "@/components/common";
import { formatDateKo, isWeekend } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import { useHotkeys } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { deleteTransaction } from "@/server/actions";
import type { TransactionRow } from "@/server/queries";
import { notifyDeleted } from "./notify";

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const { openEditTransaction, setQuickEntryOpen } = useUI();
  const [selectedRaw, setSelected] = useState<number>(-1);
  // Clamp instead of syncing in an effect: the list can shrink after a filter or delete.
  const selected = Math.min(selectedRaw, rows.length - 1);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const groups = useMemo(() => {
    const byDate = new Map<string, { rows: { row: TransactionRow; index: number }[]; expense: number; income: number }>();
    rows.forEach((row, index) => {
      const g = byDate.get(row.date) ?? { rows: [], expense: 0, income: 0 };
      g.rows.push({ row, index });
      if (row.type === "expense") g.expense += row.amount;
      if (row.type === "income") g.income += row.amount;
      byDate.set(row.date, g);
    });
    return [...byDate.entries()];
  }, [rows]);

  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const edit = (row: TransactionRow) =>
    openEditTransaction({
      id: row.id,
      type: row.type,
      amount: row.amount,
      date: row.date,
      walletId: row.walletId,
      toWalletId: row.toWalletId,
      categoryId: row.categoryId,
      memo: row.memo,
      tags: row.tags,
    });

  async function remove(row: TransactionRow) {
    const result = await deleteTransaction(row.id);
    if (result.ok) notifyDeleted(result.data);
    else toast.error(result.error);
  }

  const move = (delta: number) => setSelected(Math.min(rows.length - 1, Math.max(0, selected + delta)));
  useHotkeys({
    j: () => move(1),
    ArrowDown: () => move(1),
    k: () => move(-1),
    ArrowUp: () => move(-1),
    Enter: () => rows[selected] && edit(rows[selected]),
    e: () => rows[selected] && edit(rows[selected]),
    Backspace: () => rows[selected] && void remove(rows[selected]),
    Delete: () => rows[selected] && void remove(rows[selected]),
    Escape: () => setSelected(-1),
  });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <span className="text-3xl">🗒️</span>
        <p className="text-sm text-muted-foreground">이 조건에 맞는 거래가 없어요.</p>
        <button
          type="button"
          onClick={() => setQuickEntryOpen(true)}
          className="text-sm font-medium text-brand hover:underline"
        >
          <Kbd>N</Kbd> 눌러서 기록하기
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {groups.map(([date, group]) => (
        <section key={date}>
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-muted/60 px-4 py-2 text-xs font-medium backdrop-blur">
            <span className={cn(isWeekend(date) && "text-expense")}>{formatDateKo(date)}</span>
            <span className="num flex gap-3 text-muted-foreground">
              {group.income > 0 && <span className="text-income">+{formatKRW(group.income)}</span>}
              {group.expense > 0 && <span>−{formatKRW(group.expense)}</span>}
            </span>
          </header>
          {group.rows.map(({ row, index }) => (
            <div
              key={row.id}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              role="button"
              tabIndex={-1}
              onClick={() => {
                setSelected(index);
                edit(row);
              }}
              onMouseEnter={() => setSelected(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 last:border-b-0",
                index === selected && "bg-accent",
              )}
            >
              <CategoryIcon
                icon={row.type === "transfer" ? "↔" : (row.categoryIcon ?? "❔")}
                color={row.type === "transfer" ? null : row.categoryColor}
              />
              <div className="w-28 shrink-0 text-sm">
                {row.type === "transfer" ? (
                  <span className="text-muted-foreground">이체</span>
                ) : (
                  <span className={cn(!row.categoryName && "text-muted-foreground italic")}>{row.categoryName ?? "미분류"}</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm">{row.memo}</span>
                {row.tags.map((tag) => (
                  <span key={tag} className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex w-48 shrink-0 items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: row.walletColor }} />
                <span className="truncate">{row.walletName}</span>
                {row.toWalletName && (
                  <>
                    <ArrowRightIcon className="size-3" />
                    <span className="truncate">{row.toWalletName}</span>
                  </>
                )}
              </div>
              <Amount value={row.amount} type={row.type} className="w-32 text-right" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
