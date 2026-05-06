import type { Asset, Transaction } from "./types/finance";

export const transactions: Transaction[] = [
  { id: 1, date: "2024-05-28", type: "income", category: "급여", tags: ["월급"], amount: 3000000, method: "입금", memo: "5월 급여" },
  { id: 2, date: "2024-05-24", type: "expense", category: "식비", tags: ["외식", "가족"], amount: 78000, method: "카드", memo: "점심 식사" },
  { id: 3, date: "2024-05-21", type: "expense", category: "교통", tags: ["교통비", "카드"], amount: 12800, method: "카드", memo: "지하철 교통비" },
  { id: 4, date: "2024-05-20", type: "income", category: "투자", tags: ["주식"], amount: 120000, method: "증권사 입금", memo: "배당금" },
  { id: 5, date: "2024-05-16", type: "expense", category: "생활", tags: ["쇼핑"], amount: 35000, method: "카드", memo: "생활용품 구매" },
  { id: 6, date: "2024-05-15", type: "expense", category: "카드값", tags: ["카드값"], amount: 450000, method: "자동이체", memo: "신용카드 결제" },
  { id: 7, date: "2024-05-12", type: "income", category: "용돈", tags: ["부모님"], amount: 200000, method: "입금", memo: "부모님 용돈" },
  { id: 8, date: "2024-05-08", type: "expense", category: "문화/여가", tags: ["영화"], amount: 15000, method: "카드", memo: "영화 관람" },
  { id: 9, date: "2024-05-05", type: "expense", category: "통신비", tags: ["고정비"], amount: 59900, method: "자동이체", memo: "휴대폰 요금" },
  { id: 10, date: "2024-05-01", type: "income", category: "기타 수입", tags: ["기타"], amount: 50000, method: "입금", memo: "중고책 판매" }
];

export const assets: Asset[] = [
  { id: 1, name: "현금", type: "CASH", amount: 1250000, profit: 0, memo: "비상금" },
  { id: 2, name: "은행 계좌 (입출금)", type: "BANK", amount: 12540000, profit: 0, memo: "주거래 통장" },
  { id: 3, name: "주식 (국내)", type: "STOCK", amount: 12300000, profit: 1230000, memo: "장기 투자" },
  { id: 4, name: "ETF (해외)", type: "STOCK", amount: 4860000, profit: 560000, memo: "S&P 500 추종" },
  { id: 5, name: "연금저축", type: "BANK", amount: 4250000, profit: 250000, memo: "세액공제 목적" },
  { id: 6, name: "기타 자산 (골드바)", type: "ETC", amount: 4700000, profit: 70000, memo: "실물 자산" }
];

export const monthlySeries = [
  { month: "12월", income: 5500000, expense: 4250000, saving: 1750000 },
  { month: "1월", income: 5700000, expense: 4250000, saving: 1900000 },
  { month: "2월", income: 5860000, expense: 4100000, saving: 1850000 },
  { month: "3월", income: 7100000, expense: 4600000, saving: 2200000 },
  { month: "4월", income: 7050000, expense: 4650000, saving: 2250000 },
  { month: "5월", income: 5860000, expense: 3245400, saving: 2614600 }
];

export const categoryStats = [
  { name: "식비", value: 694300, color: "#3176f6" },
  { name: "교통", value: 512800, color: "#ff4d4f" },
  { name: "주거", value: 428000, color: "#f6b300" },
  { name: "쇼핑", value: 378800, color: "#3fbe82" },
  { name: "문화/여가", value: 289600, color: "#8b6df5" },
  { name: "교육", value: 198400, color: "#39c2d7" },
  { name: "건강", value: 155700, color: "#ff8a2a" },
  { name: "기타", value: 587800, color: "#b7bdc8" }
];

export const balanceSeries = Array.from({ length: 31 }, (_, index) => ({
  day: `5/${index + 1}`,
  balance: [900, 1450, 1320, 1760, 2180, 2350, 2410, 1950, 1710, 1420, 1450, 1800, 2100, 2380, 2300, 2220, 2140, 2350, 2550, 2750, 2880, 3000, 2850, 3050, 3100, 3500, 3880, 3650, 3820, 3920, 4050][index] * 10000
}));
