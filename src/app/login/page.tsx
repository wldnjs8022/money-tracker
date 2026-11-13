"use client";

import { Loader2Icon, WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 맞지 않아요.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일이에요.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "이미 가입된 이메일이에요.",
  PASSWORD_TOO_SHORT: "비밀번호는 8자 이상이어야 해요.",
  INVALID_EMAIL: "이메일 형식이 올바르지 않아요.",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name.trim() || "나" });
    if (result.error) {
      setError(ERROR_MESSAGES[result.error.code ?? ""] ?? result.error.message ?? "다시 시도해 주세요.");
      setPending(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-brand-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <WalletIcon className="size-6" />
          가계부
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl leading-tight font-bold tracking-tight">
            한 줄이면 기록 끝.
            <br />
            돈의 흐름이 한눈에.
          </h1>
          <div className="space-y-3 text-base opacity-90">
            <p className="flex items-center gap-3">
              <kbd className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-sm">N</kbd>
              <span>&ldquo;점심 김밥 4500 카드&rdquo;라고 치면 알아서 정리</span>
            </p>
            <p className="flex items-center gap-3">
              <kbd className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-sm">⌘K</kbd>
              <span>어디서든 키보드로 이동하고 찾기</span>
            </p>
            <p className="flex items-center gap-3">
              <kbd className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-sm">₩</kbd>
              <span>카드값 이중 계산 없이 정확한 순자산</span>
            </p>
          </div>
        </div>
        <p className="text-sm opacity-70">나만 쓰는 데스크톱 가계부</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -top-16 right-24 size-48 rounded-full bg-white/10" />
      </section>

      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{mode === "login" ? "다시 오셨네요" : "시작해 볼까요"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "이메일로 로그인하세요." : "계정을 만들면 기본 계좌와 카테고리가 준비돼요."}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="w-full">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="뭐라고 부를까요?" />
              </div>
            )}
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {mode === "login" ? "로그인" : "가입하고 시작하기"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
