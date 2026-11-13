import { Suspense } from "react";
import { PageHeader } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletsView } from "@/components/wallets/wallets-view";
import { formatKRW } from "@/lib/money";
import { getWallets } from "@/server/queries";

export default function WalletsPage({ searchParams }: PageProps<"/wallets">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <WalletsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WalletsContent({ searchParams }: { searchParams: PageProps<"/wallets">["searchParams"] }) {
  const sp = await searchParams;
  const wallets = await getWallets();
  const netWorth = wallets.reduce((s, w) => s + w.balance, 0);
  const assets = wallets.filter((w) => w.balance > 0).reduce((s, w) => s + w.balance, 0);
  const debts = wallets.filter((w) => w.balance < 0).reduce((s, w) => s + w.balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="계좌"
        description="잔액은 시작 잔액에 거래를 더해 자동으로 계산돼요. 카드값 납부는 통장 → 카드 이체로 기록하세요."
      />
      <Card>
        <CardContent className="grid grid-cols-3 divide-x">
          <Summary label="순자산" value={formatKRW(netWorth)} strong />
          <Summary label="자산" value={formatKRW(assets)} />
          <Summary label="부채 (카드값 등)" value={formatKRW(Math.abs(debts))} className="text-expense" />
        </CardContent>
      </Card>
      <WalletsView wallets={wallets} startWithNew={sp.new === "1"} />
    </div>
  );
}

function Summary({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="space-y-1 px-6 first:pl-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`num tracking-tight ${strong ? "text-3xl font-bold" : "text-xl font-semibold"} ${className ?? ""}`}>{value}</p>
    </div>
  );
}
