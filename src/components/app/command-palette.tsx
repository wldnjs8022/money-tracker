"use client";

import {
  CalendarIcon,
  KeyboardIcon,
  LayoutDashboardIcon,
  ListIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  SparklesIcon,
  SunIcon,
  TagsIcon,
  WalletIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useUI } from "@/components/app/ui-provider";
import { TYPE_LABEL } from "@/components/common";
import { useQuickParse, saveQuickEntry } from "@/components/transactions/quick-entry-dialog";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { authClient } from "@/lib/auth-client";
import { addMonths, currentMonthKST } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import type { EntryContext } from "@/server/queries";
import { toast } from "sonner";

export function CommandPalette({ ctx }: { ctx: EntryContext }) {
  const { paletteOpen, setPaletteOpen, setQuickEntryOpen, openNewTransaction, setHelpOpen } = useUI();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const parse = useQuickParse(ctx);
  const [search, setSearch] = useState("");

  // Typing "커피 4500" in the palette offers to record it right away.
  const parsed = search.trim() ? parse(search) : null;
  const canRecord = parsed?.amount && parsed.walletId && (parsed.type !== "transfer" || parsed.toWalletId);
  const parsedCategory = ctx.categories.find((c) => c.id === parsed?.categoryId);

  function run(action: () => void | Promise<void>) {
    setPaletteOpen(false);
    setSearch("");
    void action();
  }

  const go = (href: string) => run(() => router.push(href));
  const month = currentMonthKST();

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={(open) => {
        setPaletteOpen(open);
        if (!open) setSearch("");
      }}
      title="명령 팔레트"
      description="이동하거나 기록하거나 찾기"
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput value={search} onValueChange={setSearch} placeholder="페이지 이동, 카테고리 찾기, 또는 '커피 4500'으로 바로 기록" />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>찾는 게 없어요.</CommandEmpty>

          {canRecord && parsed && (
            <CommandGroup heading="바로 기록">
              <CommandItem
                value={`record ${search}`}
                forceMount
                onSelect={() =>
                  run(async () => {
                    const error = await saveQuickEntry(parsed, ctx);
                    if (error) toast.error(error);
                  })
                }
              >
                <SparklesIcon className="text-brand" />
                <span>
                  {TYPE_LABEL[parsed.type]}
                  {parsedCategory ? ` · ${parsedCategory.icon} ${parsedCategory.name}` : ""}
                  {parsed.memo ? ` · ${parsed.memo}` : ""}
                </span>
                <span className="num ml-auto font-semibold">{formatKRW(parsed.amount!)}</span>
              </CommandItem>
            </CommandGroup>
          )}

          <CommandGroup heading="기록">
            <CommandItem onSelect={() => run(() => setQuickEntryOpen(true))}>
              <SparklesIcon />
              빠른 입력
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => openNewTransaction())}>
              <PlusIcon />새 거래 (자세히)
            </CommandItem>
            <CommandItem onSelect={() => go("/wallets?new=1")}>
              <WalletIcon />새 계좌 추가
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="이동">
            <CommandItem onSelect={() => go("/")}>
              <LayoutDashboardIcon />
              대시보드
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/transactions")}>
              <ListIcon />
              거래 내역
              <CommandShortcut>G T</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/wallets")}>
              <WalletIcon />
              계좌
              <CommandShortcut>G W</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/categories")}>
              <TagsIcon />
              카테고리
              <CommandShortcut>G C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go(`/transactions?month=${addMonths(month, -1)}`)}>
              <CalendarIcon />
              지난달 거래 내역
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="카테고리별 이번 달 내역">
            {ctx.categories.map((c) => (
              <CommandItem
                key={c.id}
                value={`category ${c.name} ${c.keywords.join(" ")}`}
                onSelect={() => go(`/transactions?category=${c.id}`)}
              >
                <span className="w-4 text-center">{c.icon}</span>
                {c.name}
                <span className="ml-auto text-xs text-muted-foreground">{c.kind === "income" ? "수입" : "지출"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="설정">
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
              {resolvedTheme === "dark" ? "라이트 모드" : "다크 모드"}
            </CommandItem>
            <CommandItem onSelect={() => run(() => setHelpOpen(true))}>
              <KeyboardIcon />
              단축키 보기
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(async () => {
                  await authClient.signOut();
                  router.replace("/login");
                  router.refresh();
                })
              }
            >
              <LogOutIcon />
              로그아웃
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
