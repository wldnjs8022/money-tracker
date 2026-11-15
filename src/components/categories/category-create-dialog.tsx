"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tabPillVariants } from "@/components/ui/tabs";
import { createCategory } from "@/server/actions";
import type { CategoryRow } from "@/server/queries";
import { attempt, ColorPicker, quoted } from "@/components/wallets/ledger-kit";
import {
  CATEGORY_COLORS,
  CustomEmojiInput,
  IconGrid,
  KIND_LABEL,
  KINDS,
  keywordProblem,
  parseKeywords,
  type CategoryKind,
} from "./category-fields";

/** "+ 추가" in the category list; starts on the tab that's open. */
export function CategoryCreateDialog({
  open,
  defaultKind,
  categories,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  defaultKind: CategoryKind;
  /** Existing categories, so a new one can't take a keyword another already owns. */
  categories: CategoryRow[];
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, kind: CategoryKind) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The content unmounts after the close animation, so every open starts from a blank form. */}
        <CategoryCreateForm
          defaultKind={defaultKind}
          categories={categories}
          onCancel={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryCreateForm({
  defaultKind,
  categories,
  onCancel,
  onCreated,
}: {
  defaultKind: CategoryKind;
  categories: CategoryRow[];
  onCancel: () => void;
  onCreated: (id: string, kind: CategoryKind) => void;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState(CATEGORY_COLORS[1].value);
  const [keywords, setKeywords] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (pending) return;
    if (!name.trim()) return setError("이름을 적어 주세요.");
    const words = parseKeywords(keywords);
    const problem = keywordProblem(words, [], categories);
    if (problem) return setError(problem);
    setPending(true);
    setError("");
    const result = await attempt(() => createCategory({ kind, name, icon, color, keywords: words }));
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success(`${quoted(name.trim(), "을", "를")} 추가했어요`);
    onCreated(result.data.id, kind);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle>카테고리 추가</DialogTitle>
        <DialogDescription>키워드를 넣어 두면 한 줄 입력이 알아서 이 카테고리로 나눠요.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <p id="category-new-kind" className="text-xs font-bold text-ink-3">
          종류
        </p>
        <div role="group" aria-labelledby="category-new-kind" className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={tabPillVariants({ active: kind === k })}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <CategoryIcon icon={icon} color={color} className="size-[42px]" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="category-new-name">이름</Label>
          <Input
            id="category-new-name"
            autoFocus
            autoComplete="off"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "expense" ? "예: 반려동물" : "예: 중고 판매"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-ink-3">아이콘</p>
        <IconGrid value={icon} color={color} onPick={setIcon} />
        <CustomEmojiInput id="category-new-icon" value={icon} onApply={setIcon} />
      </div>

      <div className="space-y-1.5">
        <p id="category-new-color" className="text-xs font-bold text-ink-3">
          색
        </p>
        <ColorPicker swatches={CATEGORY_COLORS} value={color} onChange={setColor} labelledBy="category-new-color" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category-new-keywords">키워드</Label>
        <Input
          id="category-new-keywords"
          autoComplete="off"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          aria-describedby="category-new-keywords-help"
          placeholder={kind === "expense" ? "사료, 동물병원, 간식" : "당근, 중고"}
        />
        <p id="category-new-keywords-help" className="text-xs text-ink-3">
          쉼표로 나눠 적어요. 나중에 언제든 더하거나 뺄 수 있어요.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <CircleNotchIcon aria-hidden className="animate-spin" />}
          추가
        </Button>
      </DialogFooter>
    </form>
  );
}
