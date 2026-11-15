import { ReceiptIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Amount, EmptyState } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { formatDateKo, monthOf } from "@/lib/dates";
import { REVIEW_CHIP } from "@/lib/review";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/server/queries";
import { Panel, PanelLink } from "./panel";

/**
 * The latest records in the inbox's row language: a status dot (lime with a soft ring while it
 * waits for review), memo with its reason chip, "분류 · 계좌" underneath, amount and day on the
 * right. Each row opens that record in the inbox.
 */
export function RecentRecords({ rows, today, className }: { rows: TransactionRow[]; today: string; className?: string }) {
  return (
    <Panel id="home-recent" title="최근 기록" meta={<PanelLink href="/transactions">기록 전체</PanelLink>} className={className}>
      {rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title="아직 기록이 없어요"
          description="N을 누르고 한 줄로 적으면 여기에 쌓여요"
          className="flex-1 py-10"
        />
      ) : (
        <ul className="divide-y divide-muted border-t border-muted">
          {rows.map((t) => (
            <li key={t.id}>
              <RecordRow row={t} today={today} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecordRow({ row: t, today }: { row: TransactionRow; today: string }) {
  const transfer = t.type === "transfer";
  const title = t.memo || (transfer ? "이체" : (t.categoryName ?? "분류 없음"));
  const sub = transfer
    ? `이체 · ${t.walletName} → ${t.toWalletName ?? "알 수 없는 계좌"}`
    : `${t.categoryName ?? "분류 없음"} · ${t.walletName}`;

  return (
    <Link
      href={`/transactions?id=${t.id}&month=${monthOf(t.date)}`}
      className="flex min-h-[60px] items-center gap-2.5 px-5 py-2.5 -outline-offset-2 transition-colors duration-150 hover:bg-muted"
    >
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", t.pending ? "bg-signal ring-[3px] ring-signal-tint" : "bg-ink-4/45")}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold">{title}</span>
          {t.pending && (
            <>
              <span className="sr-only">, 확인할 것</span>
              {t.reviewReason && (
                <Badge variant="tint" className="shrink-0">
                  {REVIEW_CHIP[t.reviewReason]}
                </Badge>
              )}
            </>
          )}
        </span>
        <span className="block truncate text-xs text-ink-3">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Amount value={t.amount} type={t.type} className="text-sm" />
        <span className="text-xs text-ink-3">{formatDateKo(t.date, today)}</span>
      </span>
    </Link>
  );
}
