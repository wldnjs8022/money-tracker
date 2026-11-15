"use client";

import { chordKeys, NAV } from "@/components/app/nav";
import { useUI } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withRo } from "@/lib/josa";

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

const ANYWHERE: Group = {
  title: "어디서나",
  items: [
    { keys: ["N"], label: "한 줄 입력" },
    { keys: ["/"], label: "검색 · 명령" },
    { keys: ["⌘", "K"], label: "명령 팔레트" },
    ...NAV.map((item) => ({ keys: chordKeys(item), label: withRo(item.label) })),
    { keys: ["?"], label: "이 도움말" },
  ],
};

const INBOX: Group = {
  title: "기록",
  items: [
    { keys: ["J", "K"], label: "아래 · 위로 이동" },
    { keys: ["E"], label: "확인" },
    { keys: ["C"], label: "분류 바꾸기" },
    { keys: ["⌫"], label: "지우기" },
    { keys: ["Enter"], label: "메모 고치기" },
    { keys: ["[", "]"], label: "지난달 · 다음 달" },
  ],
};

const QUICK_ENTRY: Group = {
  title: "한 줄 입력",
  items: [
    { keys: ["Enter"], label: "저장" },
    { keys: ["⇧", "Enter"], label: "저장하고 계속" },
    { keys: ["⌘", "Enter"], label: "AI로 정리" },
    { keys: ["Tab"], label: "자세히 쓰기" },
  ],
};

const FORM: Group = {
  title: "기록 창",
  items: [
    { keys: ["⌘", "Enter"], label: "저장" },
    { keys: ["Esc"], label: "닫기" },
  ],
};

/** Columns of the help dialog; the last one stacks two short groups. */
const COLUMNS: Group[][] = [[ANYWHERE], [INBOX], [QUICK_ENTRY, FORM]];

export function ShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useUI();
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>단축키</DialogTitle>
          <DialogDescription>마우스 없이도 기록하고, 확인하고, 옮겨 다닐 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column[0].title} className="space-y-6">
              {column.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-1 text-xs font-bold text-ink-3">
                    {group.title}
                  </h3>
                  <ul>
                    {group.items.map(({ keys, label }) => (
                      <li
                        key={label}
                        className="flex min-h-9 items-center justify-between gap-3 border-b border-line-soft text-sm last:border-b-0"
                      >
                        <span className="font-medium">{label}</span>
                        <span className="flex shrink-0 gap-1 text-ink-2">
                          {keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
