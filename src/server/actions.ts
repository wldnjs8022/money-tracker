"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, transactions, wallets } from "@/db/schema";
import { isValidDate } from "@/lib/dates";
import { requireUser } from "./session";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

const isId = (id: unknown): id is string => z.uuid().safeParse(id).success;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}

// ───────────────────────── Transactions ─────────────────────────

const transactionInput = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number({ error: "금액을 입력해 주세요." }).int().positive("금액은 0보다 커야 해요.").max(1e13),
    date: z.string().refine(isValidDate, "날짜가 올바르지 않아요."),
    walletId: z.uuid("계좌를 선택해 주세요."),
    toWalletId: z.uuid().nullish(),
    categoryId: z.uuid().nullish(),
    memo: z.string().trim().max(200, "메모는 200자까지 쓸 수 있어요.").default(""),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.toWalletId) ctx.addIssue({ code: "custom", message: "받는 계좌를 선택해 주세요." });
      else if (v.toWalletId === v.walletId) ctx.addIssue({ code: "custom", message: "같은 계좌로는 이체할 수 없어요." });
    }
  });

export type TransactionInput = z.input<typeof transactionInput>;

/** Checks that referenced wallets/category belong to the user and fit the transaction type. */
async function normalizeTransaction(userId: string, raw: TransactionInput) {
  const parsed = transactionInput.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const isTransfer = v.type === "transfer";
  const walletIds = isTransfer ? [v.walletId, v.toWalletId!] : [v.walletId];

  const owned = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), inArray(wallets.id, walletIds)));
  if (owned.length !== new Set(walletIds).size) return fail("계좌를 찾을 수 없어요.");

  let categoryId: string | null = null;
  if (!isTransfer && v.categoryId) {
    const [category] = await db
      .select({ kind: categories.kind })
      .from(categories)
      .where(and(eq(categories.id, v.categoryId), eq(categories.userId, userId)));
    if (!category) return fail("카테고리를 찾을 수 없어요.");
    if (category.kind !== v.type) return fail("수입/지출 종류와 카테고리가 맞지 않아요.");
    categoryId = v.categoryId;
  }

  const tags = [...new Set(v.tags.map((t) => t.replace(/^#/, "")).filter(Boolean))];
  return ok({
    type: v.type,
    amount: v.amount,
    date: v.date,
    walletId: v.walletId,
    toWalletId: isTransfer ? v.toWalletId! : null,
    categoryId,
    memo: v.memo,
    tags,
  });
}

export async function createTransaction(input: TransactionInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const values = await normalizeTransaction(user.id, input);
  if (!values.ok) return values;
  const [row] = await db
    .insert(transactions)
    .values({ ...values.data, userId: user.id })
    .returning({ id: transactions.id });
  refresh();
  return ok({ id: row.id });
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("거래를 찾을 수 없어요.");
  const values = await normalizeTransaction(user.id, input);
  if (!values.ok) return values;
  const updated = await db
    .update(transactions)
    .set(values.data)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });
  if (updated.length === 0) return fail("거래를 찾을 수 없어요.");
  refresh();
  return ok(null);
}

/** Returns the deleted transaction so the client can offer "되돌리기". */
export async function deleteTransaction(id: string): Promise<ActionResult<TransactionInput>> {
  const user = await requireUser();
  if (!isId(id)) return fail("거래를 찾을 수 없어요.");
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning();
  if (!row) return fail("거래를 찾을 수 없어요.");
  refresh();
  return ok({
    type: row.type,
    amount: row.amount,
    date: row.date,
    walletId: row.walletId,
    toWalletId: row.toWalletId,
    categoryId: row.categoryId,
    memo: row.memo,
    tags: row.tags,
  });
}

// ───────────────────────── Wallets ─────────────────────────

const walletInput = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40),
  kind: z.enum(["cash", "bank", "card", "invest", "other"]),
  openingBalance: z.number().int().min(-1e13).max(1e13).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  archived: z.boolean().default(false),
});

export type WalletInput = z.input<typeof walletInput>;

export async function createWallet(input: WalletInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = walletInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${wallets.sortOrder}), -1) + 1`.mapWith(Number) })
    .from(wallets)
    .where(eq(wallets.userId, user.id));
  const [row] = await db
    .insert(wallets)
    .values({ ...parsed.data, userId: user.id, sortOrder: next })
    .returning({ id: wallets.id });
  refresh();
  return ok({ id: row.id });
}

export async function updateWallet(id: string, input: WalletInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("계좌를 찾을 수 없어요.");
  const parsed = walletInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const updated = await db
    .update(wallets)
    .set(parsed.data)
    .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
    .returning({ id: wallets.id });
  if (updated.length === 0) return fail("계좌를 찾을 수 없어요.");
  refresh();
  return ok(null);
}

export async function deleteWallet(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("계좌를 찾을 수 없어요.");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        sql`(${transactions.walletId} = ${id} or ${transactions.toWalletId} = ${id})`,
      ),
    );
  if (n > 0) return fail(`거래가 ${n}건 있는 계좌는 삭제할 수 없어요. 대신 보관해 주세요.`);
  const deleted = await db
    .delete(wallets)
    .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
    .returning({ id: wallets.id });
  if (deleted.length === 0) return fail("계좌를 찾을 수 없어요.");
  refresh();
  return ok(null);
}

// ───────────────────────── Categories ─────────────────────────

const categoryInput = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30),
  icon: z.string().trim().min(1).max(8).default("📦"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#94a3b8"),
  keywords: z.array(z.string().trim().min(1).max(30)).max(50).default([]),
});

export type CategoryInput = z.input<typeof categoryInput>;

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${categories.sortOrder}), -1) + 1`.mapWith(Number) })
    .from(categories)
    .where(eq(categories.userId, user.id));
  const [row] = await db
    .insert(categories)
    .values({ ...parsed.data, keywords: [...new Set(parsed.data.keywords)], userId: user.id, sortOrder: next })
    .returning({ id: categories.id });
  refresh();
  return ok({ id: row.id });
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("카테고리를 찾을 수 없어요.");
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const [existing] = await db
    .select({ kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  if (!existing) return fail("카테고리를 찾을 수 없어요.");
  if (existing.kind !== parsed.data.kind) return fail("수입/지출 종류는 바꿀 수 없어요.");
  await db
    .update(categories)
    .set({ ...parsed.data, keywords: [...new Set(parsed.data.keywords)] })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  refresh();
  return ok(null);
}

/** Transactions in this category become 미분류 (category_id → null). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("카테고리를 찾을 수 없어요.");
  const deleted = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    .returning({ id: categories.id });
  if (deleted.length === 0) return fail("카테고리를 찾을 수 없어요.");
  refresh();
  return ok(null);
}
