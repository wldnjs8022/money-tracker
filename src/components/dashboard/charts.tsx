"use client";

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatCompactKRW, formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { LineKey } from "./panel";

type CumulativePoint = { day: number; current: number | null; previous: number | null };

/**
 * Running total of spending by day of month: this month as a solid ink line with a faint wash,
 * last month dashed in ink-3, a dot on today (or the month's last day). Hairline grid, no axis rules.
 * The whole chart is one image for assistive tech; `ariaLabel` carries the numbers.
 */
export function CumulativeSpendChart({
  data,
  marker,
  markerLabel,
  currentLabel,
  previousLabel,
  ariaLabel,
  className,
}: {
  data: CumulativePoint[];
  marker: { day: number; value: number } | null;
  /** Text next to the marker, e.g. "오늘". */
  markerLabel?: string;
  currentLabel: string;
  previousLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  const fillId = `spend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const config = {
    current: { label: currentLabel, color: "var(--chart-1)" },
    previous: { label: previousLabel, color: "var(--ink-3)" },
  } satisfies ChartConfig;
  const lastDay = data.length;
  // Put the marker's label on the side away from last month's line so the two never collide.
  const prevAtMarker = marker ? (data[marker.day - 1]?.previous ?? null) : null;
  const labelPosition = prevAtMarker !== null && marker && prevAtMarker > marker.value ? "bottom" : "top";
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= lastDay);

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={ariaLabel}
      className={cn("aspect-auto h-[232px] w-full", className)}
    >
      <ComposedChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.1} />
            <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line-soft)" />
        <XAxis
          dataKey="day"
          type="number"
          domain={[1, lastDay]}
          ticks={ticks}
          tickFormatter={(d: number) => `${d}일`}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          width={48}
          axisLine={false}
          tickLine={false}
          tickCount={4}
          tickFormatter={(v: number) => formatCompactKRW(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
          isAnimationActive={false}
          content={({ active, payload }) => (
            <SpendTooltip
              active={active}
              point={payload?.[0]?.payload as CumulativePoint | undefined}
              currentLabel={currentLabel}
              previousLabel={previousLabel}
            />
          )}
        />
        <Line
          dataKey="previous"
          type="monotone"
          stroke="var(--color-previous)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 3.5, fill: "var(--color-previous)", stroke: "var(--card)", strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          dataKey="current"
          type="monotone"
          stroke="var(--color-current)"
          strokeWidth={2}
          strokeLinejoin="round"
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-current)", stroke: "var(--card)", strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        {marker && (
          <ReferenceDot
            x={marker.day}
            y={marker.value}
            r={4.5}
            fill="var(--color-current)"
            stroke="var(--card)"
            strokeWidth={2}
            label={
              markerLabel
                ? { value: markerLabel, position: labelPosition, offset: 10, fill: "var(--ink-2)", fontSize: 11, fontWeight: 700 }
                : undefined
            }
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

/** Values lead, labels follow; each row keyed with the series' line style. */
function SpendTooltip({
  active,
  point,
  currentLabel,
  previousLabel,
}: {
  active: boolean;
  point: CumulativePoint | undefined;
  currentLabel: string;
  previousLabel: string;
}) {
  if (!active || !point) return null;
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-line bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-overlay">
      <p className="font-semibold text-ink-3">{point.day}일까지</p>
      {point.current !== null && (
        <TooltipRow value={point.current} label={currentLabel} className="text-foreground" />
      )}
      {point.previous !== null && (
        <TooltipRow value={point.previous} label={previousLabel} className="text-ink-3" dashed />
      )}
    </div>
  );
}

function TooltipRow({ value, label, className, dashed }: { value: number; label: string; className: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LineKey dashed={dashed} className={className} />
      <span className="num text-[13px] font-bold text-foreground">{formatKRW(value)}</span>
      <span className="ml-auto pl-3 text-ink-3">{label}</span>
    </div>
  );
}
