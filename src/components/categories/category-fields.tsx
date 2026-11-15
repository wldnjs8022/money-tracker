"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { CategoryIcon, ICON_EMOJIS } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/server/queries";
import { quoted, type Swatch } from "@/components/wallets/ledger-kit";

export type CategoryKind = CategoryRow["kind"];

export const KINDS: readonly CategoryKind[] = ["expense", "income"];
export const KIND_LABEL: Record<CategoryKind, string> = { expense: "지출", income: "수입" };

/** In hue order. Covers every colour the default categories use. */
export const CATEGORY_COLORS: readonly Swatch[] = [
  { value: "#ef4444", name: "빨강" },
  { value: "#f97316", name: "주황" },
  { value: "#f59e0b", name: "호박색" },
  { value: "#eab308", name: "노랑" },
  { value: "#a16207", name: "갈색" },
  { value: "#16a34a", name: "초록" },
  { value: "#14b8a6", name: "민트" },
  { value: "#0d9488", name: "청록" },
  { value: "#06b6d4", name: "시안" },
  { value: "#0ea5e9", name: "하늘" },
  { value: "#3b82f6", name: "파랑" },
  { value: "#2563eb", name: "진한 파랑" },
  { value: "#6366f1", name: "남색" },
  { value: "#8b5cf6", name: "보라" },
  { value: "#d946ef", name: "자홍" },
  { value: "#ec4899", name: "분홍" },
  { value: "#94a3b8", name: "회색" },
];

/** The server keeps up to 8 characters; a few emoji with modifiers fit. */
export const ICON_MAX_LENGTH = 8;

// The server's keyword bounds (actions.ts), checked here first so the message is ours.
const KEYWORD_MAX_LENGTH = 30;
const KEYWORDS_PER_CATEGORY = 50;

const sameWord = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** "국밥, 김밥，국밥" → ["국밥", "김밥"]: split on commas, trimmed, case-insensitive duplicates dropped. */
export function parseKeywords(text: string): string[] {
  const byKey = new Map<string, string>();
  for (const part of text.split(/[,，]/)) {
    const word = part.trim();
    if (word && !byKey.has(word.toLowerCase())) byKey.set(word.toLowerCase(), word);
  }
  return [...byKey.values()];
}

/**
 * Why these words can't be added to a category that already has `existing`, or null when they can.
 * A word another category owns is refused, so one quick-entry line never matches two categories.
 */
export function keywordProblem(
  words: string[],
  existing: readonly string[],
  others: readonly Pick<CategoryRow, "name" | "keywords">[],
): string | null {
  for (const word of words) {
    if (word.length > KEYWORD_MAX_LENGTH) return `키워드는 ${KEYWORD_MAX_LENGTH}자까지 쓸 수 있어요.`;
    if (existing.some((k) => sameWord(k, word))) return `${quoted(word, "은", "는")} 이미 있어요.`;
    const owner = others.find((c) => c.keywords.some((k) => sameWord(k, word)));
    if (owner) return `${quoted(word, "은", "는")} 이미 ${owner.name} 키워드예요. 거기서 먼저 빼 주세요.`;
  }
  if (existing.length + words.length > KEYWORDS_PER_CATEGORY) {
    return `키워드는 카테고리마다 ${KEYWORDS_PER_CATEGORY}개까지예요.`;
  }
  return null;
}

const bare = (emoji: string) => emoji.replace(/️/g, "");

/** The picker's icons as toggle buttons, tinted with the category colour. */
export function IconGrid({ value, color, onPick }: { value: string; color: string; onPick: (emoji: string) => void }) {
  const current = bare(value);
  return (
    <div role="group" aria-label="아이콘 고르기" className="grid grid-cols-8 gap-1">
      {ICON_EMOJIS.map((emoji) => {
        const on = bare(emoji) === current;
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={on}
            aria-label={emoji}
            onClick={() => onPick(emoji)}
            className={cn(
              "flex size-10 items-center justify-center rounded-[10px] transition-colors duration-150 hover:bg-muted",
              on && "bg-muted ring-2 ring-foreground ring-inset",
            )}
          >
            <CategoryIcon icon={emoji} color={color} className="size-8" />
          </button>
        );
      })}
    </div>
  );
}

/** Any emoji the grid doesn't have: typed, applied with Enter or the button. */
export function CustomEmojiInput({ id, value, onApply }: { id: string; value: string; onApply: (emoji: string) => void }) {
  const inGrid = ICON_EMOJIS.some((emoji) => bare(emoji) === bare(value));
  const [draft, setDraft] = useState(inGrid ? "" : value);
  const apply = () => {
    const next = draft.trim();
    if (next) onApply(next);
  };
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-bold whitespace-nowrap text-ink-3">
        다른 이모지
      </label>
      <Input
        id={id}
        value={draft}
        maxLength={ICON_MAX_LENGTH}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            apply();
          }
        }}
        placeholder="🐟"
        className="h-10 w-20 text-center text-lg"
      />
      <Button type="button" variant="outline" onClick={apply} disabled={!draft.trim()}>
        적용
      </Button>
    </div>
  );
}

/** Field-style trigger showing the current icon; the grid opens in a popover. */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (emoji: string) => {
    setOpen(false);
    if (emoji !== value) onChange(emoji);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Named by its visible text ("아이콘 바꾸기"), which already says what the field is. */}
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-[42px] w-full items-center gap-2.5 rounded-[9px] border border-input bg-card pr-2.5 pl-2 text-sm font-semibold transition-[border-color,background-color] duration-150 hover:bg-muted/50 aria-expanded:border-ring"
        >
          <CategoryIcon icon={value} color={color} className="size-7" />
          <span className="flex-1 text-left">아이콘 바꾸기</span>
          <CaretDownIcon aria-hidden className="size-3.5 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-3">
        <IconGrid value={value} color={color} onPick={pick} />
        <div className="border-t border-line-soft pt-3">
          <CustomEmojiInput id="category-icon-custom" value={value} onApply={pick} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
