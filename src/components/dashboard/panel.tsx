// Building blocks for the home page's hairline panels. No client directive: used by server
// components and by the client chart's tooltip alike (icons come from the Phosphor SSR build).
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A white panel with a hairline border (no shadow inside the window), a title row with optional
 * right-side meta, and an optional one-line description. `id` names the heading for aria-labelledby. Children decide their
 * own padding so lists can run edge to edge.
 */
export function Panel({
  id,
  title,
  description,
  meta,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the title row: a legend, a count or a PanelLink. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-card", className)}
    >
      <header className="px-5 pt-4 pb-3">
        <div className="flex min-h-8 items-center gap-3">
          <h2 id={`${id}-title`} className="min-w-0 truncate text-[15px] font-bold tracking-[-0.02em]">
            {title}
          </h2>
          {meta && <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-ink-3">{meta}</div>}
        </div>
        {description && <p className="mt-0.5 text-[13px] text-pretty break-keep text-ink-2">{description}</p>}
      </header>
      {children}
    </section>
  );
}

/** Quiet "see all" link for a panel's title row. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-my-1 -mr-2 flex h-10 items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-ink-3 transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      {children}
      <CaretRightIcon aria-hidden weight="bold" className="size-3" />
    </Link>
  );
}

/** Bold, ink, tabular figure inside a sentence (KPI notes, panel descriptions). */
export function Figure({ children }: { children: React.ReactNode }) {
  return <strong className="num font-bold text-foreground">{children}</strong>;
}

/** A short stroke that keys a line series in legends and tooltips (solid or dashed). */
export function LineKey({ dashed = false, className }: { dashed?: boolean; className?: string }) {
  return (
    <svg aria-hidden width="16" height="2" viewBox="0 0 16 2" className={cn("shrink-0 overflow-visible", className)}>
      <line
        x1="1"
        y1="1"
        x2="15"
        y2="1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap={dashed ? "butt" : "round"}
        strokeDasharray={dashed ? "3 2.5" : undefined}
      />
    </svg>
  );
}
