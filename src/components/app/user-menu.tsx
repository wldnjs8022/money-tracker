"use client";

import { DesktopIcon, KeyboardIcon, MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useSignOut } from "@/components/app/use-sign-out";
import { useUI } from "@/components/app/ui-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Avatar button at the bottom of the icon rail: account, theme, shortcuts and sign-out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const { theme, setTheme } = useTheme();
  const { setHelpOpen } = useUI();
  const signOut = useSignOut();
  const initial = Array.from(name.trim())[0] ?? "나";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${name} 계정 메뉴`}
        className="flex size-11 items-center justify-center rounded-[10px] outline-none focus-ring transition-colors duration-150 hover:bg-muted aria-expanded:bg-muted"
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full border border-line bg-muted text-[13px] font-bold text-foreground"
        >
          {initial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-60">
        <div className="px-2.5 pt-2 pb-2.5">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-xs text-ink-3">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>테마</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <SunIcon aria-hidden /> 라이트
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon aria-hidden /> 다크
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <DesktopIcon aria-hidden /> 시스템 설정
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
          <KeyboardIcon aria-hidden /> 단축키
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <SignOutIcon aria-hidden /> 로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
