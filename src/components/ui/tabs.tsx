"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-3 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * Pill tab look (the 기록 view tabs: 확인할 것 / 전체 / 이체): white hairline pills, the active one ink.
 * Exported for tabs that are links or buttons rather than Radix tabs, e.g.
 * <Link className={tabPillVariants({ active })} aria-current={active ? "page" : undefined}>.
 */
const tabPillVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      active: {
        true: "border-transparent bg-primary font-bold text-primary-foreground",
        false: "border-line bg-card font-semibold text-ink-2 hover:bg-muted hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

// default = pills; segment = muted track with a raised white active tab; line = underline.
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-ink-2 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:items-stretch",
  {
    variants: {
      variant: {
        default: "gap-1.5",
        segment: "h-10 gap-1 rounded-[10px] bg-muted p-1",
        line: "gap-4 border-b border-line-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-ring disabled:pointer-events-none disabled:opacity-50 group-data-vertical/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Hover only tints inactive tabs. shadcn's data-active variant is wrapped in :where(), so a
        // plain hover rule would outrank the active styles and repaint the tab just clicked.
        // default: pills
        "group-data-[variant=default]/tabs-list:h-9 group-data-[variant=default]/tabs-list:rounded-[8px] group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-line group-data-[variant=default]/tabs-list:bg-card group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:data-[state=inactive]:hover:bg-muted group-data-[variant=default]/tabs-list:data-[state=inactive]:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:border-transparent group-data-[variant=default]/tabs-list:data-active:bg-primary group-data-[variant=default]/tabs-list:data-active:font-bold group-data-[variant=default]/tabs-list:data-active:text-primary-foreground",
        // segment: raised white tab on a muted track
        "group-data-[variant=segment]/tabs-list:h-full group-data-[variant=segment]/tabs-list:flex-1 group-data-[variant=segment]/tabs-list:rounded-[7px] group-data-[variant=segment]/tabs-list:px-3 group-data-[variant=segment]/tabs-list:data-[state=inactive]:hover:text-foreground group-data-[variant=segment]/tabs-list:data-active:bg-card group-data-[variant=segment]/tabs-list:data-active:font-bold group-data-[variant=segment]/tabs-list:data-active:text-foreground group-data-[variant=segment]/tabs-list:data-active:shadow-card",
        // line: underline under the active tab
        "group-data-[variant=line]/tabs-list:h-10 group-data-[variant=line]/tabs-list:data-[state=inactive]:hover:text-foreground group-data-[variant=line]/tabs-list:data-active:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabPillVariants }
