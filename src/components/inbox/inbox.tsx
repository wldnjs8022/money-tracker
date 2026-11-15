"use client";

import { startTransition, useEffect, useLayoutEffect, useOptimistic, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/components/app/ui-provider";
import { FullBleed } from "@/components/common";
import { notifyConfirmed, notifyCreated, notifyDeleted } from "@/components/transactions/notify";
import { monthOf } from "@/lib/dates";
import { useHotkeys } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import {
  addCategoryKeyword,
  confirmTransaction,
  deleteTransaction,
  duplicateTransaction,
  patchTransaction,
  unconfirmTransaction,
  type ActionResult,
  type TransactionPatch,
} from "@/server/actions";
import type { EntryContext, TransactionRow } from "@/server/queries";
import { DetailPane, type DetailHandlers } from "./detail-pane";
import { InsightBlocks, type Insights, type WalletBalance } from "./insights";
import { LIST_PANE_WIDTH, SIDE_PANE_WIDTH } from "./layout";
import { ListPane } from "./list-pane";
import {
  applyRowOp,
  categoryInsight,
  groupByDay,
  isFiltered,
  keywordSuggestion,
  listKeyOf,
  monthLabel,
  neighborAfterRemoval,
  nextPendingId,
  quoted,
  sameMemoInsight,
  survivingNeighbor,
  withRo,
  type InboxQuery,
  type KeywordSuggestion,
  type MonthStats,
  type RowOp,
} from "./model";

export type { WalletBalance } from "./insights";

const FAILED = "저장하지 못했어요. 잠시 뒤에 다시 해 주세요.";
const UNDO_MS = 8000;

type Selection = {
  /** The selected record. It may be missing from the list for a moment (a duplicate on its way). */
  id: string | null;
  /** Where to fall back to while that record isn't in the list yet (a copy on its way, an unknown ?id=). */
  index: number;
  listKey: string;
};

/** The list (ids in order) in which the selected record was last seen. */
type Seen = { id: string | null; ids: string[]; listKey: string };

export function Inbox({
  query,
  requestedId,
  rows: serverRows,
  stats,
  ctx,
  reviewCount,
  wallets,
  today,
}: {
  query: InboxQuery;
  /** ?id= from the URL when the page rendered. */
  requestedId: string | null;
  rows: TransactionRow[];
  /** Unfiltered records and usual totals per month, for the side pane. */
  stats: Record<string, MonthStats>;
  ctx: EntryContext;
  reviewCount: number;
  wallets: WalletBalance[];
  today: string;
}) {
  const { setQuickEntryOpen, openEditTransaction } = useUI();
  const currentMonth = monthOf(today);
  const listKey = listKeyOf(query);
  const [rows, applyOp] = useOptimistic(serverRows, applyRowOp);

  // ── Selection: an id, never an index ─────────────────────────────────────────
  const [selection, setSelection] = useState<Selection>(() => ({ id: requestedId, index: 0, listKey }));
  const ids = rows.map((r) => r.id);
  const [seen, setSeen] = useState<Seen>(() => ({ id: requestedId, ids, listKey }));

  const foundIndex = selection.id ? ids.indexOf(selection.id) : -1;
  // A record can leave the list without leave(): saved out of the filter or search, moved or deleted
  // in 전체 편집, gone after a refresh. Remembering the list it was last seen in (compared by ids:
  // useOptimistic hands out a new array on every render while an action runs) hands the selection to
  // its nearest neighbor there, even when records were added above it meanwhile.
  if (foundIndex >= 0) {
    if (seen.id !== selection.id || seen.listKey !== listKey || !sameIds(seen.ids, ids)) {
      setSeen({ id: selection.id, ids, listKey });
    }
  } else if (selection.id && seen.id === selection.id && seen.listKey === listKey) {
    const next = survivingNeighbor(seen.ids, selection.id, ids);
    if (next) setSelection({ id: next, index: ids.indexOf(next), listKey });
  }
  const fallbackIndex = selection.listKey === listKey ? selection.index : 0;
  const selectedIndex = foundIndex >= 0 ? foundIndex : rows.length > 0 ? Math.min(fallbackIndex, rows.length - 1) : -1;
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : null;
  const selectedId = selected?.id ?? null;

  // Cache Components keeps this page alive (hidden) while another route shows. Coming back through a
  // link like /transactions?id=… (a record on 홈) must select that record, so when the page shows
  // again the address bar's id wins if it differs from what was selected when it was hidden. (The
  // router has already written the new URL by then.) Only on return: props from a refresh() can
  // carry an older id that J/K has since moved past.
  const latest = useRef({ selectedId, listKey });
  useLayoutEffect(() => {
    latest.current = { selectedId, listKey };
  });
  const selectedWhenHidden = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const hiddenWith = selectedWhenHidden.current;
    if (hiddenWith !== undefined) {
      const wanted = new URL(window.location.href).searchParams.get("id");
      if (wanted && wanted !== hiddenWith) setSelection({ id: wanted, index: 0, listKey: latest.current.listKey });
    }
    return () => {
      selectedWhenHidden.current = latest.current.selectedId;
    };
  }, []);

  const select = (id: string) => setSelection({ id, index: rows.findIndex((r) => r.id === id), listKey });

  // Mirror the selection into ?id= so a reload or a shared link opens the same record. Passing the
  // router's own history state through changes only the address bar: a router update per key press
  // would preempt an in-flight navigation or server action (Next.js discards those for it). The
  // router rewrites the URL whenever it commits new page data, so this runs again after each one.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("id") === selectedId) return;
    if (selectedId) url.searchParams.set("id", selectedId);
    else url.searchParams.delete("id");
    window.history.replaceState(window.history.state, "", url);
  }, [selectedId, listKey, serverRows]);

  // Keep the selected row in view, and keep keyboard focus on it when focus was in the list. Focus
  // also follows when an action asks for it (refocusRow), or when the record that had it (its row,
  // or a control in its detail pane) left this list and dropped it on <body>.
  const rowEls = useRef(new Map<string, HTMLElement>());
  const refocusRow = useRef(false);
  const detailRef = useRef<HTMLElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const shown = useRef<{ id: string | null; listKey: string }>({ id: null, listKey });

  /**
   * Focuses a list element (a row, the list's heading). Below 900px the list is hidden while a record
   * shows, so there the detail pane takes focus instead of leaving it on <body>.
   */
  const focusListOrPane = (el: HTMLElement | null | undefined) => {
    el?.focus({ preventScroll: true });
    if (!el || document.activeElement !== el) detailRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const previous = shown.current;
    shown.current = { id: selectedId, listKey };
    const dropped =
      previous.id !== null &&
      previous.id !== selectedId &&
      previous.listKey === listKey &&
      !rowEls.current.has(previous.id) &&
      isFocusLost();
    const wantsFocus = refocusRow.current || dropped;
    refocusRow.current = false;
    if (!selectedId) {
      // The list emptied under focus: its (visually hidden) heading takes it, so Tab goes on from there.
      if (wantsFocus) focusListOrPane(listHeadingRef.current);
      return;
    }
    const el = rowEls.current.get(selectedId);
    if (wantsFocus) focusListOrPane(el);
    else if (el && isRowFocused() && document.activeElement !== el) el.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId, selectedIndex, listKey]);

  /**
   * Whether focus should move to the next selected row: it is on a row, or in the detail or side
   * pane, which remount for the next record (taking a focused 확인, 지우기, 복제 or 키워드로 저장 along).
   */
  const focusFollowsSelection = () =>
    isRowFocused() ||
    (detailRef.current?.contains(document.activeElement) ?? false) ||
    (asideRef.current?.contains(document.activeElement) ?? false);

  const move = (delta: number) => {
    if (selectedIndex < 0) return;
    const next = rows[Math.min(rows.length - 1, Math.max(0, selectedIndex + delta))];
    if (!next) return;
    // The panes remount for another record, taking a focused control in them (복제, 키워드로 저장) along.
    if (next.id !== selectedId) refocusRow.current = focusFollowsSelection();
    select(next.id);
  };

  /** Focuses the selected row; false when it can't take focus (below 900px the list is hidden). */
  const focusSelectedRow = () => {
    const id = latest.current.selectedId;
    const el = id ? rowEls.current.get(id) : undefined;
    el?.focus({ preventScroll: true });
    return el !== undefined && document.activeElement === el;
  };

  const registerRow = (id: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(id, el);
    else rowEls.current.delete(id);
  };

  // ── Panes: below 900px only one shows at a time ──────────────────────────────
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  // ── Category picker (C), anchored in the detail pane ─────────────────────────
  const [categoryOpenFor, setCategoryOpenFor] = useState<string | null>(null);
  const categoryOpen = selectedId !== null && categoryOpenFor === selectedId;
  // Opened by C or the 분류 바꾸기 button, focus goes back where it was (so J/K keep working)
  // instead of landing on the select's trigger.
  const restoreFocus = useRef<{ el: Element | null } | null>(null);

  const openCategory = () => {
    if (!selected || selected.type === "transfer") return;
    restoreFocus.current = { el: document.activeElement };
    setMobilePane("detail");
    setCategoryOpenFor(selected.id);
  };
  const onCategoryOpenChange = (open: boolean) => {
    if (open) restoreFocus.current = null;
    setCategoryOpenFor(open ? selectedId : null);
  };
  // A closed Select whose trigger has focus runs typeahead on shortcut letters (see noClosedTypeahead
  // in detail-pane), so after a pick or a dismiss focus goes to the selected row, where J/K/E work.
  // Only when the row can't take it (the list hidden below 900px) does the trigger get it back.
  const onSelectCloseAutoFocus = (event: Event) => {
    if (focusSelectedRow()) event.preventDefault();
  };
  const onCategoryCloseAutoFocus = (event: Event) => {
    const restore = restoreFocus.current;
    restoreFocus.current = null;
    const el = restore?.el;
    if (el instanceof HTMLElement && el !== document.body && el.isConnected) {
      // A row hidden since (C from the list below 900px switched to the detail pane) can't take it.
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        event.preventDefault();
        return;
      }
    }
    // Opened from the trigger, or what had focus left with the record (C in 확인할 것 files it): the
    // selected row. Opened by C with nowhere to go back to, focus stays off the trigger: on the
    // detail pane when the list is hidden.
    if (focusSelectedRow()) {
      event.preventDefault();
    } else if (restore) {
      event.preventDefault();
      if (isFocusLost()) detailRef.current?.focus({ preventScroll: true });
    }
  };

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const focusTitle = () => {
    if (!selected) return;
    setMobilePane("detail");
    requestAnimationFrame(() => {
      const input = titleRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };

  // ── Mutations: optimistic on screen, toast on failure ────────────────────────
  function mutate<T>(op: RowOp | null, action: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    startTransition(async () => {
      if (op) applyOp(op);
      let result: ActionResult<T>;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: FAILED };
      }
      if (result.ok) onOk?.(result.data);
      else toast.error(result.error);
    });
  }

  /** Moves the selection off a row that is about to leave the list: the one below, else above. */
  function leave(row: TransactionRow) {
    const index = rows.findIndex((r) => r.id === row.id);
    const nextId = neighborAfterRemoval(rows, row.id);
    refocusRow.current = focusFollowsSelection();
    setSelection({
      id: nextId,
      index: nextId && rows[index + 1]?.id === nextId ? index : Math.max(0, index - 1),
      listKey,
    });
  }

  function confirm(row: TransactionRow) {
    if (!row.pending) return;
    const inReview = query.view === "review";
    if (inReview) {
      leave(row);
    } else {
      const nextId = nextPendingId(rows, row.id);
      if (nextId) {
        refocusRow.current = focusFollowsSelection();
        select(nextId);
      } else if (focusFollowsSelection()) {
        // Nothing else to confirm, so the selection stays, but 확인 (and the side pane's keyword
        // suggestion, which is only for pending records) goes away under focus.
        focusListOrPane(rowEls.current.get(row.id));
      }
    }
    const reviewed = { pending: false, reviewedAt: new Date().toISOString() };
    mutate(
      inReview ? { kind: "remove", id: row.id } : { kind: "patch", id: row.id, patch: reviewed },
      () => confirmTransaction(row.id),
      () => notifyConfirmed(row.id),
    );
  }

  function remove(row: TransactionRow) {
    const wasSelected = row.id === selectedId;
    const index = rows.findIndex((r) => r.id === row.id);
    if (wasSelected) leave(row);
    mutate({ kind: "remove", id: row.id }, () => deleteTransaction(row.id), (deleted) =>
      notifyDeleted(deleted, (id) => {
        // Undo lands back on the record, as long as the user is still looking at the same list.
        if (wasSelected && latest.current.listKey === listKey) setSelection({ id, index, listKey });
      }),
    );
  }

  function duplicate(row: TransactionRow) {
    // The copy is dated today and never pending, with the same type, wallet, category and memo, so
    // it matches this list's filters but shows up only in this month's 전체 or 이체. Elsewhere the
    // selection stays on the original: a hidden id would grab the copy later, when the user switches.
    const showsHere = query.view !== "review" && query.month === currentMonth;
    mutate(null, () => duplicateTransaction(row.id), ({ id }) => {
      if (showsHere) {
        // The pane remounts for the copy, taking a focused 복제 with it.
        refocusRow.current = focusFollowsSelection();
        setSelection({ id, index: selectedIndex, listKey });
      }
      notifyCreated(id, showsHere ? "오늘 날짜로 복제했어요" : "오늘 날짜로 복제했어요 · 이번 달 전체에서 볼 수 있어요");
    });
  }

  function save(row: TransactionRow, patch: TransactionPatch) {
    const display: Partial<TransactionRow> = {};
    if (patch.memo !== undefined) display.memo = patch.memo.trim();
    if (patch.amount !== undefined) display.amount = patch.amount;
    if (patch.date !== undefined) display.date = patch.date;
    if (patch.tags !== undefined) display.tags = patch.tags;
    if (patch.walletId !== undefined) {
      const wallet = ctx.wallets.find((w) => w.id === patch.walletId);
      Object.assign(display, {
        walletId: patch.walletId,
        walletName: wallet?.name ?? row.walletName,
        walletColor: wallet?.color ?? row.walletColor,
      });
    }
    if (patch.toWalletId !== undefined) {
      const wallet = ctx.wallets.find((w) => w.id === patch.toWalletId);
      Object.assign(display, { toWalletId: patch.toWalletId, toWalletName: wallet?.name ?? row.toWalletName });
    }
    // Picking a real category is the review: the server confirms a pending record with it.
    let confirms = false;
    if (patch.categoryId !== undefined) {
      const category = ctx.categories.find((c) => c.id === patch.categoryId);
      Object.assign(display, {
        categoryId: patch.categoryId,
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
      });
      if (patch.categoryId && row.pending) {
        confirms = true;
        Object.assign(display, { pending: false, reviewedAt: new Date().toISOString() });
      }
    }

    const leavesReview = confirms && query.view === "review";
    const newMonth = patch.date ? monthOf(patch.date) : null;
    const leavesMonth = newMonth !== null && query.view !== "review" && newMonth !== query.month;
    if (leavesReview || leavesMonth) leave(row);

    mutate(
      leavesReview || leavesMonth ? { kind: "remove", id: row.id } : { kind: "patch", id: row.id, patch: display },
      () => patchTransaction(row.id, patch),
      () => {
        if (leavesReview) notifyCategorized(row, display.categoryName ?? "");
        else if (leavesMonth) toast.success(`${monthLabel(newMonth, today)} 기록으로 옮겼어요`);
      },
    );
  }

  async function saveKeyword(suggestion: KeywordSuggestion) {
    let result: ActionResult;
    try {
      result = await addCategoryKeyword(suggestion.categoryId, suggestion.word);
    } catch {
      result = { ok: false, error: FAILED };
    }
    if (!result.ok) toast.error(result.error);
    else toast.success(`${quoted(suggestion.word, "을", "를")} ${suggestion.categoryName} 키워드로 저장했어요`);
  }

  const editFully = (row: TransactionRow) =>
    openEditTransaction({
      id: row.id,
      type: row.type,
      amount: row.amount,
      date: row.date,
      walletId: row.walletId,
      toWalletId: row.toWalletId,
      categoryId: row.categoryId,
      memo: row.memo,
      tags: row.tags,
      walletName: row.walletName,
      toWalletName: row.toWalletName,
    });

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  // Moving repeats while the key is held. Confirming, deleting and editing don't: each acts on the
  // selection and then hands it to the next record, so auto-repeat would run down the whole list.
  const removeSelected = (event: KeyboardEvent) => {
    if (!event.repeat && selected) remove(selected);
  };
  useHotkeys({
    j: () => move(1),
    ArrowDown: () => move(1),
    k: () => move(-1),
    ArrowUp: () => move(-1),
    e: (event) => {
      if (!event.repeat && selected) confirm(selected);
    },
    c: (event) => {
      if (!event.repeat) openCategory();
    },
    Backspace: removeSelected,
    Delete: removeSelected,
    Enter: (event) => {
      if (!event.repeat) focusTitle();
    },
    Escape: () => setMobilePane("list"),
  });

  // useHotkeys leaves ⌫/Enter alone while a button has focus (so a focused button never deletes).
  // A focused row is the record itself, so there they mean "delete this" and "edit its memo".
  const onRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return;
    const deletes = event.key === "Backspace" || event.key === "Delete";
    if (!deletes && event.key !== "Enter") return;
    // Also stops a held Enter from clicking the row over and over.
    event.preventDefault();
    if (event.repeat) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (deletes) {
      remove(row);
    } else {
      if (row.id !== selectedId) select(row.id);
      focusTitle();
    }
  };

  // ── Derived view data ─────────────────────────────────────────────────────────
  const groups = groupByDay(rows);
  // Records confirmed or deleted here leave the badge before the server count catches up.
  const visible = new Map(rows.map((r) => [r.id, r]));
  const handled = serverRows.filter((r) => r.pending && !visible.get(r.id)?.pending).length;
  const pendingCount = Math.max(0, reviewCount - handled);
  const insights = selected ? buildInsights(selected, stats, ctx, wallets, today) : null;

  const handlers: DetailHandlers = {
    onSave: save,
    onConfirm: confirm,
    onOpenCategory: openCategory,
    onDuplicate: duplicate,
    onDelete: remove,
    onEdit: editFully,
    onSaveKeyword: saveKeyword,
  };

  return (
    <FullBleed>
      <ListPane
        query={query}
        currentMonth={currentMonth}
        today={today}
        groups={groups}
        selectedId={selectedId}
        pendingCount={pendingCount}
        ctx={ctx}
        wallets={wallets}
        onSelect={(id) => {
          select(id);
          setMobilePane("detail");
        }}
        onRowKeyDown={onRowKeyDown}
        registerRow={registerRow}
        onNewEntry={() => setQuickEntryOpen(true)}
        headingRef={listHeadingRef}
        className={cn("w-full border-line-soft min-[900px]:border-r", LIST_PANE_WIDTH, mobilePane === "detail" && "max-[900px]:hidden")}
      />
      <DetailPane
        // A new record starts at the top of the pane.
        key={`detail:${selectedId ?? "none"}`}
        ref={detailRef}
        row={selected}
        view={query.view}
        filtered={isFiltered(query)}
        ctx={ctx}
        today={today}
        insights={insights}
        titleRef={titleRef}
        categoryOpen={categoryOpen}
        onCategoryOpenChange={onCategoryOpenChange}
        onCategoryCloseAutoFocus={onCategoryCloseAutoFocus}
        onSelectCloseAutoFocus={onSelectCloseAutoFocus}
        onBack={() => setMobilePane("list")}
        handlers={handlers}
        className={cn("flex-1", mobilePane === "list" && "max-[900px]:hidden")}
      />
      {insights ? (
        <aside key={`side:${selectedId}`} ref={asideRef} aria-label="옆 정보" className={sidePaneClass}>
          <InsightBlocks insights={insights} onSaveKeyword={saveKeyword} className="flex flex-col gap-4 p-5" />
        </aside>
      ) : (
        // Nothing selected (an empty list): the side column stays so the frame doesn't jump.
        <div aria-hidden className={sidePaneClass} />
      )}
    </FullBleed>
  );
}

