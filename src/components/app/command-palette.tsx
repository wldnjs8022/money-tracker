"use client";

import {
  CalendarIcon,
  KeyboardIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NotePencilIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { chordKeys, NAV, type NavItem } from "@/components/app/nav";
import { useUI } from "@/components/app/ui-provider";
import { useSignOut } from "@/components/app/use-sign-out";
import { Amount, Kbd, TYPE_LABEL } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import { saveQuickEntry, useQuickParse } from "@/components/transactions/quick-entry-dialog";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { addMonths, currentMonthKST, formatMonthKo } from "@/lib/dates";
import { hasOneConfidentAmount } from "@/lib/quick-entry";
import type { EntryContext } from "@/server/queries";

/** Extra words each section answers to, including the names the old app used. */
const NAV_KEYWORDS: Record<NavItem["href"], string[]> = {
  "/": ["대시보드", "home"],
  "/transactions": ["거래", "내역", "기록함", "transactions"],
  "/wallets": ["지갑", "통장", "카드", "wallets"],
  "/categories": ["분류", "categories"],
};

export function CommandPalette({ ctx }: { ctx: EntryContext }) {
  const { paletteOpen, setPaletteOpen } = useUI();
  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="검색 · 명령"
      description="이동하거나, 바로 기록하거나, 기록을 찾아요"
      className="sm:max-w-[600px]"
    >
      {/* Mounted with the dialog content: the search survives the close animation and resets on open. */}
      <PaletteBody ctx={ctx} />
    </CommandDialog>
  );
}

function PaletteBody({ ctx }: { ctx: EntryContext }) {
  const { paletteOpen, setPaletteOpen, setQuickEntryOpen, openNewTransaction, setHelpOpen } = useUI();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const signOut = useSignOut();
  const parse = useQuickParse(ctx);
  const [search, setSearch] = useState("");

  // Typing "커피 4500" offers to record it right away (rule parser, saved as a quick entry). Only with
  // exactly one amount typed on its own that looks like a price: "GS25", "이마트 24" or "아이폰 15" is
  // something to search for, not a 25원 expense, and a line with two amounts needs quick entry (N) to
  // split it. Otherwise 찾기 comes first.
  const query = search.trim();
  const parsed = query && hasOneConfidentAmount(query) ? parse(query) : null;
  const recordable =
    parsed && parsed.amount && parsed.walletId && (parsed.type !== "transfer" || parsed.toWalletId) ? parsed : null;
  const recordCategory = ctx.categories.find((c) => c.id === recordable?.categoryId);
  const recordWallet = ctx.wallets.find((w) => w.id === recordable?.walletId);
  const lastMonth = addMonths(currentMonthKST(), -1);
  const dark = resolvedTheme === "dark";

  // The body stays mounted (and the item selectable) while the dialog fades out, so a second
  // Enter or a double-click must not run the action again (e.g. save "바로 기록" twice).
  function run(action: () => void | Promise<void>) {
    if (!paletteOpen) return;
    setPaletteOpen(false);
    void action();
  }
  const go = (href: string) => run(() => router.push(href));

  return (
    <Command>
      <CommandInput value={search} onValueChange={setSearch} placeholder="이동, 기록 찾기, 또는 '커피 4500'으로 바로 기록" />
      <CommandList className="max-h-[440px]">
        {/* No empty state: with a query, 바로 하기 always offers at least "기록에서 찾기". cmdk leaves
            force-mounted items out of its filter, so the group has to be force-mounted too. */}
        {query && (
          <CommandGroup heading="바로 하기" forceMount>
            {recordable && (
              <CommandItem
                value={`record ${query}`}
                forceMount
                onSelect={() =>
                  run(async () => {
                    try {
                      const error = await saveQuickEntry(recordable, ctx, query);
                      if (error) toast.error(error);
                    } catch {
                      toast.error("서버에 닿지 못했어요. 연결을 확인하고 다시 해 주세요.");
                    }
                  })
                }
              >
                <span aria-hidden className="flex size-6 items-center justify-center rounded-[6px] bg-primary text-primary-foreground">
                  <PlusIcon weight="bold" className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">바로 기록</span>
                  <span className="text-ink-3">
                    {" · "}
                    {[
                      TYPE_LABEL[recordable.type],
                      recordable.type === "transfer" ? null : (recordCategory?.name ?? "분류 없음"),
                      recordable.memo || null,
                      recordWallet?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {/* Ink on the wrapper, so income and transfer keep Amount's own colors. */}
                <CommandShortcut className="text-foreground group-data-selected/command-item:text-foreground">
                  <Amount value={recordable.amount ?? 0} type={recordable.type} className="text-sm" />
                </CommandShortcut>
              </CommandItem>
            )}
            <CommandItem
              value={`search ${query}`}
              forceMount
              onSelect={() => go(`/transactions?q=${encodeURIComponent(query.slice(0, 100))}`)}
            >
              <MagnifyingGlassIcon aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                기록에서 <span className="font-semibold">‘{query}’</span> 찾기
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="기록">
          <CommandItem value="한 줄 입력 빠른 기록" onSelect={() => run(() => setQuickEntryOpen(true))}>
            <PencilSimpleLineIcon aria-hidden />
            한 줄 입력
            <CommandShortcut>
              <Kbd>N</Kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem value="자세히 기록 새 기록" onSelect={() => run(() => openNewTransaction())}>
            <NotePencilIcon aria-hidden />
            자세히 기록
          </CommandItem>
          <CommandItem value="확인할 것 보기 리뷰" onSelect={() => go("/transactions?view=review")}>
            <ListChecksIcon aria-hidden />
            확인할 것 보기
          </CommandItem>
          <CommandItem value="새 계좌 추가" onSelect={() => go("/wallets?new=1")}>
            <PlusIcon aria-hidden />새 계좌 추가
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="이동">
          {NAV.map((item) => {
            const [first, second] = chordKeys(item);
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} 이동`}
                keywords={NAV_KEYWORDS[item.href]}
                onSelect={() => go(item.href)}
              >
                <item.icon aria-hidden />
                {item.label}
                <CommandShortcut className="flex gap-1">
                  <Kbd>{first}</Kbd>
                  <Kbd>{second}</Kbd>
                </CommandShortcut>
              </CommandItem>
            );
          })}
          <CommandItem value="지난달 기록 이동" onSelect={() => go(`/transactions?month=${lastMonth}`)}>
            <CalendarIcon aria-hidden />
            지난달 기록
            <CommandShortcut>{formatMonthKo(lastMonth)}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {ctx.categories.length > 0 && (
          <CommandGroup heading="카테고리별 이번 달 기록">
            {ctx.categories.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.kind === "income" ? "수입" : "지출"} 카테고리`}
                keywords={c.keywords}
                onSelect={() => go(`/transactions?category=${c.id}`)}
              >
                <CategoryIcon icon={c.icon} color={c.color} className="size-6 rounded-[6px]" />
                {c.name}
                <CommandShortcut>{c.kind === "income" ? "수입" : "지출"}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="설정">
          <CommandItem value="테마 바꾸기 다크 라이트 모드" onSelect={() => run(() => setTheme(dark ? "light" : "dark"))}>
            {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
            {dark ? "라이트 모드로" : "다크 모드로"}
          </CommandItem>
          <CommandItem value="단축키 보기 도움말" onSelect={() => run(() => setHelpOpen(true))}>
            <KeyboardIcon aria-hidden />
            단축키 보기
            <CommandShortcut>
              <Kbd>?</Kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem value="로그아웃" onSelect={() => run(signOut)}>
            <SignOutIcon aria-hidden />
            로그아웃
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
