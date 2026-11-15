"use client";

import { PencilSimpleLineIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";

/** First-run nudge, shown while the account has no records at all. */
export function Welcome() {
  return (
    <section
      aria-labelledby="home-welcome-title"
      className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-side px-5 py-4"
    >
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-mark text-mark-foreground">
        <PencilSimpleLineIcon weight="fill" className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <h2 id="home-welcome-title" className="text-[15px] font-bold tracking-[-0.02em]">
          첫 기록을 남겨 볼까요?
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          &ldquo;점심 김밥 4500&rdquo;처럼 한 줄로 쓰면 끝이에요. 계좌 잔액은{" "}
          <Link href="/wallets" className="font-semibold text-foreground underline underline-offset-2">
            계좌
          </Link>
          에서 맞춰 두세요.
        </p>
      </div>
      <NewTransactionButton>첫 기록 남기기</NewTransactionButton>
    </section>
  );
}