const sidePaneClass = cn(
  "hidden min-h-0 shrink-0 overflow-y-auto border-l border-line-soft bg-side xl:block",
  SIDE_PANE_WIDTH,
);

function isRowFocused() {
  const active = document.activeElement;
  return active instanceof HTMLElement && active.dataset.rowId !== undefined;
}

/** Focus is nowhere: the element that had it was removed or blurred itself (Enter in a field). */
function isFocusLost() {
  const active = document.activeElement;
  return active === null || active === document.body;
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function buildInsights(
  row: TransactionRow,
  stats: Record<string, MonthStats>,
  ctx: EntryContext,
  wallets: WalletBalance[],
  today: string,
): Insights {
  const monthStats = stats[monthOf(row.date)];
  const to = row.type === "transfer" ? (wallets.find((w) => w.id === row.toWalletId) ?? null) : null;
  return {
    sameMemo: monthStats ? sameMemoInsight(row, monthStats.rows, today) : null,
    category: monthStats ? categoryInsight(row, monthStats, today) : null,
    suggestion: keywordSuggestion(row, ctx.categories),
    transfer:
      row.type === "transfer"
        ? { from: wallets.find((w) => w.id === row.walletId) ?? null, to, toCard: to?.kind === "card" }
        : null,
  };
}

/**
 * Picking a category in 확인할 것 files the record and it leaves the queue. Undo puts back both the
 * old category and the pending state.
 */
function notifyCategorized(row: TransactionRow, categoryName: string) {
  toast.success(`${withRo(categoryName)} 바꾸고 확인했어요`, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        let result: ActionResult;
        try {
          const reverted = await patchTransaction(row.id, { categoryId: row.categoryId });
          result = reverted.ok ? await unconfirmTransaction(row.id) : reverted;
        } catch {
          result = { ok: false, error: FAILED };
        }
        if (result.ok) toast("되돌렸어요");
        else toast.error(result.error);
      },
    },
  });
}
