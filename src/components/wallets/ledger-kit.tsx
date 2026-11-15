"use client";

/*
 * Pieces shared by the two-pane 계좌 and 카테고리 screens: the selection (client state mirrored to
 * ?id=), server-action calls that can't crash the screen, the keyboard-navigable list rows, the
 * inline title editor, colour swatches and the month's records in inbox style (each row opens that
 * record in 기록).
 */

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Amount, TYPE_LABEL } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { addDays, weekdayKo } from "@/lib/dates";
import { REVIEW_CHIP } from "@/lib/review";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/actions";
import type { TransactionRow } from "@/server/queries";

// ───────────────────────── Selection and the address bar ─────────────────────────

/** How long the selection has to stay put before the address bar follows it. */
const MIRROR_DELAY_MS = 250;

/**
 * A search param of the screen at `path`, as the router has it (links, back/forward, router.push).
 * Null while another route shows: Cache Components keeps this screen mounted but hidden, and the
 * router's search params then belong to that other route.
 */
function useRouterParam(path: string, name: string): string | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return pathname === path ? searchParams.get(name) : null;
}

/**
 * The selected row of a two-pane screen. It lives in state, so a click or J/K moves it at once and
 * never waits on (or is throttled by) history writes. A navigation that lands here with ?id= (a link,
 * back/forward) selects that row; the screen's own address-bar writes never feed back into it.
 */
export function useSelection(path: string): [string | null, (id: string | null) => void] {
  const linked = useRouterParam(path, "id");
  const [selectedId, setSelectedId] = useState(linked);
  // The last linked id taken in. undefined after the screen was hidden, so coming back through a
  // link to the same id as before still selects it.
  const [seen, setSeen] = useState<string | null | undefined>(linked);
  if (linked !== seen) {
    setSeen(linked);
    if (linked) setSelectedId(linked);
  }
  useLayoutEffect(() => () => setSeen(undefined), []);
  return [selectedId, setSelectedId];
}

/**
 * Mirrors the selected id into ?id= once the selection has settled, so a reload or a copied link
 * opens the same row. The router's own history state goes along, which tells Next.js to leave the
 * write alone (no router update per selection). The router rewrites the address bar from its own URL
 * whenever it commits, so the mirror runs again after each commit: new page data (`version`, the
 * server data, changes after every save) or a new URL of its own (its search params).
 */
export function useMirrorSelection(path: string, id: string | null, version: unknown) {
  const visible = usePathname() === path;
  const routerSearch = useSearchParams();
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => writeAddressBar(path, { id }, window.history.state), MIRROR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, path, id, version, routerSearch]);
}

/**
 * The create dialog's open state, also opened by a navigation that lands here with ?new=1 (the
 * command palette's "새 계좌 추가"). The param is then taken back out through the router, so a reload
 * doesn't reopen the dialog and the next ?new=1 link opens it again.
 */
export function useCreateDialog(path: string): [boolean, (open: boolean) => void] {
  const requested = useRouterParam(path, "new") === "1";
  const [open, setOpen] = useState(requested);
  const [seen, setSeen] = useState(requested);
  if (requested !== seen) {
    setSeen(requested);
    if (requested) setOpen(true);
  }
  useEffect(() => {
    if (!requested) return;
    // No history state, so Next.js picks the write up and updates its search params (a one-off,
    // unlike the selection mirror). Deferred: on a fresh load Next.js hooks history.replaceState in
    // an effect of its own, which runs after this one.
    const timer = setTimeout(() => writeAddressBar(path, { new: null }, null), 0);
    return () => clearTimeout(timer);
  }, [requested, path]);
  return [open, setOpen];
}

/** Sets (or, with null, removes) search params in place, only while the address bar is on `path`. */
function writeAddressBar(path: string, patch: Record<string, string | null>, state: unknown) {
  try {
    const url = new URL(window.location.href);
    if (url.pathname !== path) return;
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (url.searchParams.get(key) === value) continue;
      changed = true;
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (changed) window.history.replaceState(state, "", url);
  } catch {
    // Browsers throttle history writes (WebKit throws after 100 in 10 s). The selection lives in
    // state, so a dropped write only leaves the address bar behind until the next one.
  }
}

