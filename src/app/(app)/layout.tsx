import { Suspense } from "react";
import { EntryLayer } from "@/components/app/entry-layer";
import { IconRail, RailBadge } from "@/components/app/icon-rail";
import { TopBar } from "@/components/app/top-bar";
import { UIProvider } from "@/components/app/ui-provider";
import { UserMenu } from "@/components/app/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getReviewCount } from "@/server/queries";
import { requireUser } from "@/server/session";

/*
 * Dot-grid page → one white window (16px inset and rounded from 1024px up) → top bar + (rail | main).
 * The window never scrolls; see the `[data-slot="app-main"]` rule in globals.css for how pages scroll
 * (a padded column by default, or their own panes when the page root is <FullBleed>).
 *
 * The shell renders instantly. Everything that reads the session streams in behind its own
 * <Suspense>, per Cache Components rules.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <UIProvider>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-[9px] bg-primary text-sm font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        본문으로 건너뛰기
      </a>
      <div className="page-grid h-dvh overflow-hidden lg:p-4">
        <div className="flex h-full flex-col overflow-hidden bg-card text-card-foreground lg:rounded-3xl lg:border lg:border-line lg:shadow-window">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <IconRail
              reviewCountSlot={
                <Suspense fallback={null}>
                  <ReviewCountBadge />
                </Suspense>
              }
              userSlot={
                <Suspense fallback={<Skeleton className="m-1.5 size-8 rounded-full" />}>
                  <CurrentUserMenu />
                </Suspense>
              }
            />
            {/*
             * Not focusable on purpose: a tabIndex here would take focus on every click in the
             * content and stop Space/PageDown/arrows from scrolling the pane under the pointer.
             * The skip link still works: following #main-content moves the Tab starting point here.
             */}
            <main id="main-content" data-slot="app-main" className="min-h-0 min-w-0 flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <EntryLayer />
      </Suspense>
    </UIProvider>
  );
}

async function CurrentUserMenu() {
  const user = await requireUser();
  return <UserMenu name={user.name} email={user.email} />;
}

async function ReviewCountBadge() {
  const count = await getReviewCount();
  return <RailBadge count={count} />;
}
