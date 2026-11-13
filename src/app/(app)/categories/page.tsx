import { Suspense } from "react";
import { CategoriesView } from "@/components/categories/categories-view";
import { PageHeader } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategories } from "@/server/queries";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="카테고리" description="키워드를 잘 채워 둘수록 빠른 입력이 똑똑해져요." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CategoriesContent />
      </Suspense>
    </div>
  );
}

async function CategoriesContent() {
  const categories = await getCategories();
  return <CategoriesView categories={categories} />;
}
