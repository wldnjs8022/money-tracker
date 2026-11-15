"use client";

import { PlusIcon, ReceiptIcon, TrashIcon } from "@phosphor-icons/react";
import { useUI } from "@/components/app/ui-provider";
import { EmptyState } from "@/components/common";
import { CategoryIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { daysInMonth } from "@/lib/dates";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategoryRow, TransactionRow } from "@/server/queries";
import { BigAmount, ColorPicker, InlineTitle, MonthRecords, quoted, RecordsHeader } from "@/components/wallets/ledger-kit";
import { CATEGORY_COLORS, IconPicker, KIND_LABEL, type CategoryKind } from "./category-fields";
import { KeywordEditor } from "./keyword-editor";

export type CategoryPatch = Partial<Pick<CategoryRow, "name" | "icon" | "color">>;

/**
 * The selected category: name (edit in place), this month's total against the usual month, icon and
 * colour (saved on change), keywords, delete, then this month's records in it.
 */
export function CategoryDetail({
  category,
  categories,
  rows,
  usual,
  month,
  today,
  onPatch,
  onAddKeywords,
  onRemoveKeyword,
  onDelete,
}: {
  category: CategoryRow;
  /** Every category, to keep a keyword from belonging to two of them. */
  categories: CategoryRow[];
  /** This month's records in this category, newest first. */
  rows: TransactionRow[];
  /** Average month over the 3 months before this one; undefined when they have no records here. */
  usual: number | undefined;
  month: string;
  today: string;
  onPatch: (patch: CategoryPatch) => void;
  onAddKeywords: (words: string[]) => void;
  onRemoveKeyword: (word: string) => void;
  onDelete: () => void;
}) {
  const { openNewTransaction } = useUI();
  const monthNo = Number(month.slice(5));
  const kindLabel = KIND_LABEL[category.kind];
  // As on 홈: the big number is the whole month (it matches the list), records entered ahead
  // included; the pace against today's tick only counts what is dated up to today.
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const toDate = rows.reduce((sum, row) => (row.date <= today ? sum + row.amount : sum), 0);
  const ahead = total - toDate;

  return (
    <section aria-label={`${category.name} 상세`} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="flex max-w-3xl flex-col gap-7 px-8 pt-7 pb-14">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="page" size="lg">
              {kindLabel}
            </Badge>
            <span className="text-[13px] text-ink-2">
              지금까지 기록 <span className="num">{category.txnCount.toLocaleString("ko-KR")}</span>건 · 키워드{" "}
              <span className="num">{category.keywords.length}</span>개
            </span>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <CategoryIcon icon={category.icon} color={category.color} className="size-11" />
              <div className="min-w-0 flex-1">
                <InlineTitle
                  key={`${category.id}:${category.name}`}
                  value={category.name}
                  label="카테고리 이름"
                  maxLength={30}
                  onSave={(name) => onPatch({ name })}
                />
              </div>
            </div>
            <BigAmount className={cn("mt-2", total === 0 ? "text-ink-3" : category.kind === "income" && "text-income")}>
              {total === 0 ? "0원" : `${category.kind === "income" ? "+" : "−"}${formatKRW(total)}`}
            </BigAmount>
            <p className="mt-1 text-sm text-ink-3">
              {ahead > 0 ? (
                <>
                  {monthNo}월 {kindLabel} · <span className="num">{rows.length}</span>건 · 예정{" "}
                  <span className="num">{formatKRW(ahead)}</span> 포함
                </>
              ) : (
                <>
                  {monthNo}월 1일부터 오늘까지 {kindLabel} · <span className="num">{rows.length}</span>건
                </>
              )}
            </p>
          </div>
        </div>

        <UsualPace kind={category.kind} spent={toDate} usual={usual} month={month} today={today} />

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p aria-hidden className="text-xs font-bold text-ink-3">
              아이콘
            </p>
            <IconPicker value={category.icon} color={category.color} onChange={(icon) => onPatch({ icon })} />
          </div>
          <div className="space-y-1.5">
            <p id="category-detail-color" className="text-xs font-bold text-ink-3">
              색
            </p>
            <ColorPicker
              swatches={CATEGORY_COLORS}
              value={category.color}
              onChange={(color) => onPatch({ color })}
              labelledBy="category-detail-color"
            />
          </div>
          <div className="sm:col-span-2">
            <KeywordEditor
              key={category.id}
              category={category}
              categories={categories}
              onAdd={onAddKeywords}
              onRemove={onRemoveKeyword}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DeleteCategoryButton category={category} onConfirm={onDelete} />
          <p className="text-xs text-ink-3">
            {category.txnCount > 0
              ? `지워도 기록 ${category.txnCount.toLocaleString("ko-KR")}건은 남고 ‘분류 없음’이 돼요.`
              : "이 카테고리에는 아직 기록이 없어요."}
          </p>
        </div>

        <section aria-labelledby="category-records-title" className="space-y-3">
          <RecordsHeader
            id="category-records-title"
            title={
              <>
                {monthNo}월 기록 <span className="num font-semibold text-ink-3">{rows.length}건</span>
              </>
            }
            href={`/transactions?category=${category.id}`}
          />
          <MonthRecords
            rows={rows}
            today={today}
            subline={(row) => [row.walletName, ...row.tags.map((tag) => `#${tag}`)].join(" · ")}
            empty={
              <EmptyState
                icon={<ReceiptIcon aria-hidden />}
                title={`${monthNo}월엔 ${kindLabel} 기록이 아직 없어요`}
                description={`한 줄 입력에 키워드가 들어가면 ${category.name} 기록으로 모여요.`}
                action={
                  <Button
                    variant="outline"
                    onClick={() => openNewTransaction({ type: category.kind, categoryId: category.id })}
                  >
                    <PlusIcon aria-hidden />
                    {category.name}에 기록하기
                  </Button>
                }
                className="rounded-xl border border-line-soft py-10"
              />
            }
          />
        </section>
      </div>
    </section>
  );
}

