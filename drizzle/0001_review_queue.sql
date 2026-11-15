CREATE TYPE "public"."review_reason" AS ENUM('ai', 'new_place', 'uncategorized');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "review_reason" "review_reason";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "source_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_review_pending_idx" ON "transactions" USING btree ("user_id","date") WHERE "transactions"."review_reason" is not null and "transactions"."reviewed_at" is null;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reviewed_has_reason" CHECK ("transactions"."reviewed_at" is null or "transactions"."review_reason" is not null);