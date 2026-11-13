import { Suspense } from "react";
import { EntryLayer } from "@/components/app/entry-layer";
import { Sidebar } from "@/components/app/sidebar";
import { UIProvider } from "@/components/app/ui-provider";
import { UserMenu } from "@/components/app/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/session";

// The shell (sidebar, providers) renders instantly. Anything that reads the session
// streams in behind its own <Suspense>, per Cache Components rules.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <UIProvider>
      <div className="flex min-h-screen">
        <Sidebar
          userSlot={
            <Suspense fallback={<Skeleton className="h-12 w-full" />}>
              <CurrentUserMenu />
            </Suspense>
          }
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-6 py-6 xl:px-8 xl:py-8">{children}</div>
        </main>
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