// ───────────────────────── Server actions ─────────────────────────

export const UNREACHABLE = "서버에 닿지 못했어요. 연결을 확인하고 다시 해 주세요.";

/**
 * Calls a server action and turns a thrown call (network drop, server exception, a new deploy) into
 * a failed result. Thrown inside a transition it would otherwise replace the screen with the error
 * boundary instead of rolling the optimistic edit back.
 */
export async function attempt<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

// ───────────────────────── Copy helpers ─────────────────────────

// ‘신용카드’를 and 카드1로 live in lib/josa, which reads digits and Latin letters too (‘29CM’을).
export { quoted, withRo } from "@/lib/josa";

// ───────────────────────── List ─────────────────────────

/**
 * One selectable row of a list pane. Rows use a roving tab stop: only the selected row is in the tab
 * order and ↑/↓ (or J/K) move between rows, so Tab jumps past the list in one step.
 */
export function ListRow({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-row-id={id}
      aria-current={selected ? "true" : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(id)}
      className="flex min-h-[60px] w-full items-center gap-3 border-t border-muted px-4 py-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-offset-[-2px] aria-[current=true]:bg-muted"
    >
      {children}
    </button>
  );
}

/**
 * Keyboard movement through a list pane: J/K anywhere (registered by the caller through useHotkeys)
 * and ↑/↓/Home/End while a row has focus. Focus follows the selection when it was already in the list.
 */
export function useListNavigation(
  ids: string[],
  selectedId: string | null,
  select: (id: string) => void,
  /** Where the selected row sits (its group, say). */
  placement = "",
) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected row in view when it lands somewhere new: opened through a link, or moved to
  // another group by an edit (a new kind, archiving).
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-row-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, placement]);

  function move(to: "next" | "prev" | "first" | "last") {
    if (ids.length === 0) return;
    const at = selectedId ? ids.indexOf(selectedId) : -1;
    const index =
      to === "first" ? 0 : to === "last" ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, at + (to === "next" ? 1 : -1)));
    const id = ids[index];
    if (id === selectedId) return;
    select(id);
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
    if (!row) return;
    if (list?.contains(document.activeElement)) row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const keys: Record<string, "next" | "prev" | "first" | "last"> = {
      ArrowDown: "next",
      ArrowUp: "prev",
      Home: "first",
      End: "last",
    };
    const to = keys[event.key];
    if (!to || !(event.target instanceof HTMLElement) || !event.target.closest("[data-row-id]")) return;
    event.preventDefault();
    move(to);
  }

  return { listRef, move, onKeyDown };
}

/** Footer hint for the list keys, in the board's style. */
export function ListKeysHint() {
  return (
    <p className="text-xs text-ink-3">
      <b className="font-bold text-foreground">J / K</b> 위아래
    </p>
  );
}

// ───────────────────────── Detail ─────────────────────────

/**
 * The detail title, editable in place: looks like a heading until hovered or focused. Saves on Enter
 * or blur, Esc puts the old name back. Key it by id and value so it resets when either changes.
 */
export function InlineTitle({
  value,
  label,
  maxLength,
  onSave,
  className,
}: {
  value: string;
  label: string;
  maxLength: number;
  onSave: (next: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(value);
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      toast.error("이름은 비워 둘 수 없어요");
      return;
    }
    setDraft(next);
    if (next !== value) onSave(next);
  }

  return (
    <input
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "-mx-2 h-12 w-[calc(100%+1rem)] min-w-0 rounded-[9px] border border-transparent bg-transparent px-2 text-[28px] leading-tight font-bold tracking-[-0.035em] text-foreground transition-[border-color,box-shadow] duration-150 outline-none hover:border-line focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/12",
        className,
      )}
    />
  );
}

