"use client";

import { CaretRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { INBOX_VIEW_LABEL, navItemFor, parseInboxView } from "@/components/app/nav";
import { useUI } from "@/components/app/ui-provider";
import { Kbd, LogoMark } from "@/components/common";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";

/** The 56px bar across the top of the window: logo, breadcrumb, palette search, + 기록. */
export function TopBar() {
  const { setPaletteOpen } = useUI();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-soft px-4 sm:gap-4">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-lg text-base font-extrabold tracking-[-0.03em] outline-none focus-ring"
      >
        <LogoMark />
        가계부
      </Link>

      {/* useSearchParams needs a Suspense boundary; until it resolves the crumb shows the section only. */}
      <Suspense fallback={<SectionBreadcrumb />}>
        <ViewBreadcrumb />
      </Suspense>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-keyshortcuts="/ Meta+K Control+K"
        className="ml-auto flex h-10 min-w-0 shrink items-center gap-2 rounded-[9px] border border-line bg-card px-2.5 text-ink-3 outline-none focus-ring transition-colors duration-150 hover:bg-muted hover:text-ink-2 md:w-[300px]"
      >
        <MagnifyingGlassIcon aria-hidden className="size-[15px] shrink-0" />
        <span className="sr-only md:not-sr-only md:flex-1 md:text-left">검색 · 명령</span>
        <Kbd className="hidden md:inline-flex">/</Kbd>
      </button>

      <NewTransactionButton className="shrink-0" />
    </header>
  );
}

function ViewBreadcrumb() {
  const searchParams = useSearchParams();
  return <SectionBreadcrumb view={searchParams.get("view")} />;
}

/** "기록 › 확인할 것" on the 기록 page; just the section name elsewhere. */
function SectionBreadcrumb({ view }: { view?: string | null }) {
  const pathname = usePathname();
  const section = navItemFor(pathname);
  if (!section) return null;

  const current = section.href === "/transactions" && view !== undefined ? INBOX_VIEW_LABEL[parseInboxView(view)] : null;

  return (
    <nav aria-label="현재 위치" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {current ? (
          <>
            <li className="shrink-0 text-ink-3">{section.label}</li>
            <li aria-hidden className="flex shrink-0 items-center text-ink-4">
              <CaretRightIcon className="size-[11px]" />
            </li>
            <li aria-current="page" className="truncate font-semibold">
              {current}
            </li>
          </>
        ) : (
          <li aria-current="page" className="truncate font-semibold">
            {section.label}
          </li>
        )}
      </ol>
    </nav>
  );
}
