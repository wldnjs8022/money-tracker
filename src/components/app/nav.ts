import type { Icon } from "@phosphor-icons/react";
// The context-free (SSR) glyphs keep this module importable from server components too.
import { ReceiptIcon, SquaresFourIcon, TagIcon, WalletIcon } from "@phosphor-icons/react/ssr";

/**
 * The app's four sections, defined once for the icon rail, the top-bar breadcrumb, the G-chords
 * in UIProvider, the command palette and the shortcuts help.
 */
export type NavItem = {
  href: "/" | "/transactions" | "/wallets" | "/categories";
  label: string;
  /** Second key of the "G then …" chord. */
  chordKey: "d" | "t" | "w" | "c";
  icon: Icon;
};

export const NAV: readonly NavItem[] = [
  { href: "/", label: "홈", chordKey: "d", icon: SquaresFourIcon },
  { href: "/transactions", label: "기록", chordKey: "t", icon: ReceiptIcon },
  { href: "/wallets", label: "계좌", chordKey: "w", icon: WalletIcon },
  { href: "/categories", label: "카테고리", chordKey: "c", icon: TagIcon },
];

/** "/" matches exactly; every other section matches by prefix. */
export function isNavActive(href: NavItem["href"], pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV.find((item) => isNavActive(item.href, pathname));
}

/** Chord key → route, e.g. "t" → "/transactions". */
export const CHORD_ROUTES: Readonly<Record<string, NavItem["href"]>> = Object.fromEntries(
  NAV.map((item) => [item.chordKey, item.href]),
);

/** Display form of a chord for hints, e.g. ["G", "T"]. */
export function chordKeys(item: NavItem): [string, string] {
  return ["G", item.chordKey.toUpperCase()];
}

/** The 기록 page's views (`/transactions?view=`). Missing or unknown values mean "all". */
export type InboxView = "review" | "all" | "transfer";

export const INBOX_VIEW_LABEL: Record<InboxView, string> = {
  review: "확인할 것",
  all: "전체",
  transfer: "이체",
};

export function parseInboxView(value: string | null | undefined): InboxView {
  return value === "review" || value === "transfer" ? value : "all";
}
