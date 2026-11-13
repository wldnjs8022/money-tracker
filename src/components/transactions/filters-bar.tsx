"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Kbd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHotkeys } from "@/lib/hotkeys";
import type { EntryContext } from "@/server/queries";

export type FilterValues = {
  month?: string;
  type?: string;
  wallet?: string;
  category?: string;
  q?: string;
};

const ALL = "all";

export function FiltersBar({ values, ctx }: { values: FilterValues; ctx: EntryContext }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(values.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(patch: Partial<FilterValues>) {
    const next = { ...values, ...patch };
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && v !== ALL) search.set(k, v);
    const qs = search.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounced search-as-you-type
  useEffect(() => {
    if ((values.q ?? "") === q) return;
    const t = setTimeout(() => apply({ q: q || undefined }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useHotkeys({ "/": () => searchRef.current?.focus() });

  const hasFilters = Boolean(values.type || values.wallet || values.category || values.q);
  const expenseCats = ctx.categories.filter((c) => c.kind === "expense");
  const incomeCats = ctx.categories.filter((c) => c.kind === "income");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={values.type ?? ALL}
        onValueChange={(v) => v && apply({ type: v })}
      >
        <ToggleGroupItem value={ALL}>전체</ToggleGroupItem>
        <ToggleGroupItem value="expense">지출</ToggleGroupItem>
        <ToggleGroupItem value="income">수입</ToggleGroupItem>
        <ToggleGroupItem value="transfer">이체</ToggleGroupItem>
      </ToggleGroup>

      <Select value={values.wallet ?? ALL} onValueChange={(v) => apply({ wallet: v })}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 계좌</SelectItem>
          {ctx.wallets.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              <span className="size-2 rounded-full" style={{ backgroundColor: w.color }} />
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={values.category ?? ALL} onValueChange={(v) => apply({ category: v })}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 카테고리</SelectItem>
          <SelectItem value="none">❔ 미분류</SelectItem>
          <SelectGroup>
            <SelectLabel>지출</SelectLabel>
            {expenseCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>수입</SelectLabel>
            {incomeCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="relative ml-auto w-64">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQ("");
              e.currentTarget.blur();
            }
          }}
          placeholder="메모, 태그, 카테고리 검색"
          className="h-8 pr-8 pl-8"
        />
        {!q && <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>}
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            apply({ type: undefined, wallet: undefined, category: undefined, q: undefined });
          }}
        >
          <XIcon />
          필터 해제
        </Button>
      )}
    </div>
  );
}
