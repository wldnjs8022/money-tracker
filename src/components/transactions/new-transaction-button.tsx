"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useUI } from "@/components/app/ui-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The ink "+ 기록" button with its N hint. Opens quick entry, like N does. The label can change
 * (e.g. "첫 기록 남기기" on an empty home) while the look and the shortcut stay the same.
 */
export function NewTransactionButton({ className, children = "기록" }: { className?: string; children?: React.ReactNode }) {
  const { setQuickEntryOpen } = useUI();
  return (
    <Button onClick={() => setQuickEntryOpen(true)} aria-keyshortcuts="N" className={cn("gap-1.5 font-bold", className)}>
      <PlusIcon aria-hidden weight="bold" className="size-3.5" />
      {children}
      <span aria-hidden className="ml-0.5 text-[11px] font-bold text-primary-hint">
        N
      </span>
    </Button>
  );
}
