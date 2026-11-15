// Loading frame for the two-pane 계좌 and 카테고리 screens. Server-safe; it matches the real panes'
// widths and header height so nothing jumps when the content streams in.
import { FullBleed } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

export function LedgerSkeleton({ label }: { label: string }) {
  return (
    <FullBleed aria-busy="true">
      <p role="status" className="sr-only">
        {label} 불러오는 중
      </p>
      <div className="flex w-[300px] shrink-0 flex-col border-r border-line-soft lg:w-[340px]">
        <div className="flex min-h-14 items-center justify-between border-b border-line-soft px-5 py-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-20 rounded-[9px]" />
        </div>
        <div className="flex-1 space-y-1 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-[52px] items-center gap-3">
              <Skeleton className="size-8 rounded-[8px]" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 px-8 pt-7">
        <div className="max-w-3xl space-y-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Skeleton className="h-[42px] rounded-[9px]" />
            <Skeleton className="h-[42px] rounded-[9px]" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </FullBleed>
  );
}
