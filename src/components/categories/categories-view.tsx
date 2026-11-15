"use client";

import { PlusIcon, TagIcon } from "@phosphor-icons/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Amount, EmptyState, FullBleed, PaneHeader } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { tabPillVariants } from "@/components/ui/tabs";
import { useHotkeys } from "@/lib/hotkeys";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addCategoryKeyword, deleteCategory, updateCategory, type ActionResult } from "@/server/actions";
import type { CategoryRow, TransactionRow } from "@/server/queries";
import {
  attempt,
  ListKeysHint,
  ListRow,
  quoted,
  useCreateDialog,
  useListNavigation,
  useMirrorSelection,
  useSelection,
} from "@/components/wallets/ledger-kit";
import { CategoryCreateDialog } from "./category-create-dialog";
import { CategoryDetail, type CategoryPatch } from "./category-detail";
import { KIND_LABEL, KINDS, type CategoryKind } from "./category-fields";

const PATH = "/categories";

/**
 * Optimistic edits. Keyword changes are relative (add these / drop this one), so edits queued one
 * after another compose on the screen however their server calls interleave.
 */
type OptimisticChange =
  | { id: string; patch: CategoryPatch }
  | { id: string; addKeywords: string[] }
  | { id: string; removeKeyword: string }
  | { id: string; removed: true };

function applyChange(list: CategoryRow[], change: OptimisticChange): CategoryRow[] {
  if ("removed" in change) return list.filter((c) => c.id !== change.id);
  return list.map((c) => {
    if (c.id !== change.id) return c;
    if ("patch" in change) return { ...c, ...change.patch };
    if ("removeKeyword" in change) return { ...c, keywords: c.keywords.filter((k) => k !== change.removeKeyword) };
    const fresh = change.addKeywords.filter((w) => !c.keywords.some((k) => k.toLowerCase() === w.toLowerCase()));
    return { ...c, keywords: [...c.keywords, ...fresh] };
  });
}

const toInput = (c: CategoryRow) => ({ kind: c.kind, name: c.name, icon: c.icon, color: c.color, keywords: c.keywords });

/**
 * 카테고리 screen. Left: 지출 / 수입 tabs, each category with this month's amount. Right: the selected
 * category. The selection is client state mirrored to ?id=; edits are optimistic and the server's
 * refresh() brings the confirmed data.
 */
