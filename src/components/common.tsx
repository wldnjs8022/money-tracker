// Shared presentational pieces. No client directive: usable from server and client components alike
// (icons come from the context-free Phosphor SSR build for the same reason).
import { ReceiptIcon } from "@phosphor-icons/react/ssr";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Keycap hint. The border follows the text colour, so it reads on white, ink, lime and in tooltips. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-current/30 px-[5px] font-sans text-[11px] leading-none font-semibold tracking-normal",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type TxnType = "income" | "expense" | "transfer";

/** Expense in ink with a minus, income in green with a plus, transfers muted without a sign. */
export function Amount({ value, type, className }: { value: number; type: TxnType; className?: string }) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";
  return (
    <span
      className={cn(
        "num font-bold whitespace-nowrap",
        type === "income" && "text-income",
        type === "transfer" && "text-ink-3",
        className,
      )}
    >
      {sign}
      {formatKRW(value)}
    </span>
  );
}

export const TYPE_LABEL: Record<TxnType, string> = { expense: "지출", income: "수입", transfer: "이체" };

/** Title row for a padded page (the default page layout). Actions sit on the right. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl leading-tight font-extrabold tracking-[-0.03em]">{title}</h1>
        {description && <p className="text-[13px] text-ink-3">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

/**
 * Header bar of a pane inside a full-bleed page: a 56px+ row with a bottom hairline.
 * `as` sets the heading level (one h1 per page; secondary panes use "h2").
 * `children` are right-aligned actions; `bordered={false}` drops the hairline.
 */
export function PaneHeader({
  title,
  description,
  children,
  as: Heading = "h1",
  bordered = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  bordered?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3",
        bordered && "border-b border-line-soft",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Heading className="truncate text-xl leading-tight font-extrabold tracking-[-0.03em]">{title}</Heading>
        {description && <p className="mt-0.5 truncate text-[13px] text-ink-3">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}

/**
 * Calm empty state for a list or pane: optional icon in a soft tile, a title, one line of help,
 * and an optional action (a <Button> or link). Pass `icon` as an element, e.g. <CheckIcon />.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {icon && (
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-[10px] bg-muted text-ink-2 [&_svg:not([class*='size-'])]:size-5"
        >
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-bold tracking-[-0.02em]">{title}</p>
        {description && <p className="mx-auto max-w-xs text-[13px] text-ink-3">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Root of a page that lays out its own panes. The app shell then stops padding and scrolling the
 * page; each pane scrolls itself (`min-h-0 overflow-y-auto`). Use it for the page's Suspense
 * fallback too, so the frame doesn't jump when content streams in.
 */
export function FullBleed({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-full-bleed="" className={cn("flex h-full min-h-0", className)} {...props} />;
}

/** The logo: a near-black tile with the lime receipt glyph (matches public/logo.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-mark text-mark-foreground", className)}
    >
      <ReceiptIcon weight="fill" className="size-[58%]" />
    </span>
  );
}

/** Small label used inside cards and above fields. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold text-ink-3", className)}>{children}</p>;
}

/** "1,130,940" big, "원" small. Pretendard 800 with tabular figures. */
export function BigWon({ value, className, unitClassName }: { value: number; className?: string; unitClassName?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={cn("display", className)}>
      {rounded < 0 && "−"}
      {Math.abs(rounded).toLocaleString("ko-KR")}
      <span className={cn("ml-0.5 text-[0.45em] font-bold tracking-normal", unitClassName)}>원</span>
    </span>
  );
}

export const WALLET_KIND_LABEL = {
  cash: "현금",
  bank: "은행",
  card: "카드",
  invest: "투자",
  other: "기타",
} as const;
