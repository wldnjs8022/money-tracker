"use client";

import { XIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/server/queries";
import { quoted, withRo } from "@/components/wallets/ledger-kit";
import { keywordProblem, parseKeywords } from "./category-fields";

/**
 * Quick-entry keywords as chips: × removes one, Enter or leaving the field adds what's typed (commas
 * add several at once). A word another category already owns is refused, so one line never matches
 * two categories.
 */
export function KeywordEditor({
  category,
  categories,
  onAdd,
  onRemove,
}: {
  category: CategoryRow;
  categories: CategoryRow[];
  onAdd: (words: string[]) => void;
  onRemove: (word: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());

  /** Adds the typed words. A refused draft stays in the field with the reason under it. */
  function commit() {
    const words = parseKeywords(draft);
    if (words.length === 0) return;
    const problem = keywordProblem(
      words,
      category.keywords,
      categories.filter((c) => c.id !== category.id),
    );
    if (problem) {
      setError(problem);
      return;
    }
    onAdd(words);
    setDraft("");
    setError("");
  }

  // The chip (and its focused ×) goes away at once, so focus moves to the next chip's ×, else the
  // previous one's, else the input: keyboard and screen-reader users keep their place.
  function remove(word: string, index: number) {
    const neighbor = category.keywords[index + 1] ?? category.keywords[index - 1];
    onRemove(word);
    const target = neighbor === undefined ? inputRef.current : removeButtons.current.get(neighbor);
    target?.focus();
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="category-keyword-input">키워드</Label>
      <div
        onMouseDown={(e) => {
          // Clicking the empty part of the field focuses the input, like a plain text field.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-[9px] border border-input bg-card p-1 transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/12",
          error && "border-destructive",
        )}
      >
        {category.keywords.map((word, index) => (
          <span
            key={word}
            className="inline-flex h-8 cursor-default items-center gap-0.5 rounded-[6px] bg-muted pl-2.5 text-[13px] font-semibold"
          >
            {word}
            <button
              ref={(el) => {
                if (!el) return;
                removeButtons.current.set(word, el);
                return () => {
                  removeButtons.current.delete(word);
                };
              }}
              type="button"
              aria-label={`${quoted(word, "을", "를")} 키워드에서 빼기`}
              onClick={() => remove(word, index)}
              className="flex size-8 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-offset-[-2px]"
            >
              <XIcon aria-hidden weight="bold" className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="category-keyword-input"
          value={draft}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="category-keyword-help category-keyword-error"
          aria-invalid={error ? true : undefined}
          placeholder={category.keywords.length > 0 ? "키워드 추가" : "예: 국밥, 김밥"}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onBlur={() => {
            if (draft.trim()) commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape" && draft) {
              e.preventDefault();
              setDraft("");
              setError("");
            }
          }}
          className="h-8 min-w-28 flex-1 bg-transparent px-1.5 text-sm text-foreground outline-none placeholder:text-ink-3"
        />
      </div>
      <p id="category-keyword-error" role="alert" className="text-xs font-semibold text-destructive empty:hidden">
        {error}
      </p>
      <p id="category-keyword-help" className="text-xs text-ink-3">
        한 줄 입력에 이 말이 들어가면 {withRo(category.name)} 나눠요. Enter로 넣고, 쉼표로 여러 개를 한 번에 넣을 수 있어요.
      </p>
    </div>
  );
}
