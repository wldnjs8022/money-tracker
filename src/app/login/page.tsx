"use client";

import { CheckIcon, CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useLayoutEffect, useState } from "react";
import { Amount, Kbd, LogoMark } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger, tabPillVariants } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { REVIEW_CHIP, reviewSentence, type ReviewReason } from "@/lib/review";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 맞지 않아요.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일이에요.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "이미 가입된 이메일이에요.",
  PASSWORD_TOO_SHORT: "비밀번호는 8자 이상이어야 해요.",
  INVALID_EMAIL: "이메일 형식이 올바르지 않아요.",
};

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Cache Components keeps a left route mounted but hidden, so a client redirect back here (requireUser)
  // would show this same instance again. Reset it on hide so it never comes back stuck or holding a password.
  useLayoutEffect(
    () => () => {
      setPending(false);
      setPassword("");
      setError("");
    },
    [],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    let result;
    try {
      result =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() || "나" });
    } catch {
      // The request never got an answer (offline, server down): Better Auth throws instead of returning an error.
      setError("서버에 닿지 못했어요. 연결을 확인하고 다시 해 주세요.");
      setPending(false);
      return;
    }
    if (result.error) {
      setError(ERROR_MESSAGES[result.error.code ?? ""] ?? result.error.message ?? "다시 시도해 주세요.");
      setPending(false);
      return;
    }
    // A full load, so this page isn't left mounted in the signed-in tab and the app starts with no state
    // from an earlier account. `pending` stays on until the page goes, which blocks a second submit.
    window.location.replace("/");
  }

  return (
    <main className="page-grid flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-[440px] overflow-hidden rounded-3xl border border-line bg-card text-card-foreground shadow-window lg:max-w-[1040px] lg:grid-cols-[440px_minmax(0,1fr)]">
        <section className="flex flex-col justify-center px-7 py-9 sm:px-10 sm:py-11">
          <LogoMark className="size-10 rounded-[10px]" />
          <h1 className="mt-5 text-[28px] leading-tight font-extrabold tracking-[-0.04em]">가계부</h1>
          <p className="mt-1.5 text-sm text-ink-2">한 줄로 적으면 분류와 계좌는 알아서 나눠요.</p>

          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode);
              setError("");
            }}
            className="mt-8 gap-6"
          >
            <TabsList variant="segment" aria-label="로그인 또는 회원가입" className="w-full">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            {/* One panel whose value follows the mode, so typed email and password carry over.
                It holds focusable fields, so the panel itself stays out of the tab order. */}
            <TabsContent value={mode} tabIndex={-1}>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="뭐라고 부를까요?"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "8자 이상" : undefined}
                  />
                </div>
                {error && (
                  <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-destructive">
                    <WarningCircleIcon aria-hidden weight="bold" className="mt-px size-4 shrink-0" />
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" disabled={pending} className="w-full font-bold">
                  {pending && <CircleNotchIcon aria-hidden weight="bold" className="animate-spin" />}
                  {mode === "login" ? "로그인" : "가입하고 시작하기"}
                </Button>
                {mode === "signup" && (
                  <p className="text-center text-xs text-ink-3">가입하면 기본 계좌와 카테고리를 만들어 둬요.</p>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </section>

        <InboxPreview />
      </div>
    </main>
  );
}

type PreviewRow = {
  memo: string;
  sub: string;
  amount: number;
  type: "expense" | "income";
  reason?: ReviewReason;
  selected?: boolean;
};

// Demo records in the shape the 기록 page shows them (matching the seeded demo account).
const TODAY_ROWS: PreviewRow[] = [
  { memo: "점심 마라탕", sub: "식비 · 신용카드", amount: 11000, type: "expense", reason: "ai", selected: true },
  { memo: "공차 버블티", sub: "카페·간식 · 신용카드", amount: 4800, type: "expense", reason: "ai" },
  { memo: "지하철", sub: "교통 · 신용카드", amount: 2900, type: "expense" },
];
const YESTERDAY_ROWS: PreviewRow[] = [
  { memo: "다이소 수납함", sub: "생활 · 신용카드", amount: 12000, type: "expense", reason: "new_place" },
  { memo: "용돈", sub: "기타 수입 · 주거래 통장", amount: 50000, type: "income" },
];

/**
 * A still picture of the 기록 page (확인할 것 view), built from the app's own pieces.
 * Decorative: hidden from assistive tech and inert, so none of it takes focus or clicks.
 */
function InboxPreview() {
  return (
    <section aria-hidden inert className="hidden flex-col justify-center gap-5 border-l border-line-soft bg-side p-10 lg:flex">
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex gap-1.5 border-b border-line-soft p-3">
          <span className={tabPillVariants({ active: true })}>
            확인할 것 <Badge variant="signal">3</Badge>
          </span>
          <span className={tabPillVariants({ active: false })}>전체</span>
          <span className={tabPillVariants({ active: false })}>이체</span>
        </div>
        <PreviewDay label="오늘" rows={TODAY_ROWS} />
        <PreviewDay label="어제" rows={YESTERDAY_ROWS} />
      </div>

      <div className="rounded-xl border border-line bg-card p-5">
        <div className="flex items-center gap-2">
          <Badge variant="signal" size="lg">
            확인할 것
          </Badge>
          <span className="truncate text-[13px] text-ink-2">{reviewSentence("ai", "식비")}</span>
        </div>
        <p className="mt-3 text-xl font-bold tracking-[-0.035em]">점심 마라탕</p>
        <Amount value={11000} type="expense" className="mt-0.5 block text-[34px] leading-tight font-extrabold tracking-[-0.05em]" />
        <p className="mt-3 rounded-[9px] bg-muted px-3 py-2.5 font-mono text-[13px] text-ink-2">
          점심 마라탕 11000 공차 버블티 4800 카드
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(buttonVariants({ variant: "signal", size: "lg" }))}>
            <CheckIcon weight="bold" />
            확인
            <Kbd>E</Kbd>
          </span>
          <span className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>분류 바꾸기</span>
        </div>
      </div>
    </section>
  );
}

function PreviewDay({ label, rows }: { label: string; rows: PreviewRow[] }) {
  return (
    <div>
      <p className="px-4 pt-2.5 pb-1 text-xs font-bold text-ink-3">{label}</p>
      {rows.map((row) => (
        <div
          key={row.memo}
          className={cn("flex min-h-[56px] items-center gap-2.5 border-t border-muted px-4 py-2", row.selected && "bg-muted")}
        >
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              row.reason ? "bg-signal ring-3 ring-signal/35" : "bg-dot dark:bg-ink-4/60",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{row.memo}</span>
              {row.reason && <Badge variant="tint">{REVIEW_CHIP[row.reason]}</Badge>}
            </span>
            <span className="block truncate text-xs text-ink-3">{row.sub}</span>
          </span>
          <Amount value={row.amount} type={row.type} className="text-sm" />
        </div>
      ))}
    </div>
  );
}
