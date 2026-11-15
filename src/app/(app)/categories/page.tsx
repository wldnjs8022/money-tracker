import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoriesView } from "@/components/categories/categories-view";
import { LedgerSkeleton } from "@/components/wallets/ledger-skeleton";
import { monthOf, todayKST } from "@/lib/dates";
import { getCategories, getCategoryUsual, listTransactions } from "@/server/queries";

export const metadata: Metadata = { title: "카테고리" };

/*
 * 카테고리: 지출 / 수입 list with this month's amounts | the selected category's detail.
 * The selection lives in ?id= and changes on the client without a server round trip, so the page
 * loads this month's records once and the view splits them per category.
 */
export default function CategoriesPage() {
  return (
    <Suspense fallback={<LedgerSkeleton label="카테고리" />}>
      <CategoriesContent />
    </Suspense>
  );
}

async function CategoriesContent() {
  await connection();
  const today = todayKST();
  const month = monthOf(today);
  const [categories, usual, records] = await Promise.all([
    getCategories(),
    getCategoryUsual(month),
    listTransactions({ month }),
  ]);
  return <CategoriesView categories={categories} usual={usual} records={records} month={month} today={today} />;
}
