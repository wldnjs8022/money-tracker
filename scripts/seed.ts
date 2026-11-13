/**
 * Fills a demo account with ~5 months of realistic data so the dashboard has something to show.
 *
 *   npm run db:seed
 *
 * Local development only. Signs up the demo user if it doesn't exist yet (which also creates
 * the default wallets and categories), then replaces all of its transactions.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { categories, transactions, user, wallets } from "../src/db/schema";
import { addDays, addMonths, daysInMonth, isWeekend, monthOf, todayKST } from "../src/lib/dates";
import { auth } from "../src/lib/auth";

// Test credentials for the local demo account
export const DEMO_USER = { email: "demo@example.com", password: "demo-pass-1234", name: "데모" };
// Throwaway account for trying the sign-up form by hand. Each seed run deletes it.
export const SIGNUP_TEST_USER = { email: "signup-test@example.com", password: "signup-pass-1234", name: "테스트" };

const MONTHS = 5;

// Deterministic randomness so every seed looks the same
let state = 20261113;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rand() < p;
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number, step = 100) => Math.round((min + rand() * (max - min)) / step) * step;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

  // Deleting a user cascades to its wallets, categories and transactions.
  await db.delete(user).where(eq(user.email, SIGNUP_TEST_USER.email));

  let [demo] = await db.select().from(user).where(eq(user.email, DEMO_USER.email));
  if (!demo) {
    await auth.api.signUpEmail({ body: DEMO_USER });
    [demo] = await db.select().from(user).where(eq(user.email, DEMO_USER.email));
    console.log("Created demo user");
  }
  const userId = demo.id;

  const walletRows = await db.select().from(wallets).where(eq(wallets.userId, userId));
  const categoryRows = await db.select().from(categories).where(eq(categories.userId, userId));
  const wallet = (kind: string) => {
    const w = walletRows.find((x) => x.kind === kind);
    if (!w) throw new Error(`Demo user has no ${kind} wallet`);
    return w.id;
  };
  const category = (name: string) => {
    const c = categoryRows.find((x) => x.name === name);
    if (!c) throw new Error(`Demo user has no category ${name}`);
    return c.id;
  };

  const cash = wallet("cash");
  const bank = wallet("bank");
  const card = wallet("card");

  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.update(wallets).set({ openingBalance: 2_400_000 }).where(and(eq(wallets.id, bank)));
  await db.update(wallets).set({ openingBalance: 60_000 }).where(eq(wallets.id, cash));
  await db.update(wallets).set({ openingBalance: -380_000 }).where(eq(wallets.id, card));

  type Row = typeof transactions.$inferInsert;
  const rows: Row[] = [];
  const add = (row: Omit<Row, "userId">) => rows.push({ ...row, userId });

  const today = todayKST();
  const firstMonth = addMonths(monthOf(today), -(MONTHS - 1));
  const cardSpendByMonth = new Map<string, number>();
  const expenseOnCard = (date: string, amount: number, categoryName: string, memo: string, tags: string[] = []) => {
    add({ type: "expense", amount, date, walletId: card, categoryId: category(categoryName), memo, tags });
    cardSpendByMonth.set(monthOf(date), (cardSpendByMonth.get(monthOf(date)) ?? 0) + amount);
  };

  for (let date = `${firstMonth}-01`; date <= today; date = addDays(date, 1)) {
    const day = Number(date.slice(8));
    const month = monthOf(date);
    const weekend = isWeekend(date);

    // Monthly fixed items
    if (day === 25) add({ type: "income", amount: 3_200_000, date, walletId: bank, categoryId: category("급여"), memo: "월급" });
    if (day === 1) add({ type: "expense", amount: 550_000, date, walletId: bank, categoryId: category("주거·통신"), memo: "월세" });
    if (day === 3) add({ type: "expense", amount: between(60_000, 90_000, 10), date, walletId: bank, categoryId: category("주거·통신"), memo: "관리비" });
    if (day === 5) expenseOnCard(date, 65_000, "주거·통신", "휴대폰 요금");
    if (day === 10) expenseOnCard(date, 17_000, "구독", "넷플릭스");
    if (day === 17) expenseOnCard(date, 14_900, "구독", "유튜브 프리미엄");
    if (day === 20) add({ type: "transfer", amount: 100_000, date, walletId: bank, toWalletId: cash, memo: "ATM 출금" });
    if (day === daysInMonth(month)) {
      add({ type: "income", amount: between(1_000, 4_000, 10), date, walletId: bank, categoryId: category("금융수입"), memo: "예금 이자" });
    }
    // Card bill: pay last month's card spending on the 14th
    if (day === 14) {
      const prev = addMonths(month, -1);
      const bill = cardSpendByMonth.get(prev) ?? 380_000;
      add({ type: "transfer", amount: bill, date, walletId: bank, toWalletId: card, memo: "카드값" });
    }

    // Everyday spending
    if (!weekend && chance(0.75)) {
      expenseOnCard(date, between(4_000, 6_500), "카페·간식", pick(["스벅 라떼", "메가커피 아아", "컴포즈 라떼", "빽다방 아아"]));
    }
    if (!weekend) {
      expenseOnCard(date, between(8_000, 13_000, 500), "식비", pick(["점심 김밥", "점심 국밥", "점심 돈까스", "점심 샐러드", "점심 제육"]), chance(0.2) ? ["회사"] : []);
      expenseOnCard(date, 2_900, "교통", "지하철");
    }
    if (chance(weekend ? 0.45 : 0.18)) {
      expenseOnCard(date, between(18_000, 34_000, 500), "배달", pick(["배민 치킨", "배민 피자", "쿠팡이츠 마라탕", "요기요 떡볶이"]));
    }
    if (weekend && chance(0.5)) {
      expenseOnCard(date, between(35_000, 95_000, 1_000), "생활", pick(["이마트 장보기", "홈플러스", "코스트코"]));
    }
    if (weekend && chance(0.35)) {
      expenseOnCard(date, between(25_000, 70_000, 1_000), "식비", pick(["저녁 외식", "브런치", "고기"]), ["데이트"]);
    }
    if (chance(0.06)) expenseOnCard(date, between(19_000, 89_000, 1_000), "쇼핑", pick(["쿠팡 생필품", "무신사 티셔츠", "올리브영"]));
    if (chance(0.04)) expenseOnCard(date, between(12_000, 30_000, 1_000), "문화·여가", pick(["CGV 영화", "책", "전시"]));
    if (chance(0.03)) expenseOnCard(date, between(5_000, 25_000, 500), "건강", pick(["약국", "병원"]));
    if (chance(0.12)) {
      add({ type: "expense", amount: between(1_500, 8_000), date, walletId: cash, categoryId: category("생활"), memo: pick(["편의점", "GS25 음료", "CU 간식"]) });
    }
    if (chance(0.015)) add({ type: "income", amount: between(200_000, 600_000, 10_000), date, walletId: bank, categoryId: category("부수입"), memo: "외주 작업" });
    if (chance(0.01)) add({ type: "income", amount: between(10_000, 60_000, 1_000), date, walletId: bank, categoryId: category("기타 수입"), memo: "당근 판매" });
  }
  add({ type: "expense", amount: 100_000, date: addDays(today, -40), walletId: bank, categoryId: category("경조사·선물"), memo: "친구 결혼식 축의금" });

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(transactions).values(rows.slice(i, i + 500));
  }
  console.log(`Seeded ${rows.length} transactions for ${DEMO_USER.email} (${firstMonth} ~ ${today})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
