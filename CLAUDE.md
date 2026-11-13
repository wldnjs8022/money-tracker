@AGENTS.md

# Project notes

Personal desktop-browser 가계부 (household ledger). UI copy is Korean; code and comments are English.

- **Money model** (see the comment at the top of `src/db/schema.ts`): every transaction belongs to a wallet; transfers move money between wallets; card bill payment is a bank → card transfer, never an expense. Balances are computed (`opening_balance + transactions`), never stored.
- **Dates** are `YYYY-MM-DD` strings in KST. Use `todayKST()` from `src/lib/dates.ts`, never `new Date().toISOString()`.
- **Data access**: every exported function in `src/server/queries.ts` and `src/server/actions.ts` calls `requireUser()` itself and scopes by `user_id`. Actions validate with Zod, check wallet/category ownership, and call `refresh()`.
- **Cache Components is on.** Pages render a `<Suspense>` boundary and read session/searchParams inside it. Call `await connection()` before using the clock in a server component.
- **Drizzle gotcha**: single-table selects render columns unqualified (`"id"`), so correlated subqueries must reference outer columns with `sql.raw('"table"."col"')`.
- **Shortcuts** go through `src/lib/hotkeys.ts` (`hotkeyName` reads `event.code`, so they work with the Korean IME on).
- Local DB: `docker compose up -d` (Postgres on 5433). After schema changes: `npm run db:generate && npm run db:migrate`.
- Check before finishing: `npm run typecheck && npm run lint && npm test && npx next build`.
