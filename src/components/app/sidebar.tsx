"use client";

import { LayoutDashboardIcon, ListIcon, SearchIcon, SparklesIcon, TagsIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboardIcon, keys: "G D" },
  { href: "/transactions", label: "거래 내역", icon: ListIcon, keys: "G T" },
  { href: "/wallets", label: "계좌", icon: WalletIcon, keys: "G W" },
  { href: "/categories", label: "카테고리", icon: TagsIcon, keys: "G C" },
];

export function Sidebar({ userSlot }: { userSlot: React.ReactNode }) {
  const pathname = usePathname();
  const { setQuickEntryOpen, setPaletteOpen } = useUI();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <WalletIcon className="size-4" />
        </span>
        가계부
      </Link>

      <button
        type="button"
        onClick={() => setQuickEntryOpen(true)}
        className="mb-2 flex h-10 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 active:translate-y-px"
      >
        <SparklesIcon className="size-4" />
        빠른 입력
        <Kbd className="ml-auto border-white/30 bg-white/20 text-brand-foreground">N</Kbd>
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="mb-6 flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <SearchIcon className="size-4" />
        검색 · 명령
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              <span className="ml-auto text-[11px] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70">
                {item.keys}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">{userSlot}</div>
    </aside>
  );
}
