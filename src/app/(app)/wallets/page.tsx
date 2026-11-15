import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LedgerSkeleton } from "@/components/wallets/ledger-skeleton";
import { WalletsView } from "@/components/wallets/wallets-view";
import { monthOf, todayKST } from "@/lib/dates";
import { getWallets, listTransactions } from "@/server/queries";

export const metadata: Metadata = { title: "계좌" };

/*
 * 계좌: wallet list (grouped by kind, net worth at the bottom) | the selected wallet's detail.
 * The selection lives in ?id= and changes on the client without a server round trip, so the page
 * loads this month's records for every wallet once and the view filters them per wallet (the same
 * rows listTransactions({ month, walletId }) returns: records from or to that wallet).
 */
export default function WalletsPage() {
  return (
    <Suspense fallback={<LedgerSkeleton label="계좌" />}>
      <WalletsContent />
    </Suspense>
  );
}

async function WalletsContent() {
  await connection();
  const today = todayKST();
  const month = monthOf(today);
  const [wallets, records] = await Promise.all([getWallets(), listTransactions({ month })]);
  return <WalletsView wallets={wallets} records={records} month={month} today={today} />;
}
