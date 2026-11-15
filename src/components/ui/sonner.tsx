"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, InfoIcon, SpinnerGapIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"

// Neutral P toasts: white surface, hairline, ink text. Only the icon carries meaning
// (green check, danger cross); the undo action is an ink button.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-sans!"
      icons={{
        success: <CheckCircleIcon aria-hidden weight="fill" className="size-[18px] text-income" />,
        info: <InfoIcon aria-hidden weight="fill" className="size-[18px] text-ink-3" />,
        warning: <WarningIcon aria-hidden weight="fill" className="size-[18px] text-ink-2" />,
        error: <XCircleIcon aria-hidden weight="fill" className="size-[18px] text-destructive" />,
        loading: <SpinnerGapIcon aria-hidden className="size-[18px] animate-spin text-ink-3" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-overlay! text-sm! font-semibold! tracking-[-0.01em]",
          description: "text-ink-3! font-normal!",
          actionButton: "rounded-[7px]! font-bold! px-2.5!",
          cancelButton: "rounded-[7px]! font-semibold!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