export function CategoriesView({
  categories,
  usual,
  records,
  month,
  today,
}: {
  categories: CategoryRow[];
  /** Average month per category id over the 3 months before this one. */
  usual: Record<string, number>;
  /** This month's records. */
  records: TransactionRow[];
  month: string;
  today: string;
}) {
  const [items, addOptimistic] = useOptimistic(categories, applyChange);
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useSelection(PATH);
  const [createOpen, setCreateOpen] = useCreateDialog(PATH);
  // The open tab while nothing on it is selected (an empty 수입 tab); otherwise the selection says it.
  const [tab, setTab] = useState<CategoryKind>("expense");
  // The last category picked on each tab, so switching tabs comes back to it.
  const lastByKind = useRef<Partial<Record<CategoryKind, string>>>({});
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Set when a delete takes the detail (and its confirm dialog) away: focus goes to this row next.
  const focusAfterRemoval = useRef<string | null | undefined>(undefined);

  const monthly = useMemo(() => {
    const byCategory = new Map<string, TransactionRow[]>();
    const totals: Record<CategoryKind, number> = { expense: 0, income: 0 };
    const uncategorized: Record<CategoryKind, number> = { expense: 0, income: 0 };
    for (const row of records) {
      if (row.type === "transfer") continue;
      totals[row.type] += row.amount;
      if (!row.categoryId) {
        uncategorized[row.type] += row.amount;
        continue;
      }
      const list = byCategory.get(row.categoryId);
      if (list) list.push(row);
      else byCategory.set(row.categoryId, [row]);
    }
    return { byCategory, totals, uncategorized };
  }, [records]);

  const byKind: Record<CategoryKind, CategoryRow[]> = {
    expense: items.filter((c) => c.kind === "expense"),
    income: items.filter((c) => c.kind === "income"),
  };
  const picked = items.find((c) => c.id === selectedId);
  const kind: CategoryKind = picked?.kind ?? tab;
  const list = byKind[kind];
  const selected = picked ?? list[0] ?? null;
  const keywordCount = items.reduce((sum, c) => sum + c.keywords.length, 0);
  const monthNo = Number(month.slice(5));
  useMirrorSelection(PATH, selected?.id ?? null, categories);

  /** Selects a category (or nothing on `onTab`); `onTab` also names the tab of one not loaded yet. */
  function select(id: string | null, onTab?: CategoryKind) {
    const next = onTab ?? items.find((c) => c.id === id)?.kind;
    if (next) setTab(next);
    if (id && next) lastByKind.current[next] = id;
    setSelectedId(id);
  }

  function changeKind(next: CategoryKind) {
    if (next === kind) return;
    const target = byKind[next].find((c) => c.id === lastByKind.current[next]) ?? byKind[next][0];
    select(target?.id ?? null, next);
  }

  const { listRef, move, onKeyDown: onListKeyDown } = useListNavigation(
    list.map((c) => c.id),
    selected?.id ?? null,
    select,
  );
  useHotkeys({ j: () => move("next"), k: () => move("prev") });

  useEffect(() => {
    const target = focusAfterRemoval.current;
    if (target === undefined) return;
    focusAfterRemoval.current = undefined;
    const row = target ? listRef.current?.querySelector<HTMLElement>(`[data-row-id="${target}"]`) : null;
    (row ?? addButtonRef.current)?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  });

  /** One optimistic edit and its server call; a refusal rolls the edit back with a toast. */
  function save(change: OptimisticChange, run: () => Promise<ActionResult>, onSaved?: () => void) {
    startTransition(async () => {
      addOptimistic(change);
      const result = await attempt(run);
      if (!result.ok) toast.error(result.error);
      else onSaved?.();
    });
  }

  /**
   * Edits from the detail pane pin the selection first, so a category that was only selected as
   * "the first on the tab" stays selected whatever the list does next.
   */
  function pin(category: CategoryRow) {
    if (selectedId !== category.id) select(category.id);
  }

  function patchCategory(category: CategoryRow, patch: CategoryPatch) {
    pin(category);
    save({ id: category.id, patch }, () => updateCategory(category.id, toInput({ ...category, ...patch })));
  }

  function addKeywords(category: CategoryRow, words: string[]) {
    const fresh = words.filter((w) => !category.keywords.some((k) => k.toLowerCase() === w.toLowerCase()));
    if (fresh.length === 0) return;
    pin(category);
    save({ id: category.id, addKeywords: fresh }, () =>
      fresh.length === 1
        ? addCategoryKeyword(category.id, fresh[0])
        : updateCategory(category.id, toInput({ ...category, keywords: [...category.keywords, ...fresh] })),
    );
  }

  function removeKeyword(category: CategoryRow, word: string) {
    const keywords = category.keywords.filter((k) => k !== word);
    pin(category);
    save(
      { id: category.id, removeKeyword: word },
      () => updateCategory(category.id, toInput({ ...category, keywords })),
      () =>
        toast(`${quoted(word, "을", "를")} 키워드에서 뺐어요`, {
          duration: 8000,
          action: {
            label: "되돌리기",
            // Optimistic too, so an edit made right after the undo already counts the word back in.
            // It leaves the selection where it is now.
            onClick: () =>
              save({ id: category.id, addKeywords: [word] }, () => addCategoryKeyword(category.id, word), () =>
                toast.success(`${quoted(word, "을", "를")} 다시 넣었어요`),
              ),
          },
        }),
    );
  }

  // Gone from the list at once, with the selection (and focus) on its neighbour; the category comes
  // back, selected, if the server refuses.
  function removeCategory(category: CategoryRow) {
    const siblings = byKind[category.kind];
    const at = siblings.findIndex((c) => c.id === category.id);
    const neighbor = siblings[at + 1] ?? siblings[at - 1] ?? null;
    select(neighbor?.id ?? null, category.kind);
    focusAfterRemoval.current = neighbor?.id ?? null;
    startTransition(async () => {
      addOptimistic({ id: category.id, removed: true });
      const result = await attempt(() => deleteCategory(category.id));
      if (!result.ok) {
        toast.error(result.error);
        select(category.id, category.kind);
        return;
      }
      toast.success(`${quoted(category.name, "을", "를")} 지웠어요`);
    });
  }

  const uncategorized = monthly.uncategorized[kind];

  return (
    <FullBleed>
      <section aria-label="카테고리 목록" className="flex w-[300px] shrink-0 flex-col border-r border-line-soft lg:w-[340px]">
        <PaneHeader title="카테고리" description={`키워드 ${keywordCount}개가 한 줄 입력을 나눠요`}>
          <Button
            ref={addButtonRef}
            variant="outline"
            aria-label={`${KIND_LABEL[kind]} 카테고리 추가`}
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon aria-hidden />
            추가
          </Button>
        </PaneHeader>

        <TabsPrimitive.Root
          value={kind}
          onValueChange={(value) => changeKind(value as CategoryKind)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsPrimitive.List aria-label="카테고리 종류" className="flex shrink-0 gap-1.5 px-3 pt-3 pb-2">
            {KINDS.map((k) => (
              <TabsPrimitive.Trigger key={k} value={k} className={tabPillVariants({ active: k === kind })}>
                {KIND_LABEL[k]}
                <span className="num font-semibold">{byKind[k].length}</span>
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          {/* The list ref sits on one wrapper: Radix renders both panels and attaches a panel's ref only
              once, at mount. The inactive panel is hidden and empty, so lookups find the open tab's rows. */}
          <div ref={listRef} className="flex min-h-0 flex-1 flex-col">
            {KINDS.map((k) => (
              <TabsPrimitive.Content
                key={k}
                value={k}
                onKeyDown={onListKeyDown}
                className="min-h-0 flex-1 overflow-y-auto pb-3 focus-visible:outline-offset-[-2px]"
              >
                {byKind[k].length === 0 ? (
                  <EmptyState
                    icon={<TagIcon aria-hidden />}
                    title={`${KIND_LABEL[k]} 카테고리가 없어요`}
                    description="카테고리를 만들고 키워드를 넣어 두면 한 줄 입력이 알아서 나눠요."
                    action={
                      <Button variant="outline" onClick={() => setCreateOpen(true)}>
                        <PlusIcon aria-hidden />
                        카테고리 추가
                      </Button>
                    }
                  />
                ) : (
                  byKind[k].map((category) => {
                    const rows = monthly.byCategory.get(category.id) ?? [];
                    const total = rows.reduce((sum, row) => sum + row.amount, 0);
                    return (
                      <ListRow
                        key={category.id}
                        id={category.id}
                        selected={category.id === selected?.id}
                        onSelect={(id) => select(id)}
                      >
                        <CategoryIcon icon={category.icon} color={category.color} className="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{category.name}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {rows.length > 0 ? `이번 달 ${rows.length}건` : "이번 달 기록 없음"} ·{" "}
                            {category.keywords.length > 0 ? `키워드 ${category.keywords.length}개` : "키워드 없음"}
                          </span>
                        </span>
                        {total > 0 ? (
                          <Amount value={total} type={category.kind} className="shrink-0" />
                        ) : (
                          <span className="num shrink-0 font-bold text-ink-3">0원</span>
                        )}
                      </ListRow>
                    );
                  })
                )}
              </TabsPrimitive.Content>
            ))}
          </div>
        </TabsPrimitive.Root>

        <footer className="shrink-0 space-y-2.5 border-t border-line-soft px-5 py-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-ink-3">
                {monthNo}월 {KIND_LABEL[kind]}
              </span>
              <span
                className={cn(
                  "text-xl font-extrabold tracking-[-0.03em] tabular-nums",
                  monthly.totals[kind] === 0 ? "text-ink-3" : kind === "income" && "text-income",
                )}
              >
                {formatKRW(monthly.totals[kind])}
              </span>
            </div>
            {uncategorized > 0 && (
              <p className="mt-0.5 text-right text-xs text-ink-3">
                분류 없는 기록 <span className="num">{formatKRW(uncategorized)}</span> 포함
              </p>
            )}
          </div>
          {list.length > 1 && <ListKeysHint />}
        </footer>
      </section>

      {selected ? (
        <CategoryDetail
          key={selected.id}
          category={selected}
          categories={items}
          rows={monthly.byCategory.get(selected.id) ?? []}
          usual={usual[selected.id]}
          month={month}
          today={today}
          onPatch={(patch) => patchCategory(selected, patch)}
          onAddKeywords={(words) => addKeywords(selected, words)}
          onRemoveKeyword={(word) => removeKeyword(selected, word)}
          onDelete={() => removeCategory(selected)}
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<TagIcon aria-hidden />}
            title={`${KIND_LABEL[kind]} 카테고리가 아직 없어요`}
            description="카테고리를 추가하면 여기서 이름, 아이콘, 키워드를 다듬고 이번 달 기록을 볼 수 있어요."
          />
        </div>
      )}

      <CategoryCreateDialog
        open={createOpen}
        defaultKind={kind}
        categories={items}
        onOpenChange={setCreateOpen}
        onCreated={(id, createdKind) => {
          setCreateOpen(false);
          select(id, createdKind);
        }}
      />
    </FullBleed>
  );
}
