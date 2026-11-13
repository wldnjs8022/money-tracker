import { cn } from "@/lib/utils";
import { formatKRW } from "@/lib/money";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type TxnType = "income" | "expense" | "transfer";

/** Expense in normal text with a minus, income in blue with a plus, transfers muted. */
export function Amount({ value, type, className }: { value: number; type: TxnType; className?: string }) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";
  return (
    <span
      className={cn(
        "num font-semibold whitespace-nowrap",
        type === "income" && "text-income",
        type === "transfer" && "text-transfer",
        className,
      )}
    >
      {sign}
      {formatKRW(value)}
    </span>
  );
}

export const TYPE_LABEL: Record<TxnType, string> = { expense: "지출", income: "수입", transfer: "이체" };

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-base", className)}
      style={{ backgroundColor: color ? `${color}22` : "var(--muted)" }}
    >
      {icon ?? "·"}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export const WALLET_KIND_LABEL = {
  cash: "현금",
  bank: "은행",
  card: "카드",
  invest: "투자",
  other: "기타",
} as const;
