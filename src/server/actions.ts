"use server";

import { and, eq, getTableColumns, inArray, isNotNull, isNull, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, transactions, wallets } from "@/db/schema";
import { isValidDate, todayKST } from "@/lib/dates";
import { quoted } from "@/lib/josa";
import {
  deriveReviewReason,
  ENTRY_ORIGINS,
  placeKey,
  REVIEW_REASONS,
  WHITESPACE_CLASS,
  type DeletedTransaction,
  type EntryOrigin,
} from "@/lib/review";
import { requireUser } from "./session";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

const isId = (id: unknown): id is string => z.uuid().safeParse(id).success;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}

// ───────────────────────── Transactions ─────────────────────────

const TRANSACTION_NOT_FOUND = "거래를 찾을 수 없어요.";

const transactionFields = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number({ error: "금액을 입력해 주세요." }).int().positive("금액은 0보다 커야 해요.").max(1e13),
  date: z.string().refine(isValidDate, "날짜가 올바르지 않아요."),
  walletId: z.uuid("계좌를 선택해 주세요."),
  toWalletId: z.uuid().nullish(),
  categoryId: z.uuid().nullish(),
  memo: z.string().trim().max(200, "메모는 200자까지 쓸 수 있어요.").default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

const transactionInput = transactionFields.superRefine((v, ctx) => {
  if (v.type === "transfer") {
    if (!v.toWalletId) ctx.addIssue({ code: "custom", message: "받는 계좌를 선택해 주세요." });
    else if (v.toWalletId === v.walletId) ctx.addIssue({ code: "custom", message: "같은 계좌로는 이체할 수 없어요." });
  }
});

export type TransactionInput = z.input<typeof transactionInput>;

/** Where the record came from and the line it was typed as. Only createTransaction takes these. */
export type CreateTransactionInput = TransactionInput & { origin?: EntryOrigin; sourceText?: string };

const entrySource = z.object({
  origin: z.enum(ENTRY_ORIGINS).default("form"),
  // Provenance only: a long line is cut rather than blocking the save.
  sourceText: z
    .string()
    .default("")
    .transform((text) => text.trim().slice(0, 200)),
});

/** Fields the inline editor may change one at a time. The type never changes in place. */
const PATCH_KEYS = ["amount", "date", "walletId", "toWalletId", "categoryId", "memo", "tags"] as const;
export type TransactionPatch = Partial<Pick<TransactionInput, (typeof PATCH_KEYS)[number]>>;

const restoreFields = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  reviewReason: z.enum(REVIEW_REASONS).nullable(),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  sourceText: z.string().max(200),
});

const isPending = and(isNotNull(transactions.reviewReason), isNull(transactions.reviewedAt));

