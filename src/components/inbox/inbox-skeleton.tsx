import { FullBleed } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { LIST_PANE_WIDTH, SIDE_PANE_WIDTH } from "./layout";

/** The inbox frame while the page streams in: same panes and widths, so nothing jumps. */
export function InboxSkeleton() {
  return (
    <FullBleed aria-busy="true">
      <span className="sr-only">기록을 불러오는 중…</span>
      <div className={`flex min-h-0 w-full flex-col border-line-soft min-[900px]:border-r ${LIST_PANE_WIDTH}`}>
        <div className="space-y-2.5 border-b border-line-soft p-3">
          <div className="flex gap-1.5">
            <Skeleton className="h-9 w-[88px]" />
            <Skeleton className="h-9 w-[52px]" />
            <Skeleton className="h-9 w-[52px]" />
          </div>
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-1 p-4">
          <Skeleton className="mb-3 h-3.5 w-24" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-2.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-5 px-8 pt-[26px] min-[900px]:flex">
        <Skeleton className="h-6 w-56" />
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-60" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="grid max-w-[720px] grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[62px]" />
          ))}
        </div>
      </div>
      <div className={`hidden shrink-0 border-l border-line-soft bg-side p-5 xl:block ${SIDE_PANE_WIDTH}`}>
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="mt-2 h-6 w-36" />
        <Skeleton className="mt-4 h-[84px] w-full" />
      </div>
    </FullBleed>
  );
}
