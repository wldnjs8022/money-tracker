"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Kbd } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addMonths, currentMonthKST, formatMonthKo } from "@/lib/dates";
import { useHotkeys } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";

const arrow =
  "flex h-full w-9 shrink-0 items-center justify-center text-ink-3 transition-colors duration-150 outline-none focus-ring first:rounded-l-[8px] last:rounded-r-[8px]";
const ARROW_HOVER = "hover:bg-muted hover:text-foreground";

/**
 * ‹ 2026년 11월 › in one hairline group, with [ and ] shortcuts and a 이번 달 link when away.
 * Keeps the page's other query params; the month param is left out for the current month.
 * Pass `current` (YYYY-MM) from the server so the client clock never decides it.
 */
export function MonthNav({
  month,
  basePath,
  params = {},
  current: currentProp,
  className,
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  current?: string;
  className?: string;
}) {
  const router = useRouter();
  const current = currentProp ?? currentMonthKST();
  const href = (m: string) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    if (m !== current) search.set("month", m);
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const canGoNext = next <= current;

  useHotkeys({
    "[": () => router.push(href(prev), { scroll: false }),
    "]": () => canGoNext && router.push(href(next), { scroll: false }),
  });

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex h-10 items-center rounded-[9px] border border-line bg-card">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href(prev)} scroll={false} aria-label="이전 달" aria-keyshortcuts="[" className={cn(arrow, ARROW_HOVER)}>
              <CaretLeftIcon aria-hidden weight="bold" className="size-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            이전 달 <Kbd>[</Kbd>
          </TooltipContent>
        </Tooltip>
        <span className="min-w-[6.75rem] px-1 text-center text-sm font-bold tracking-[-0.02em] tabular-nums">{formatMonthKo(month)}</span>
        {canGoNext ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={href(next)} scroll={false} aria-label="다음 달" aria-keyshortcuts="]" className={cn(arrow, ARROW_HOVER)}>
                <CaretRightIcon aria-hidden weight="bold" className="size-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              다음 달 <Kbd>]</Kbd>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span aria-hidden className={cn(arrow, "text-ink-4")}>
            <CaretRightIcon weight="bold" className="size-3.5" />
          </span>
        )}
      </div>
      {month !== current && (
        <Link
          href={href(current)}
          scroll={false}
          className="inline-flex h-10 items-center rounded-[9px] px-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-150 outline-none focus-ring hover:bg-muted hover:text-foreground"
        >
          이번 달
        </Link>
      )}
    </div>
  );
}