/** A timestamptz as UTC ISO text with all six fractional digits (null stays null). */
function isoMicros(column: AnyColumn) {
  return sql<string | null>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/** Saving a flagged record counts as reviewing it; an already reviewed one keeps its time. */
const markReviewed = sql`case when ${transactions.reviewReason} is not null then coalesce(${transactions.reviewedAt}, now()) end`;

// A run of what JS `\s` counts as whitespace (see WHITESPACE_CLASS). With Postgres's own `\s`, a memo
// typed with Option+Space or pasted from a bank SMS would key differently here than in placeKey().
const WHITESPACE_RUN = sql.raw(`'[${WHITESPACE_CLASS}]+'`);

/**
 * SQL twin of placeKey() in lib/review.ts. placeSeen() runs both the new memo and the stored ones
 * through this same expression, so an identical memo is always a seen place.
 */
const placeKeySql = (memo: SQL) =>
  sql`lower(split_part(btrim(regexp_replace(${memo}, ${WHITESPACE_RUN}, ' ', 'g')), ' ', 1))`;

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

/** Whether any of the user's records already starts with the same place word as this memo. */
async function placeSeen(userId: string, memo: string) {
  const [match] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${placeKeySql(sql`${transactions.memo}`)} = ${placeKeySql(sql`${memo}::text`)}`,
      ),
    )
    .limit(1);
  return Boolean(match);
}

export async function createTransaction(input: CreateTransactionInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const values = await normalizeTransaction(user.id, input);
  if (!values.ok) return values;
  const source = entrySource.safeParse({ origin: input.origin, sourceText: input.sourceText });
  if (!source.success) return fail(firstIssue(source.error));
  const { origin, sourceText } = source.data;
  const v = values.data;

  let reviewReason = deriveReviewReason({ origin, type: v.type, categoryId: v.categoryId });
  // A place check only matters when nothing else flagged the record: a categorized quick-entry expense.
  if (!reviewReason && origin !== "form" && v.type === "expense" && placeKey(v.memo) !== "") {
    const isNewPlace = !(await placeSeen(user.id, v.memo));
    reviewReason = deriveReviewReason({ origin, type: v.type, categoryId: v.categoryId, isNewPlace });
  }

  const [row] = await db
    .insert(transactions)
    .values({ ...v, userId: user.id, reviewReason, sourceText })
    .returning({ id: transactions.id });
  refresh();
  return ok({ id: row.id });
}

/** Full edit from the form dialog. Saving a pending record also confirms it. */
export async function updateTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  const values = await normalizeTransaction(user.id, input);
  if (!values.ok) return values;
  const updated = await db
    .update(transactions)
    .set({ ...values.data, reviewedAt: markReviewed })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });
  if (updated.length === 0) return fail(TRANSACTION_NOT_FOUND);
  refresh();
  return ok(null);
}

/**
 * Changes some fields of a stored record (the inline detail editor), validated like a full save.
 * Picking a category, or passing `confirm`, also confirms a pending record.
 */
export async function patchTransaction(
  id: string,
  patch: TransactionPatch,
  opts?: { confirm?: boolean },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  if (typeof patch !== "object" || patch === null) return fail("입력값을 확인해 주세요.");
  const [stored] = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      walletId: transactions.walletId,
      toWalletId: transactions.toWalletId,
      categoryId: transactions.categoryId,
      memo: transactions.memo,
      tags: transactions.tags,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  if (!stored) return fail(TRANSACTION_NOT_FOUND);

  const changes: TransactionPatch = Object.fromEntries(
    PATCH_KEYS.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]),
  );
  const values = await normalizeTransaction(user.id, { ...stored, ...changes });
  if (!values.ok) return values;

  const confirm = opts?.confirm === true || typeof changes.categoryId === "string";
  const updated = await db
    .update(transactions)
    .set({ ...values.data, ...(confirm ? { reviewedAt: markReviewed } : {}) })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });
  if (updated.length === 0) return fail(TRANSACTION_NOT_FOUND);
  refresh();
  return ok(null);
}

/** Marks a pending record as reviewed. Confirming a record that isn't pending is a no-op. */
export async function confirmTransaction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  const owned = and(eq(transactions.id, id), eq(transactions.userId, user.id));
  const updated = await db
    .update(transactions)
    .set({ reviewedAt: sql`now()` })
    .where(and(owned, isPending))
    .returning({ id: transactions.id });
  if (updated.length === 0) {
    const [exists] = await db.select({ id: transactions.id }).from(transactions).where(owned);
    if (!exists) return fail(TRANSACTION_NOT_FOUND);
  }
  refresh();
  return ok(null);
}

/** Undo of confirmTransaction: puts the record back in the review queue. */
export async function unconfirmTransaction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  const updated = await db
    .update(transactions)
    .set({ reviewedAt: null })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });
  if (updated.length === 0) return fail(TRANSACTION_NOT_FOUND);
  refresh();
  return ok(null);
}

/** Copies a record into a new one dated today. The copy never needs review. */
export async function duplicateTransaction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  const [source] = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      walletId: transactions.walletId,
      toWalletId: transactions.toWalletId,
      categoryId: transactions.categoryId,
      memo: transactions.memo,
      tags: transactions.tags,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  if (!source) return fail(TRANSACTION_NOT_FOUND);
  const values = await normalizeTransaction(user.id, { ...source, date: todayKST() });
  if (!values.ok) return values;
  const [row] = await db
    .insert(transactions)
    .values({ ...values.data, userId: user.id })
    .returning({ id: transactions.id });
  refresh();
  return ok({ id: row.id });
}

/** Returns the deleted record so the client can offer "되돌리기" (restoreTransaction). */
export async function deleteTransaction(id: string): Promise<ActionResult<DeletedTransaction>> {
  const user = await requireUser();
  if (!isId(id)) return fail(TRANSACTION_NOT_FOUND);
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({
      ...getTableColumns(transactions),
      // Postgres keeps microseconds and JS Dates don't, so the snapshot carries the exact text.
      createdAtExact: isoMicros(transactions.createdAt),
      reviewedAtExact: isoMicros(transactions.reviewedAt),
    });
  if (!row) return fail(TRANSACTION_NOT_FOUND);
  refresh();
  return ok({
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    walletId: row.walletId,
    toWalletId: row.toWalletId,
    categoryId: row.categoryId,
    memo: row.memo,
    tags: row.tags,
    createdAt: row.createdAtExact ?? row.createdAt.toISOString(),
    reviewReason: row.reviewReason,
    reviewedAt: row.reviewedAt ? (row.reviewedAtExact ?? row.reviewedAt.toISOString()) : null,
    sourceText: row.sourceText,
  });
}

/**
 * Undo of deleteTransaction. Re-validates ownership like any save, then puts the record back
 * with the same id, creation time, review state and source line, so it lands where it was.
 */
export async function restoreTransaction(snapshot: DeletedTransaction): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const meta = restoreFields.safeParse(snapshot);
  if (!meta.success) return fail("되돌릴 기록이 올바르지 않아요.");
  const values = await normalizeTransaction(user.id, snapshot);
  if (!values.ok) return values;
  const { id, createdAt, reviewReason, reviewedAt, sourceText } = meta.data;
  const [row] = await db
    .insert(transactions)
    .values({
      ...values.data,
      id,
      userId: user.id,
      createdAt: sql`${createdAt}::timestamptz`,
      reviewReason,
      reviewedAt: reviewReason && reviewedAt ? sql`${reviewedAt}::timestamptz` : null,
      sourceText,
    })
    .onConflictDoNothing({ target: transactions.id })
    .returning({ id: transactions.id });
  if (!row) return fail("이미 되돌린 기록이에요.");
  refresh();
  return ok({ id: row.id });
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

/**
 * Keywords stay unique across a user's categories (the parser would tie on a shared one), as the
 * categories screen and addCategoryKeyword already enforce. Returns the first clash, if any.
 */
async function keywordClash(userId: string, keywords: string[], selfId: string | null) {
  if (keywords.length === 0) return null;
  const others = await db
    .select({ id: categories.id, name: categories.name, keywords: categories.keywords })
    .from(categories)
    .where(eq(categories.userId, userId));
  for (const word of keywords) {
    const owner = others.find((c) => c.id !== selfId && c.keywords.some((k) => k.toLowerCase() === word.toLowerCase()));
    if (owner) return `${quoted(word, "은", "는")} 이미 ${owner.name} 키워드예요. 거기서 먼저 빼 주세요.`;
  }
  return null;
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const clash = await keywordClash(user.id, parsed.data.keywords, null);
  if (clash) return fail(clash);
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
  const clash = await keywordClash(user.id, parsed.data.keywords, id.toLowerCase());
  if (clash) return fail(clash);
  await db
    .update(categories)
    .set({ ...parsed.data, keywords: [...new Set(parsed.data.keywords)] })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  refresh();
  return ok(null);
}

/**
 * Adds one quick-entry keyword to a category (an AI or inbox suggestion, or the categories screen).
 * A word another category owns is refused, as the categories screen does: the parser would tie on it.
 */
export async function addCategoryKeyword(id: string, keyword: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return fail("카테고리를 찾을 수 없어요.");
  const word = keyword.trim();
  if (!word || word.length > 30) return fail("키워드가 올바르지 않아요.");
  const owned = await db
    .select({ id: categories.id, name: categories.name, keywords: categories.keywords })
    .from(categories)
    .where(eq(categories.userId, user.id));
  const category = owned.find((c) => c.id === id.toLowerCase());
  if (!category) return fail("카테고리를 찾을 수 없어요.");
  const sameWord = (k: string) => k.toLowerCase() === word.toLowerCase();
  if (category.keywords.some(sameWord)) return ok(null);
  const owner = owned.find((c) => c !== category && c.keywords.some(sameWord));
  if (owner) return fail(`${quoted(word, "은", "는")} 이미 ${owner.name} 키워드예요. 거기서 먼저 빼 주세요.`);
  if (category.keywords.length >= 50) return fail("키워드는 카테고리당 50개까지예요.");
  await db
    .update(categories)
    .set({ keywords: [...category.keywords, word] })
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
