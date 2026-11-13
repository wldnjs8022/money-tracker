"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addMonths, currentMonthKST, formatMonthKo } from "@/lib/dates";
import { useHotkeys } from "@/lib/hotkeys";

/** ‹ 2026년 11월 › with [ and ] shortcuts. Keeps the page's other query params. */
export function MonthNav({
  month,
  basePath,
  params = {},
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const current = currentMonthKST();
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
    "[": () => router.push(href(prev)),
    "]": () => canGoNext && router.push(href(next)),
  });

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild>
            <Link href={href(prev)} aria-label="이전 달">
              <ChevronLeftIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>이전 달 [</TooltipContent>
      </Tooltip>
      <span className="num min-w-28 text-center text-base font-semibold">{formatMonthKo(month)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild disabled={!canGoNext}>
            {canGoNext ? (
              <Link href={href(next)} aria-label="다음 달">
                <ChevronRightIcon />
              </Link>
            ) : (
              <span aria-disabled className="opacity-30">
                <ChevronRightIcon />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>다음 달 ]</TooltipContent>
      </Tooltip>
      {month !== current && (
        <Button variant="outline" size="sm" asChild className="ml-1">
          <Link href={href(current)}>이번 달</Link>
        </Button>
      )}
    </div>
  );
}