/**
 * This month against the usual month (average of the 3 months before). For spending, a tick marks
 * how far into the month today is, so the bar reads as "ahead of / behind the usual pace". `spent`
 * counts records dated up to today only; ones entered ahead haven't happened yet.
 */
function UsualPace({
  kind,
  spent,
  usual,
  month,
  today,
}: {
  kind: CategoryKind;
  spent: number;
  usual: number | undefined;
  month: string;
  today: string;
}) {
  if (!usual) {
    return (
      <div className="rounded-xl border border-line-soft px-4 py-3.5 text-[13px] text-ink-2">
        지난 3달엔 이 카테고리 기록이 없어서 평소와 비교할 수 없어요.
      </div>
    );
  }

  const share = spent / usual;
  const todayShare = Number(today.slice(8)) / daysInMonth(month);
  const pct = Math.round(share * 100);
  const todayPct = Math.round(todayShare * 100);
  const over = formatKRW(spent - usual);

  let sentence: string;
  if (kind === "expense") {
    if (spent === 0) sentence = "이번 달엔 아직 안 썼어요";
    else if (spent === usual) sentence = "벌써 평소 한 달만큼 썼어요";
    else if (share > 1) sentence = `벌써 평소 한 달보다 ${over} 더 썼어요`;
    else if (share > todayShare) sentence = "오늘 위치(눈금)보다 더 썼어요";
    else sentence = "오늘 위치(눈금)보다 덜 썼어요";
  } else {
    if (spent === 0) sentence = "이번 달엔 아직 안 들어왔어요";
    else if (spent === usual) sentence = "평소 한 달만큼 들어왔어요";
    else if (share > 1) sentence = `평소 한 달보다 ${over} 더 들어왔어요`;
    else sentence = `평소 한 달의 ${pct}%가 들어왔어요`;
  }

  const barLabel =
    kind === "expense"
      ? `평소 한 달의 ${pct}%를 썼어요. 오늘은 한 달의 ${todayPct}% 지점이에요.`
      : `평소 한 달의 ${pct}%가 들어왔어요.`;

  return (
    <div className="rounded-xl border border-line-soft p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-bold">
          평소 한 달 <span className="num">{formatKRW(usual)}</span>
        </span>
        <span className="text-xs text-ink-3">지난 3달 평균</span>
      </div>
      <div role="img" aria-label={barLabel} className="relative mt-3 h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.min(100, share * 100)}%` }} />
        {kind === "expense" && (
          <div
            className="absolute -top-[3px] h-3.5 w-0.5 rounded-full bg-ink-3"
            style={{ left: `calc(${todayShare * 100}% - 1px)` }}
          />
        )}
      </div>
      <p className="mt-2 text-[13px] text-ink-2">{sentence}</p>
    </div>
  );
}

function DeleteCategoryButton({ category, onConfirm }: { category: CategoryRow; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg">
          <TrashIcon aria-hidden className="text-ink-3" />
          카테고리 지우기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{quoted(category.name, "을", "를")} 지울까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {category.txnCount > 0
              ? `이 카테고리의 기록 ${category.txnCount.toLocaleString("ko-KR")}건은 지워지지 않고 ‘분류 없음’이 돼요.`
              : "이 카테고리에는 기록이 없어요."}
            {category.keywords.length > 0 && ` 키워드 ${category.keywords.length}개도 함께 지워져요.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            지우기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
