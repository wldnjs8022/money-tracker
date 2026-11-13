import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/**
 * Money model
 *
 * - Every transaction belongs to a wallet (계좌): cash, bank account, credit card, ...
 * - A transfer moves money between two of the user's wallets. Paying a credit card
 *   bill is a transfer (bank → card), not an expense, so card spending is never
 *   counted twice.
 * - Balances are never stored. A wallet's balance is its opening balance plus the
 *   sum of its transactions, so it can't drift out of sync.
 * - Credit card balances go negative as you spend (that's debt). Net worth is simply
 *   the sum of all wallet balances.
 */

export const walletKind = pgEnum("wallet_kind", ["cash", "bank", "card", "invest", "other"]);
export const categoryKind = pgEnum("category_kind", ["income", "expense"]);
export const txnType = pgEnum("txn_type", ["income", "expense", "transfer"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const wallets = pgTable(
  "wallets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: walletKind().notNull(),
    openingBalance: bigint({ mode: "number" }).notNull().default(0),
    color: text().notNull().default("#64748b"),
    sortOrder: integer().notNull().default(0),
    archived: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: categoryKind().notNull(),
    name: text().notNull(),
    icon: text().notNull().default("📦"),
    color: text().notNull().default("#94a3b8"),
    /** Words that map quick-entry text to this category, e.g. 커피 → 카페·간식 */
    keywords: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sortOrder: integer().notNull().default(0),
    archived: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.kind)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: txnType().notNull(),
    /** Always positive, in won. The type decides the direction. */
    amount: bigint({ mode: "number" }).notNull(),
    date: date({ mode: "string" }).notNull(),
    walletId: uuid()
      .notNull()
      .references(() => wallets.id),
    /** Destination wallet, transfers only */
    toWalletId: uuid().references(() => wallets.id),
    /** Null for transfers, or when the category was deleted (미분류) */
    categoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
    memo: text().notNull().default(""),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [
    index().on(t.userId, t.date),
    index().on(t.walletId),
    index().on(t.toWalletId),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check("transactions_transfer_has_target", sql`(${t.type} = 'transfer') = (${t.toWalletId} is not null)`),
    check("transactions_transfer_distinct", sql`${t.toWalletId} is null or ${t.toWalletId} <> ${t.walletId}`),
  ],
);

export type Wallet = typeof wallets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type WalletKind = (typeof walletKind.enumValues)[number];
export type CategoryKind = (typeof categoryKind.enumValues)[number];
export type TxnType = (typeof txnType.enumValues)[number];
