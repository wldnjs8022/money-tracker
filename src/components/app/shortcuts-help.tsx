"use client";

import { useUI } from "@/components/app/ui-provider";
import { Kbd } from "@/components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: "어디서나",
    items: [
      [["N"], "빠른 입력"],
      [["⌘", "K"], "명령 팔레트"],
      [["G", "D"], "대시보드로"],
      [["G", "T"], "거래 내역으로"],
      [["G", "W"], "계좌로"],
      [["G", "C"], "카테고리로"],
      [["?"], "이 도움말"],
    ],
  },
  {
    title: "대시보드 · 거래 내역",
    items: [
      [["["], "이전 달"],
      [["]"], "다음 달"],
      [["/"], "검색"],
      [["J", "K"], "아래 / 위 거래 선택"],
      [["Enter"], "선택한 거래 수정"],
      [["⌫"], "선택한 거래 삭제"],
    ],
  },
  {
    title: "빠른 입력",
    items: [
      [["Enter"], "저장"],
      [["⇧", "Enter"], "저장하고 계속 입력"],
      [["Tab"], "자세히 편집"],
    ],
  },
];

export function ShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useUI();
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">{group.title}</h3>
              <ul className="space-y-1.5">
                {group.items.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <span className="flex gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
