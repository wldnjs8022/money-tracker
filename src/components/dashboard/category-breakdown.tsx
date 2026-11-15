import { ChartBarHorizontalIcon, DotsThreeIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { EmptyState } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { josa } from "@/lib/josa";
import { formatKRW } from "@/lib/money";
import type { Dashboard } from "@/server/queries";
import { sqrtShare } from "./format";
import { Panel } from "./panel";

const MAX_ROWS = 6;
const UNCATEGORIZED = "분류 없음";

type Row = {
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
  href: string;
  /** The folded "그 외" row */
  rest?: boolean;
};

/**
 * Where the month's money went: one row per category with an ink bar on a page-colour track.
 * Bars use a square-root scale so one large category doesn't flatten the rest; the amount and
 * share sit beside each bar, so exact values never depend on bar length. Past six rows the tail
 * folds into "그 외".
 */
export function CategoryBreakdown({ data }: { data: Dashboard }) {
  const total = data.summary.expense;
  const monthQuery = data.isCurrentMonth ? "" : `month=${data.month}&`;
  const count = data.byCategory.reduce((sum, c) => sum + c.count, 0);

  const all: Row[] = data.byCategory.map((c) => ({
    key: c.categoryId ?? "none",
    name: c.name ?? UNCATEGORIZED,
    icon: c.icon,
    color: c.color,
    total: c.total,
    // "none" alone also lists uncategorised income; this row's amount is expenses only.
    href: `/transactions?${monthQuery}${c.categoryId ? `category=${c.categoryId}` : "type=expense&category=none"}`,
  }));
  const rows =
    all.length > MAX_ROWS
      ? [
          ...all.slice(0, MAX_ROWS - 1),
          {
            key: "rest",
            name: `그 외 ${all.length - (MAX_ROWS - 1)}개`,
            icon: null,
            color: null,
            total: all.slice(MAX_ROWS - 1).reduce((sum, r) => sum + r.total, 0),
            href: `/transactions?${monthQuery}type=expense`,
            rest: true,
          },
        ]
      : all;
  const max = Math.max(0, ...rows.map((r) => r.total));

  const top = data.byCategory[0];
  const topShare = top && total > 0 ? Math.round((top.total / total) * 100) : 0;
  const description = !top
    ? undefined
    : top.categoryId === null
      ? `분류 없는 지출이 ${topShare}%로 가장 많아요. 기록함에서 골라 주세요`
      : `${josa(top.name ?? UNCATEGORIZED, "이", "가")} ${topShare}%로 가장 많아요`;

  return (
    <Panel
      id="home-categories"
      title="분류별 지출"
      description={description}
      meta={count > 0 ? <span className="num">{count.toLocaleString("ko-KR")}건</span> : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<ChartBarHorizontalIcon />}
          title="지출 기록이 없어요"
          description="지출을 적으면 어디에 썼는지 나눠 보여 드려요"
          className="flex-1 py-10"
        />
      ) : (
        <ul className="flex flex-col gap-0.5 px-3 pb-3">
          {rows.map((row) => {
            const share = total > 0 ? (row.total / total) * 100 : 0;
            return (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-2 -outline-offset-2 transition-colors duration-150 hover:bg-muted"
                >
                  {row.rest ? (
                    <span aria-hidden className="flex size-8 items-center justify-center rounded-[27%] bg-muted text-ink-3">
                      <DotsThreeIcon weight="bold" className="size-4" />
                    </span>
                  ) : (
                    <CategoryIcon icon={row.icon ?? "❔"} color={row.color} className="size-8" />
                  )}
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-3">
                      <span className="truncate font-semibold">{row.name}</span>
                      <span className="num ml-auto shrink-0 text-[13px] font-bold">{formatKRW(row.total)}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2.5">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted transition-colors duration-150 group-hover:bg-line-soft">
                        <span
                          className="block h-full rounded-full bg-ink"
                          style={{ width: `${Math.max(sqrtShare(row.total, max) * 100, 1.5)}%` }}
                        />
                      </span>
                      <span className="num w-9 shrink-0 text-right text-xs text-ink-3">
                        {share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
