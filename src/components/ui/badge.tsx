import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// P chips. `signal` = count badges and the "확인할 것" status pill (lime, ink text);
// `tint` = reason chips such as "AI 분류" / "새 곳" (lime tint); `page` (= `secondary`) = neutral
// chips such as tags or "확인함"; `outline` = hairline chip. Size `lg` is the status-pill size.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent font-bold whitespace-nowrap transition-colors focus-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/85",
        secondary: "bg-muted text-foreground [a]:hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]",
        page: "bg-muted text-foreground [a]:hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]",
        signal: "bg-signal font-extrabold text-signal-foreground",
        tint: "bg-signal-tint text-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border-line text-ink-2 [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost: "text-ink-3 hover:bg-muted hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[18px] rounded-[5px] px-[5px] text-[11px]",
        lg: "h-6 rounded-sm px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
