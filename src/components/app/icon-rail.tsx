"use client";

import { QuestionIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { chordKeys, isNavActive, NAV } from "@/components/app/nav";
import { useUI } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TILE =
  "relative flex size-11 shrink-0 items-center justify-center rounded-[10px] outline-none focus-ring transition-colors duration-150";

/**
 * The 64px rail on the left of the window: section links (active = ink tile with a lime glyph),
 * then the shortcuts help and the account menu at the bottom.
 *
 * `reviewCountSlot` renders inside the 기록 link (a <RailBadge> streamed in by the layout), so the
 * count becomes part of the link's accessible name. `userSlot` is the account menu.
 */
export function IconRail({ reviewCountSlot, userSlot }: { reviewCountSlot: React.ReactNode; userSlot: React.ReactNode }) {
  const pathname = usePathname();
  const { setHelpOpen } = useUI();

  return (
    <nav
      aria-label="주 메뉴"
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-line-soft px-2.5 py-3"
    >
      {NAV.map((item) => {
        const active = isNavActive(item.href, pathname);
        const Glyph = item.icon;
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  TILE,
                  active ? "bg-mark text-mark-foreground" : "text-ink-3 hover:bg-muted hover:text-foreground",
                )}
              >
                <Glyph aria-hidden weight={active ? "fill" : "regular"} className="size-5" />
                <span className="sr-only">{item.label}</span>
                {item.href === "/transactions" && reviewCountSlot}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.label}
              <ShortcutHint keys={chordKeys(item)} />
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className={cn(TILE, "text-ink-3 hover:bg-muted hover:text-foreground")}
            >
              <QuestionIcon aria-hidden className="size-5" />
              <span className="sr-only">단축키 도움말</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            단축키
            <ShortcutHint keys={["?"]} />
          </TooltipContent>
        </Tooltip>
        {userSlot}
      </div>
    </nav>
  );
}

function ShortcutHint({ keys }: { keys: readonly string[] }) {
  return (
    <span className="flex gap-0.5">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

/**
 * Lime count badge on the 기록 rail icon: records waiting for review. Renders nothing at zero.
 * Rendered by a server component in (app)/layout.tsx and passed in as `reviewCountSlot`.
 */
export function RailBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden
        className="num absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] bg-signal px-1 text-[11px] leading-none font-extrabold text-signal-foreground ring-2 ring-card"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">, 확인할 것 {count}건</span>
    </>
  );
}