/** Detail-pane amount: 48px / 800, tabular, tight. */
export function BigAmount({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-5xl leading-[1.15] font-extrabold tracking-[-0.05em] whitespace-nowrap tabular-nums", className)}>
      {children}
    </p>
  );
}

export type Swatch = { value: string; name: string };

/**
 * Colour swatches as toggle buttons. A colour that isn't in the palette (set elsewhere) is shown first
 * as "지금 색" so the current choice is always visible.
 */
export function ColorPicker({
  swatches,
  value,
  onChange,
  labelledBy,
}: {
  swatches: readonly Swatch[];
  value: string;
  onChange: (color: string) => void;
  labelledBy: string;
}) {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const list = swatches.some((s) => same(s.value, value)) ? swatches : [{ value, name: "지금 색" }, ...swatches];
  return (
    <div role="group" aria-labelledby={labelledBy} className="-mx-2 flex flex-wrap">
      {list.map((swatch) => {
        const on = same(swatch.value, value);
        return (
          <button
            key={swatch.value}
            type="button"
            aria-pressed={on}
            aria-label={swatch.name}
            title={swatch.name}
            onClick={() => {
              if (!on) onChange(swatch.value);
            }}
            className="flex size-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-muted"
          >
            <span
              aria-hidden
              className={cn("size-6 rounded-full", on && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
              style={{ backgroundColor: swatch.value }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Month records ─────────────────────────

function dayLabel(date: string, today: string): string {
  const [, m, d] = date.split("-").map(Number);
  const md = `${m}월 ${d}일`;
  if (date === today) return `오늘 · ${md}`;
  if (date === addDays(today, -1)) return `어제 · ${md}`;
  return `${md} ${weekdayKo(date)}요일`;
}

/**
 * Section heading for a detail pane's record list: title + summary on the left, a link to the same
 * records in 기록 on the right.
 */
export function RecordsHeader({
  id,
  title,
  summary,
  href,
}: {
  id: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-bold tracking-[-0.02em]">
          {title}
        </h2>
        {summary && <p className="mt-0.5 text-[13px] text-ink-3">{summary}</p>}
      </div>
      <Link
        href={href}
        className="inline-flex h-10 items-center gap-1 rounded-[9px] px-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        기록에서 보기
        <ArrowUpRightIcon aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

/**
 * The month's records grouped by day, in the inbox row style: status dot (lime when it still needs a
 * look), memo + reason chip, one sub line, amount. Each row opens the record in 기록.
 */
export function MonthRecords({
  rows,
  today,
  subline,
  empty,
}: {
  rows: TransactionRow[];
  today: string;
  subline: (row: TransactionRow) => string;
  empty: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  const days: { date: string; rows: TransactionRow[] }[] = [];
  for (const row of rows) {
    const last = days.at(-1);
    if (last?.date === row.date) last.rows.push(row);
    else days.push({ date: row.date, rows: [row] });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line-soft">
      {days.map((day) => (
        <div key={day.date}>
          <h3 className="px-4 pt-3 pb-1 text-xs font-bold text-ink-3">{dayLabel(day.date, today)}</h3>
          <ul>
            {day.rows.map((row) => (
              <li key={row.id}>
                <RecordLink row={row} sub={subline(row)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RecordLink({ row, sub }: { row: TransactionRow; sub: string }) {
  const title = row.memo || row.categoryName || TYPE_LABEL[row.type];
  return (
    <Link
      href={`/transactions?id=${row.id}`}
      className="flex min-h-[60px] items-center gap-3 border-t border-muted px-4 py-2 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-offset-[-2px]"
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          // Dark --dot is tuned for the page grid and vanishes on the card, so lift it like the inbox does.
          row.pending ? "bg-signal ring-[3px] ring-signal-tint" : "bg-dot dark:bg-ink-4/60",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold">{title}</span>
          {row.pending && row.reviewReason && <Badge variant="tint">{REVIEW_CHIP[row.reviewReason]}</Badge>}
        </span>
        <span className="block truncate text-xs text-ink-3">{sub}</span>
      </span>
      <Amount value={row.amount} type={row.type} />
    </Link>
  );
}
