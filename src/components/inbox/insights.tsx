"use client";

import { LightbulbIcon } from "@phosphor-icons/react";
import { useTransition } from "react";
import { WalletIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { WalletWithBalance } from "@/server/queries";
import type { CategoryInsight, KeywordSuggestion, SameMemoInsight } from "./model";

export type WalletBalance = Pick<WalletWithBalance, "id" | "name" | "kind" | "color" | "balance" | "archived">;

export type TransferInsight = {
  from: WalletBalance | null;
  to: WalletBalance | null;
  /** A card bill payment (bank → card). */
  toCard: boolean;
};

export type Insights = {
  sameMemo: SameMemoInsight | null;
  category: CategoryInsight | null;
  suggestion: KeywordSuggestion | null;
  transfer: TransferInsight | null;
};

/**
 * What the side pane knows about the selected record. Rendered in the side pane from 1280px and at
 * the bottom of the detail pane below that, so it lays out as a stack or a two-column grid.
 */
export function InsightBlocks({
  insights,
  onSaveKeyword,
  className,
}: {
  insights: Insights;
  onSaveKeyword: (suggestion: KeywordSuggestion) => Promise<void>;
  className?: string;
}) {
  const { sameMemo, category, suggestion, transfer } = insights;
  if (!sameMemo && !category && !suggestion && !transfer) {
    return <p className={cn("text-[13px] text-ink-3", className)}>이 기록과 견줘 볼 기록이 아직 없어요.</p>;
  }
  return (
    <div className={className}>
      {sameMemo && <SameMemoBlock insight={sameMemo} />}
      {transfer && <TransferBlock insight={transfer} />}
      {category && <CategoryBlock insight={category} />}
      {suggestion && (
        <KeywordBlock key={`${suggestion.categoryId}:${suggestion.word}`} suggestion={suggestion} onSave={onSaveKeyword} />
      )}
    </div>
  );
}

const BAR_AREA = 76; // px; the chart box is 84px with a little headroom

function SameMemoBlock({ insight }: { insight: SameMemoInsight }) {
  const count = insight.bars.length;
  // Tighter gaps as bars pile up: 24 bars still fit in about 120px (24 × 3px + 23 × 2px).
  const gap = count > 16 ? "gap-0.5" : count > 10 ? "gap-[3px]" : "gap-[5px]";
  return (
    <section aria-label="같은 메모">
      <p className="text-xs font-bold text-ink-3">같은 메모</p>
      <p className="mt-0.5 text-xl font-extrabold tracking-[-0.03em]">{insight.headline}</p>
      {/* One bar compares nothing, so a first occurrence shows only the sentence. */}
      {count > 1 && (
        <div
          role="img"
          aria-label={insight.label}
          className={cn("mt-3 flex h-[84px] items-end overflow-hidden border-b border-line", gap)}
        >
          {insight.bars.map((bar) => (
            <span
              key={bar.id}
              className={cn(
                "max-w-[26px] min-w-[3px] flex-1 rounded-t-[4px]",
                count > 16 && "rounded-t-[2px]",
                bar.current ? "bg-ink" : "bg-dot dark:bg-ink-4/60",
              )}
              style={{ height: `${Math.max(6, Math.round(bar.height * BAR_AREA))}px` }}
            />
          ))}
        </div>
      )}
      <p className={cn("text-[13px] text-ink-2 tabular-nums", count > 1 ? "mt-2" : "mt-1")}>{insight.note}</p>
    </section>
  );
}

function CategoryBlock({ insight }: { insight: CategoryInsight }) {
  return (
    <section aria-label={`${insight.title} 흐름`} className="rounded-xl border border-line-soft bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-bold">{insight.title}</span>
        {insight.usual !== null && (
          <span className="shrink-0 text-xs text-ink-3 tabular-nums">평소 한 달 {formatKRW(insight.usual)}</span>
        )}
      </div>
      <p className="mt-1 text-xl font-extrabold tracking-[-0.03em] tabular-nums">{formatKRW(insight.total)}</p>
      {insight.ahead > 0 && (
        <p className="text-xs text-ink-3 tabular-nums">예정 {formatKRW(insight.ahead)} 포함</p>
      )}
      {insight.usual !== null && (
        <div role="img" aria-label={insight.label} className="relative mt-2.5 h-2 rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${insight.fill * 100}%` }} />
          {insight.tick !== null && (
            <div
              className="absolute -top-[3px] h-3.5 w-0.5 rounded-full bg-ink-4"
              style={{ left: `calc(${insight.tick * 100}% - 1px)` }}
            />
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs text-ink-2 tabular-nums">{insight.sentence}</p>
    </section>
  );
}

function KeywordBlock({
  suggestion,
  onSave,
}: {
  suggestion: KeywordSuggestion;
  onSave: (suggestion: KeywordSuggestion) => Promise<void>;
}) {
  const [saving, startSaving] = useTransition();
  return (
    <section aria-label="키워드 제안" className="rounded-xl bg-signal-tint p-3.5">
      <div className="flex items-start gap-2">
        <LightbulbIcon aria-hidden className="mt-px size-[18px] shrink-0" />
        <p className="text-sm font-semibold">{suggestion.text}</p>
      </div>
      <Button className="mt-2.5" disabled={saving} onClick={() => startSaving(() => onSave(suggestion))}>
        {saving ? "저장하는 중…" : "키워드로 저장"}
      </Button>
    </section>
  );
}

function TransferBlock({ insight }: { insight: TransferInsight }) {
  return (
    <section aria-label="이체" className="rounded-xl border border-line-soft bg-card p-3.5">
      <p className="font-bold">이체</p>
      <p className="mt-0.5 text-xs text-ink-2">
        {insight.toCard ? "카드값 같은 이체는 지출 합계에 안 들어가요" : "이체는 지출 합계에 안 들어가요"}
      </p>
      <ul className="mt-3 space-y-2.5">
        <WalletLine label="보낸 계좌" wallet={insight.from} />
        <WalletLine label="받은 계좌" wallet={insight.to} />
      </ul>
    </section>
  );
}

function WalletLine({ label, wallet }: { label: string; wallet: WalletBalance | null }) {
  if (!wallet) return null;
  return (
    <li className="flex items-center gap-2.5">
      <WalletIcon kind={wallet.kind} color={wallet.color} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="truncate text-sm font-semibold">
          {wallet.name}
          {wallet.archived && <span className="ml-1 text-xs font-medium text-ink-3">보관됨</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-ink-3">잔액</p>
        <p className="text-sm font-bold tabular-nums">{formatKRW(wallet.balance)}</p>
      </div>
    </li>
  );
}
