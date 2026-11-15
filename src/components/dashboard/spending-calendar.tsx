"use client";

import { useRef, useState } from "react";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { countNoSpendDays, longDateKo, sqrtShare, type CalendarDay } from "./format";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// Sunday leans red and Saturday blue, both mostly ink-3 so the header stays quiet. Saturday's blue is
// the destructive token turned to the blue side of the hue wheel, so it follows light and dark mode
// with it. Mixed in oklab: ink-3's faint hue would otherwise steer the hue interpolation.
const WEEKEND_COLOR: Record<number, string> = {
  0: "color-mix(in oklab, var(--destructive) 60%, var(--ink-3))",
  6: "color-mix(in oklab, oklch(from var(--destructive) l c calc(h + 230)) 60%, var(--ink-3))",
};

/**
 * Ink share mixed into the card colour for a day with spending, from its square-root share of the
 * biggest day: 10–36% for the smaller half, 56–72% for the larger, so only the heaviest days go
 * dark. The jump skips the middle band where neither ink nor card-coloured day numbers reach 4.5:1
 * (about 45–53% in dark mode).
 */
const heat = (share: number) => Math.round(share < 0.5 ? 10 + 52 * share : 56 + 32 * (share - 0.5));
// Mixed in oklab: near-neutral ink and card hues would drift through other hues in oklch.
const tint = (pct: number) => `color-mix(in oklab, var(--chart-1) ${pct}%, var(--card))`;
/** From this ink share on (inside the gap above), the day number flips to the card colour. */
const FLIP_AT = 50;
const LEGEND = [0.2, 0.45, 0.7, 1].map(heat);

/** What a day came to, for the readout line and the cell's accessible name. */
function dayAmount(d: CalendarDay): string {
  if (d.future) return d.expense > 0 ? `예정 ${formatKRW(d.expense)}` : "아직이에요";
  return d.expense > 0 ? formatKRW(d.expense) : "안 썼어요";
}

/**
 * The month as a heat map of daily spending: ink tints over the card colour on a square-root scale
 * (rent day doesn't wash out the rest), today ringed, days to come outlined. Days to come never take
 * a tint or count towards the scale; one with a record entered ahead carries a small dot and reads
 * "예정". Hovering or focusing a day shows it in the line underneath; at rest that line names the
 * biggest day so far. For the keyboard it is a read-only grid with one tab stop: arrows move by day
 * and week, Home/End to the ends of the week, Ctrl+Home/End to the ends of the month.
 */
