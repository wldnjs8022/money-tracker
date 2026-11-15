import { ArchiveIcon, WalletIcon as WalletGlyph } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { EmptyState, WALLET_KIND_LABEL } from "@/components/common";
import { WalletIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/server/queries";
import { totalNetWorth } from "./format";
import { Panel, PanelLink } from "./panel";

/**
 * Active wallets with their balances; net worth closes the list. Net worth counts archived wallets
 * too (as 계좌 does), so money left in them gets one folded row and the list still adds up.
 */
export function WalletBalances({ data, className }: { data: Dashboard; className?: string }) {
  const netWorth = totalNetWorth(data);
  const archived = netWorth - data.activeNetWorth;
  const debts = Math.abs(data.activeDebts);
  return (
    <Panel id="home-wallets" title="계좌" meta={<PanelLink href="/wallets">관리</PanelLink>} className={className}>
      {data.wallets.length === 0 && archived === 0 ? (
        <EmptyState
          icon={<WalletGlyph />}
          title="계좌가 없어요"
          description="통장, 카드, 현금을 추가하면 잔액을 보여 드려요"
          action={
            // cn() resolves the base border-transparent against the variant's border colour.
            // ?new=1 opens 계좌's add dialog, so the button does what it says.
            <Link href="/wallets?new=1" className={cn(buttonVariants({ variant: "outline" }))}>
              계좌 추가하기
            </Link>
          }
          className="flex-1 py-10"
        />
      ) : (
        <>
          <ul className="divide-y divide-muted border-t border-muted">
            {data.wallets.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/transactions?wallet=${w.id}`}
                  aria-label={`${w.name} 기록 보기, 잔액 ${formatKRW(w.balance)}`}
                  className="flex min-h-14 items-center gap-3 px-5 py-2 -outline-offset-2 transition-colors duration-150 hover:bg-muted"
                >
                  <WalletIcon kind={w.kind} color={w.color} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block text-xs text-ink-3">{WALLET_KIND_LABEL[w.kind]}</span>
                  </span>
                  <span className={cn("num shrink-0 text-sm font-bold", w.balance < 0 && "text-ink-2")}>
                    {formatKRW(w.balance)}
                  </span>
                </Link>
              </li>
            ))}
            {archived !== 0 && (
              <li>
                <Link
                  href="/wallets"
                  aria-label={`보관한 계좌 잔액 ${formatKRW(archived)}, 계좌에서 보기`}
                  className="flex min-h-14 items-center gap-3 px-5 py-2 -outline-offset-2 transition-colors duration-150 hover:bg-muted"
                >
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[27%] bg-muted text-ink-3">
                    <ArchiveIcon weight="duotone" className="size-[54%]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-2">보관한 계좌</span>
                    <span className="block text-xs text-ink-3">순자산에 포함돼요</span>
                  </span>
                  <span className="num shrink-0 text-sm font-bold text-ink-2">{formatKRW(archived)}</span>
                </Link>
              </li>
            )}
          </ul>
          <div className="mt-auto border-t border-line-soft bg-side px-5 py-3.5">
            <div className="flex items-baseline gap-3">
              <span className="text-[13px] font-bold">순자산</span>
              <span className="display ml-auto text-lg">{formatKRW(netWorth)}</span>
            </div>
            {debts > 0 && (
              <p className="mt-0.5 text-xs text-ink-3">
                자산 <span className="num font-semibold text-ink-2">{formatKRW(data.activeAssets)}</span> · 부채{" "}
                <span className="num font-semibold text-ink-2">{formatKRW(debts)}</span>
                {archived !== 0 && (
                  <>
                    {" "}
                    · 보관 <span className="num font-semibold text-ink-2">{formatKRW(archived)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
