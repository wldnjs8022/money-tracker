import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// P buttons: ink for the primary action, hairline outline for the rest, lime `signal` for the one
// key action on a screen (e.g. 확인). Standalone controls are at least 40px: sm and default are 40
// (sm is denser), lg 44 for primary actions. xs (32) is only for chips inside composite controls such
// as input-group addons. Icon sizes are squares of the same heights.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[9px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity] duration-150 outline-none select-none focus-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/85 aria-expanded:bg-primary/85",
        outline:
          "border-line bg-card text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)] aria-expanded:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-line bg-card text-destructive hover:border-destructive/30 hover:bg-destructive/8",
        signal:
          "bg-signal font-extrabold text-signal-foreground hover:bg-[color-mix(in_oklch,var(--signal),black_7%)] aria-expanded:bg-[color-mix(in_oklch,var(--signal),black_7%)]",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 gap-1.5 rounded-[7px] px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-10 gap-1.5 rounded-[8px] px-3 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 rounded-[10px] px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-10",
        "icon-xs": "size-8 rounded-[7px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-10 rounded-[8px]",
        "icon-lg": "size-11 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