export function SpendingCalendar({ days, today, monthName }: { days: CalendarDay[]; today: string; monthName: string }) {
  const todayIndex = days.findIndex((d) => d.date === today);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  // The roving tab stop: today in the current month, else the 1st.
  const [stop, setStop] = useState(Math.max(0, todayIndex));
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  if (days.length === 0) return null;

  const lead = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const tabStop = Math.min(stop, days.length - 1);
  const past = days.filter((d) => !d.future);
  const max = Math.max(0, ...past.map((d) => d.expense));
  const biggest = past.reduce<CalendarDay | null>((a, b) => (!a || b.expense > a.expense ? b : a), null);
  const noSpend = countNoSpendDays(days);
  const shown = hovered ?? focused;
  const active = shown ? days.find((d) => d.date === shown) : undefined;

  const summary =
    biggest && biggest.expense > 0
      ? `${monthName} 지출 달력. 무지출 ${noSpend}일, 가장 많이 쓴 날은 ${longDateKo(biggest.date)} ${formatKRW(biggest.expense)}`
      : `${monthName} 지출 달력. 아직 쓴 날이 없어요`;

  // Leading and trailing blanks pad the month out to whole weeks, one row each.
  const slots: (CalendarDay | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (slots.length % 7 !== 0) slots.push(null);
  const weeks = Array.from({ length: slots.length / 7 }, (_, w) => slots.slice(w * 7, w * 7 + 7));

  function moveTo(index: number) {
    setStop(index);
    cells.current[index]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const column = (lead + tabStop) % 7;
    const toEnd = e.ctrlKey || e.metaKey;
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
        next = tabStop - 1;
        break;
      case "ArrowRight":
        next = tabStop + 1;
        break;
      case "ArrowUp":
        next = tabStop - 7;
        break;
      case "ArrowDown":
        next = tabStop + 7;
        break;
      case "Home":
        next = toEnd ? 0 : Math.max(0, tabStop - column);
        break;
      case "End":
        next = toEnd ? days.length - 1 : Math.min(days.length - 1, tabStop + 6 - column);
        break;
      default:
        return;
    }
    e.preventDefault();
    // Arrows stop at the edges of the month rather than wrapping.
    if (next >= 0 && next < days.length) moveTo(next);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-4">
      <div
        role="grid"
        aria-label={summary}
        aria-readonly="true"
        className="flex flex-col gap-1.5"
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          const index = Number((e.target as HTMLElement).dataset.index);
          if (Number.isInteger(index)) {
            setStop(index);
            setFocused(days[index].date);
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
        }}
        onPointerOver={(e) => {
          const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
          setHovered(cell?.dataset.date ?? null);
        }}
        onPointerLeave={() => setHovered(null)}
      >
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <span
              key={w}
              role="columnheader"
              aria-label={`${w}요일`}
              className="pb-0.5 text-center text-[11px] font-semibold text-ink-3"
              style={WEEKEND_COLOR[i] ? { color: WEEKEND_COLOR[i] } : undefined}
            >
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} role="gridcell" />;
              const index = days.indexOf(d);
              const isToday = d.date === today;
              const pct = !d.future && d.expense > 0 ? heat(sqrtShare(d.expense, max)) : 0;
              return (
                <span
                  key={d.date}
                  ref={(el) => {
                    cells.current[index] = el;
                  }}
                  role="gridcell"
                  tabIndex={index === tabStop ? 0 : -1}
                  aria-label={`${longDateKo(d.date)}${isToday ? ", 오늘" : ""}, ${dayAmount(d)}`}
                  data-date={d.date}
                  data-index={index}
                  className={cn(
                    "num relative flex aspect-square items-center justify-center rounded-[6px] text-[11px] font-semibold transition-shadow duration-150",
                    "outline-none focus-visible:outline-2 focus-visible:outline-ring",
                    // Today's ring already sits where a focus outline would, so focus draws just outside it.
                    isToday ? "focus-visible:outline-offset-4" : "focus-visible:outline-offset-2",
                    d.future
                      ? "border border-dashed border-line text-ink-3"
                      : pct === 0
                        ? "bg-muted text-ink-3"
                        : pct >= FLIP_AT
                          ? "text-card"
                          : "text-foreground",
                    isToday
                      ? "ring-2 ring-ink ring-offset-2 ring-offset-card"
                      : d.date === shown && "ring-1 ring-ink-3",
                  )}
                  style={pct > 0 ? { backgroundColor: tint(pct) } : undefined}
                >
                  {Number(d.date.slice(8))}
                  {d.future && d.expense > 0 && (
                    <span aria-hidden className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-ink-3" />
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4 text-xs">
        {/* Visual echo of the hovered or focused day; the cells carry their own accessible names. */}
        <p aria-hidden className="truncate text-ink-2">
          {active ? (
            <>
              {longDateKo(active.date)} · <span className="num font-bold text-foreground">{dayAmount(active)}</span>
            </>
          ) : biggest && biggest.expense > 0 ? (
            <>
              가장 많이 쓴 날 {longDateKo(biggest.date)} ·{" "}
              <span className="num font-bold text-foreground">{formatKRW(biggest.expense)}</span>
            </>
          ) : (
            "아직 쓴 날이 없어요"
          )}
        </p>
        <span aria-hidden className="flex items-center gap-1 self-end text-[11px] text-ink-3">
          적게
          <span className="size-2.5 rounded-[3px] bg-muted" />
          {LEGEND.map((pct) => (
            <span key={pct} className="size-2.5 rounded-[3px]" style={{ backgroundColor: tint(pct) }} />
          ))}
          많이
        </span>
      </div>
    </div>
  );
}
