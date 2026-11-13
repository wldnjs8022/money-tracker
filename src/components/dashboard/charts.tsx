"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompactKRW, formatKRW } from "@/lib/money";

function krwFormatter(config: ChartConfig) {
  // eslint-disable-next-line react/display-name
  return (value: unknown, name: unknown, item: { color?: string }) => (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
      <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
      <span className="num ml-auto pl-4 font-medium text-foreground">{formatKRW(Number(value))}</span>
    </div>
  );
}

const cumulativeConfig = {
  current: { label: "이번 달", color: "var(--chart-1)" },
  previous: { label: "지난달", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export function CumulativeChart({
  data,
}: {
  data: { day: number; current: number | null; previous: number | null }[];
}) {
  return (
    <ChartContainer config={cumulativeConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval={4} tickFormatter={(d) => `${d}일`} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompactKRW(Number(v))} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, p) => `${p?.[0]?.payload?.day}일까지`} formatter={krwFormatter(cumulativeConfig)} />}
        />
        <Line
          dataKey="previous"
          type="monotone"
          stroke="var(--color-previous)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          dataKey="current"
          type="monotone"
          stroke="var(--color-current)"
          strokeWidth={2.5}
          fill="url(#fillCurrent)"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const trendConfig = {
  income: { label: "수입", color: "var(--chart-2)" },
  expense: { label: "지출", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TrendChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(m: string) => `${Number(m.slice(5))}월`}
        />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompactKRW(Number(v))} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(m) => `${String(m).slice(0, 4)}년 ${Number(String(m).slice(5))}월`}
              formatter={krwFormatter(trendConfig)}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
