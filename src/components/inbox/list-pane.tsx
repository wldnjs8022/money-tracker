"use client";

import {
  ArrowsLeftRightIcon,
  CalendarDotsIcon,
  ChecksIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReceiptIcon,
  WalletIcon as WalletGlyph,
  TagIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, useTransition } from "react";
import { INBOX_VIEW_LABEL, type InboxView } from "@/components/app/nav";
import { Amount, EmptyState, Kbd } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { MonthNav } from "@/components/month-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { tabPillVariants } from "@/components/ui/tabs";
import { REVIEW_CHIP } from "@/lib/review";
import { cn } from "@/lib/utils";
import type { EntryContext, TransactionRow } from "@/server/queries";
import type { WalletBalance } from "./insights";
import {
  dayLabel,
  inboxHref,
  isFiltered,
  rowSubtitle,
  rowTitle,
  type DayGroup,
  type InboxQuery,
  type TypeFilter,
} from "./model";

const VIEWS: InboxView[] = ["review", "all", "transfer"];
const TYPE_FILTER_LABEL: Record<TypeFilter, string> = { expense: "지출", income: "수입" };
const ALL = "all";
const NONE = "none";

export function ListPane({
  query,
  currentMonth,
  today,
  groups,
  selectedId,
  pendingCount,
  ctx,
  wallets,
  onSelect,
  onRowKeyDown,
  registerRow,
  onNewEntry,
  headingRef,
  className,
}: {
  query: InboxQuery;
  currentMonth: string;
  today: string;
  groups: DayGroup[];
  selectedId: string | null;
  pendingCount: number;
  ctx: EntryContext;
  wallets: WalletBalance[];
  onSelect: (id: string) => void;
  onRowKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: string) => void;
  registerRow: (id: string) => (el: HTMLElement | null) => void;
  onNewEntry: () => void;
  /** Takes focus when the last record leaves the list under it (tabIndex -1, visually hidden). */
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  // Filters and search replace the history entry (tabs and months push one).
  const navigate = (patch: Partial<InboxQuery>) =>
    startNavigation(() => router.replace(inboxHref(query, currentMonth, patch), { scroll: false }));

  const filtered = isFiltered(query);
  const firstRowId = groups[0]?.rows[0]?.id ?? null;
  const focusableId = selectedId ?? firstRowId;

  return (
    <section aria-label="기록 목록" className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0 space-y-2 border-b border-line-soft p-3">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          기록 · {INBOX_VIEW_LABEL[query.view]}
        </h1>
        <nav aria-label="기록 보기" className="flex gap-1.5">
          {VIEWS.map((view) => {
            const active = query.view === view;
            return (
              <Link
                key={view}
                href={inboxHref(query, currentMonth, { view })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={tabPillVariants({ active })}
              >
                {INBOX_VIEW_LABEL[view]}
                {view === "review" && pendingCount > 0 && (
                  <Badge variant="signal" className="min-w-[18px] px-1.5 text-xs tabular-nums">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {query.view === "review" ? (
          <p className="flex h-10 items-center gap-1.5 px-0.5 text-sm font-bold">
            <CalendarDotsIcon aria-hidden className="size-4 text-ink-3" />
            모든 달
            <span className="truncate text-xs font-medium text-ink-3">· 달과 상관없이 모아 봐요</span>
          </p>
        ) : (
          <MonthNav
            month={query.month}
            current={currentMonth}
            basePath="/transactions"
            params={{
              view: query.view === "all" ? undefined : query.view,
              type: query.type,
              wallet: query.wallet,
              category: query.category,
              q: query.q,
            }}
          />
        )}

        <div className="flex gap-2">
          <SearchBox value={query.q ?? ""} onSearch={(q) => navigate({ q: q || undefined })} />
          <FilterMenu query={query} ctx={ctx} wallets={wallets} onChange={navigate} />
        </div>
        <FilterChips query={query} ctx={ctx} wallets={wallets} onChange={navigate} />
      </div>

      <div
        aria-busy={navigating || undefined}
        className={cn("min-h-0 flex-1 overflow-y-auto transition-opacity duration-150", navigating && "opacity-60")}
      >
        {groups.length === 0 ? (
          <ListEmpty
            query={query}
            filtered={filtered}
            allHref={inboxHref(query, currentMonth, { view: "all" })}
            onClearFilters={() => navigate({ type: undefined, wallet: undefined, category: undefined, q: undefined })}
            onNewEntry={onNewEntry}
          />
        ) : (
          groups.map((group) => (
            <DaySection
              key={group.date}
              group={group}
              today={today}
              selectedId={selectedId}
              focusableId={focusableId}
              onSelect={onSelect}
              onRowKeyDown={onRowKeyDown}
              registerRow={registerRow}
            />
          ))
        )}
      </div>

      <p className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-line-soft px-4 py-3 text-xs text-ink-3 max-[900px]:hidden">
        <span>
          <b className="font-bold text-foreground">J / K</b> 위아래
        </span>
        <span>
          <b className="font-bold text-foreground">E</b> 확인
        </span>
        <span>
          <b className="font-bold text-foreground">C</b> 분류
        </span>
        <span>
          <b className="font-bold text-foreground">⌫</b> 지우기
        </span>
        <span>
          <b className="font-bold text-foreground">↵</b> 메모 고치기
        </span>
      </p>
    </section>
  );
}

function DaySection({
  group,
  today,
  selectedId,
  focusableId,
  onSelect,
  onRowKeyDown,
  registerRow,
}: {
  group: DayGroup;
  today: string;
  selectedId: string | null;
  focusableId: string | null;
  onSelect: (id: string) => void;
  onRowKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: string) => void;
  registerRow: (id: string) => (el: HTMLElement | null) => void;
}) {
  const headingId = useId();
  const label = dayLabel(group.date, today);
  // A group, not a <section>: a named section is a landmark, and a month would add 31 of them.
  return (
    <div role="group" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-card px-4 pt-2.5 pb-1 text-xs font-bold text-ink-3"
      >
        <span>{label}</span>
        {group.expense > 0 ? (
          <span className="tabular-nums">
            <span className="sr-only">지출 </span>−{group.expense.toLocaleString("ko-KR")}
          </span>
        ) : group.income > 0 ? (
          <span className="text-income tabular-nums">
            <span className="sr-only">수입 </span>+{group.income.toLocaleString("ko-KR")}
          </span>
        ) : null}
      </h2>
      <ul>
        {group.rows.map((row) => (
          <li key={row.id}>
            <Row
              row={row}
              selected={row.id === selectedId}
              focusable={row.id === focusableId}
              onSelect={onSelect}
              onKeyDown={onRowKeyDown}
              ref={registerRow(row.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  row,
  selected,
  focusable,
  onSelect,
  onKeyDown,
  ref,
}: {
  row: TransactionRow;
  selected: boolean;
  focusable: boolean;
  onSelect: (id: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: string) => void;
  ref: (el: HTMLElement | null) => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      data-row-id={row.id}
      tabIndex={focusable ? 0 : -1}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => onKeyDown(event, row.id)}
      className={cn(
        "flex min-h-[60px] w-full scroll-mt-8 items-center gap-2.5 border-t border-muted px-4 py-2 text-left transition-colors duration-150 focus-visible:-outline-offset-2",
        selected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          row.pending
            ? "bg-signal shadow-[0_0_0_3px_color-mix(in_oklch,var(--signal)_35%,transparent)]"
            : "bg-dot dark:bg-ink-4/60",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate font-semibold", !row.memo && "text-ink-2")}>{rowTitle(row)}</span>
          {row.pending && (
            <>
              <span className="sr-only">, 확인할 것</span>
              {row.reviewReason && <Badge variant="tint">{REVIEW_CHIP[row.reviewReason]}</Badge>}
            </>
          )}
        </span>
        <span className="block truncate text-xs text-ink-3">{rowSubtitle(row)}</span>
      </span>
      <Amount value={row.amount} type={row.type} className="text-sm" />
    </button>
  );
}

function ListEmpty({
  query,
  filtered,
  allHref,
  onClearFilters,
  onNewEntry,
}: {
  query: InboxQuery;
  filtered: boolean;
  allHref: string;
  onClearFilters: () => void;
  onNewEntry: () => void;
}) {
  const newEntry = (
    <Button onClick={onNewEntry} aria-keyshortcuts="N" className="gap-1.5 font-bold">
      <PlusIcon aria-hidden weight="bold" className="size-3.5" />
      기록
      <span aria-hidden className="ml-0.5 text-[11px] font-bold text-primary-hint">
        N
      </span>
    </Button>
  );
  if (filtered) {
    return (
      <EmptyState
        icon={<FunnelSimpleIcon />}
        title="조건에 맞는 기록이 없어요"
        description="검색어나 필터를 바꿔 보세요."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            검색·필터 지우기
          </Button>
        }
      />
    );
  }
  if (query.view === "review") {
    return (
      <EmptyState
        icon={<ChecksIcon />}
        title="확인할 게 없어요"
        description="새로 들어온 기록을 모두 확인했어요."
        action={
          <Button asChild variant="outline">
            <Link href={allHref}>전체 기록 보기</Link>
          </Button>
        }
      />
    );
  }
  if (query.view === "transfer") {
    return (
      <EmptyState
        icon={<ArrowsLeftRightIcon />}
        title="이 달엔 이체가 없어요"
        description="카드값처럼 계좌끼리 옮긴 돈이 여기 모여요."
        action={newEntry}
      />
    );
  }
  return (
    <EmptyState
      icon={<ReceiptIcon />}
      title="이 달엔 기록이 없어요"
      description="한 줄로 적으면 분류는 알아서 나눠요."
      action={newEntry}
    />
  );
}

/**
 * Search as you type (250ms) into the URL's q. The field keeps its own draft and only takes the
 * URL's value when it changes from elsewhere (a cleared chip, back/forward), never the echo of
 * what it just sent, so typing is never overwritten mid-word.
 */
function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setDraft(value);
      setSent(value);
    }
  }

  const search = useEffectEvent((q: string) => onSearch(q));
  useEffect(() => {
    const q = draft.trim();
    if (q === sent) return;
    const timer = setTimeout(() => {
      setSent(q);
      search(q);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, sent]);

  // Compared with what was last sent as well as the URL: while a search is still on its way the URL
  // has the old q, and clearing back to it must still replace that search.
  const submit = (q: string) => {
    const changed = q !== sent || q !== value;
    setSent(q);
    if (changed) onSearch(q);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
      <Input
        ref={inputRef}
        data-page-search
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            submit(draft.trim());
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        aria-label="기록 검색 (메모·태그·분류)"
        aria-keyshortcuts="/"
        placeholder="메모·태그 검색"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        className="h-10 pr-9 pl-9"
      />
      {draft ? (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => {
            setDraft("");
            submit("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      ) : (
        <Kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3">/</Kbd>
      )}
    </div>
  );
}

function walletName(wallets: WalletBalance[], id: string) {
  return wallets.find((w) => w.id === id)?.name ?? "알 수 없는 계좌";
}

function categoryName(ctx: EntryContext, id: string) {
  if (id === NONE) return "분류 없음";
  return ctx.categories.find((c) => c.id === id)?.name ?? "보관된 분류";
}

function FilterMenu({
  query,
  ctx,
  wallets,
  onChange,
}: {
  query: InboxQuery;
  ctx: EntryContext;
  wallets: WalletBalance[];
  onChange: (patch: Partial<InboxQuery>) => void;
}) {
  const showTypeAndCategory = query.view !== "transfer";
  const active = [query.type, query.wallet, query.category].filter(Boolean).length;
  const categoryGroups = (["expense", "income"] as const)
    .filter((kind) => !query.type || query.type === kind)
    .map((kind) => ({ kind, items: ctx.categories.filter((c) => c.kind === kind) }));

  const setType = (value: string) => {
    const type = value === ALL ? undefined : (value as TypeFilter);
    // A category of the other kind would match nothing, so it goes with the switch.
    const kind = ctx.categories.find((c) => c.id === query.category)?.kind;
    onChange({ type, category: type && kind && kind !== type ? undefined : query.category });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="shrink-0 gap-1.5 px-3">
          <FunnelSimpleIcon aria-hidden />
          필터
          {active > 0 && (
            <Badge className="min-w-[18px] tabular-nums">
              <span className="sr-only">켜진 필터 </span>
              {active}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {showTypeAndCategory && (
          <>
            <DropdownMenuLabel>종류</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={query.type ?? ALL} onValueChange={setType}>
              <DropdownMenuRadioItem value={ALL}>지출·수입 모두</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="expense">지출만</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="income">수입만</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <WalletGlyph aria-hidden />
            계좌
            <span className="min-w-0 flex-1 truncate text-right text-xs text-ink-3">
              {query.wallet ? walletName(wallets, query.wallet) : "모두"}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={query.wallet ?? ALL}
              onValueChange={(v) => onChange({ wallet: v === ALL ? undefined : v })}
            >
              <DropdownMenuRadioItem value={ALL}>모든 계좌</DropdownMenuRadioItem>
              {wallets.map((w) => (
                <DropdownMenuRadioItem key={w.id} value={w.id}>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                  <span className="truncate">{w.name}</span>
                  {w.archived && <span className="text-xs text-ink-3">보관됨</span>}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {showTypeAndCategory && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TagIcon aria-hidden />
              분류
              <span className="min-w-0 flex-1 truncate text-right text-xs text-ink-3">
                {query.category ? categoryName(ctx, query.category) : "모두"}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto">
              <DropdownMenuRadioGroup
                value={query.category ?? ALL}
                onValueChange={(v) => onChange({ category: v === ALL ? undefined : v })}
              >
                <DropdownMenuRadioItem value={ALL}>모든 분류</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value={NONE}>
                  <CategoryIcon icon="❔" className="size-5 rounded-[5px]" />
                  분류 없음
                </DropdownMenuRadioItem>
                {categoryGroups.map(({ kind, items }) => (
                  <div key={kind} role="group" aria-label={TYPE_FILTER_LABEL[kind]}>
                    <DropdownMenuLabel>{TYPE_FILTER_LABEL[kind]}</DropdownMenuLabel>
                    {items.map((c) => (
                      <DropdownMenuRadioItem key={c.id} value={c.id}>
                        <CategoryIcon icon={c.icon} color={c.color} className="size-5 rounded-[5px]" />
                        <span className="truncate">{c.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {active > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange({ type: undefined, wallet: undefined, category: undefined })}>
              <XIcon aria-hidden />
              필터 모두 끄기
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Active filters as removable chips under the search field (the search text lives in the field). */
function FilterChips({
  query,
  ctx,
  wallets,
  onChange,
}: {
  query: InboxQuery;
  ctx: EntryContext;
  wallets: WalletBalance[];
  onChange: (patch: Partial<InboxQuery>) => void;
}) {
  const chips: { key: string; label: string; clear: Partial<InboxQuery> }[] = [];
  if (query.type) chips.push({ key: "type", label: TYPE_FILTER_LABEL[query.type], clear: { type: undefined } });
  if (query.wallet) chips.push({ key: "wallet", label: walletName(wallets, query.wallet), clear: { wallet: undefined } });
  if (query.category) chips.push({ key: "category", label: categoryName(ctx, query.category), clear: { category: undefined } });
  if (chips.length === 0) return null;
  return (
    <ul aria-label="켜진 필터" className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.clear)}
            aria-label={`${chip.label} 필터 끄기`}
            className="inline-flex h-8 max-w-[200px] items-center gap-1 rounded-[7px] bg-muted pr-1.5 pl-2.5 text-xs font-bold transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]"
          >
            <span className="truncate">{chip.label}</span>
            <XIcon aria-hidden className="size-3 shrink-0 text-ink-3" />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button
            type="button"
            onClick={() => onChange({ type: undefined, wallet: undefined, category: undefined })}
            className="h-8 rounded-[7px] px-2 text-xs font-semibold text-ink-3 transition-colors hover:bg-muted hover:text-foreground"
          >
            모두 끄기
          </button>
        </li>
      )}
    </ul>
  );
}
