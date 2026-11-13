"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/common";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createCategory, deleteCategory, updateCategory } from "@/server/actions";
import type { CategoryRow } from "@/server/queries";

const COLORS = ["#f97316", "#a16207", "#06b6d4", "#3b82f6", "#14b8a6", "#ec4899", "#8b5cf6", "#6366f1", "#eab308", "#ef4444", "#0ea5e9", "#d946ef", "#16a34a", "#94a3b8"];
const EMOJIS = ["🍚", "☕", "🛵", "🚇", "🧺", "🛍️", "🏠", "🔁", "🎬", "💊", "📚", "🎁", "🐶", "👶", "💇", "🍺", "✈️", "🚗", "💼", "💰", "📈", "🧧", "💳", "📦"];

type Kind = "income" | "expense";
type Editing = { kind: Kind; category: CategoryRow | null };

export function CategoriesView({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{kind === "expense" ? "지출 카테고리" : "수입 카테고리"}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setEditing({ kind, category: null })}>
                <PlusIcon />
                추가
              </Button>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditing({ kind, category: c })}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <CategoryIcon icon={c.icon} color={c.color} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.keywords.length > 0 ? c.keywords.join(", ") : "키워드 없음"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.txnCount}건</span>
                  </button>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && <CategoryForm editing={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const { kind, category } = editing;
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "📦");
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [keywords, setKeywords] = useState((category?.keywords ?? []).join(", "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setPending(true);
    setError("");
    const input = {
      kind,
      name,
      icon,
      color,
      keywords: keywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean),
    };
    const result = category ? await updateCategory(category.id, input) : await createCategory(input);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success(category ? "저장했어요" : "카테고리를 추가했어요");
    onDone();
  }

  async function remove() {
    if (!category) return;
    setPending(true);
    const result = await deleteCategory(category.id);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success("삭제했어요");
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <DialogHeader>
        <DialogTitle>
          {category ? "카테고리 편집" : `${kind === "expense" ? "지출" : "수입"} 카테고리 추가`}
        </DialogTitle>
        <DialogDescription>키워드를 등록하면 빠른 입력에서 자동으로 이 카테고리로 분류돼요.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[4rem_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="cat-icon">아이콘</Label>
          <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} className="text-center text-lg" maxLength={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-name">이름</Label>
          <Input id="cat-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 반려동물" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setIcon(e)}
            className={cn("size-8 rounded-md text-base hover:bg-muted", e === icon && "bg-muted ring-1 ring-border")}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label>색</Label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", c === color && "ring-2 ring-foreground")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-keywords">키워드</Label>
        <Textarea
          id="cat-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="사료, 동물병원, 간식"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">쉼표로 구분해요. 예: &ldquo;사료 32000&rdquo;이라고 쓰면 이 카테고리로 들어가요.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="items-center sm:justify-between">
        {category ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={pending}>
                <Trash2Icon />
                삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>&lsquo;{category.name}&rsquo; 카테고리를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  {category.txnCount > 0
                    ? `이 카테고리의 거래 ${category.txnCount}건은 지워지지 않고 '미분류'가 돼요.`
                    : "이 카테고리에는 거래가 없어요."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            저장
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
