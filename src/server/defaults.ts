import { db } from "@/db";
import { categories, wallets, type CategoryKind, type WalletKind } from "@/db/schema";

type DefaultCategory = {
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
};

export const DEFAULT_WALLETS: { name: string; kind: WalletKind; color: string }[] = [
  { name: "현금", kind: "cash", color: "#16a34a" },
  { name: "주거래 통장", kind: "bank", color: "#2563eb" },
  { name: "신용카드", kind: "card", color: "#e11d48" },
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // 지출
  { kind: "expense", name: "식비", icon: "🍚", color: "#f97316", keywords: ["밥", "점심", "저녁", "아침", "식사", "김밥", "라면", "국밥", "치킨", "피자", "햄버거", "버거", "고기", "회식", "분식", "떡볶이", "초밥", "식당"] },
  { kind: "expense", name: "카페·간식", icon: "☕", color: "#a16207", keywords: ["커피", "카페", "스벅", "스타벅스", "메가커피", "빽다방", "컴포즈", "투썸", "이디야", "라떼", "아아", "디저트", "빵", "케이크", "간식", "아이스크림"] },
  { kind: "expense", name: "배달", icon: "🛵", color: "#06b6d4", keywords: ["배달", "배민", "배달의민족", "쿠팡이츠", "요기요"] },
  { kind: "expense", name: "교통", icon: "🚇", color: "#3b82f6", keywords: ["지하철", "버스", "택시", "카카오T", "교통", "기차", "KTX", "SRT", "주유", "기름", "주차", "톨비", "따릉이"] },
  { kind: "expense", name: "생활", icon: "🧺", color: "#14b8a6", keywords: ["마트", "이마트", "홈플러스", "롯데마트", "코스트코", "편의점", "GS25", "CU", "세븐일레븐", "다이소", "생필품", "휴지", "세제"] },
  { kind: "expense", name: "쇼핑", icon: "🛍️", color: "#ec4899", keywords: ["쇼핑", "쿠팡", "옷", "신발", "무신사", "올리브영", "화장품", "29CM", "지그재그"] },
  { kind: "expense", name: "주거·통신", icon: "🏠", color: "#8b5cf6", keywords: ["월세", "관리비", "전기", "가스", "수도", "인터넷", "통신비", "휴대폰", "핸드폰"] },
  { kind: "expense", name: "구독", icon: "🔁", color: "#6366f1", keywords: ["구독", "넷플릭스", "유튜브", "유튜브프리미엄", "스포티파이", "멜론", "디즈니", "티빙", "웨이브", "쿠팡와우", "왓챠", "ChatGPT", "Claude"] },
  { kind: "expense", name: "문화·여가", icon: "🎬", color: "#eab308", keywords: ["영화", "CGV", "메가박스", "롯데시네마", "공연", "전시", "콘서트", "게임", "책", "노래방", "PC방", "여행", "숙소", "호텔"] },
  { kind: "expense", name: "건강", icon: "💊", color: "#ef4444", keywords: ["병원", "약국", "약", "헬스", "PT", "필라테스", "요가", "치과", "안과", "피부과"] },
  { kind: "expense", name: "교육", icon: "📚", color: "#0ea5e9", keywords: ["학원", "강의", "인강", "교재", "수강", "자격증", "시험"] },
  { kind: "expense", name: "경조사·선물", icon: "🎁", color: "#d946ef", keywords: ["선물", "축의금", "조의금", "부조", "생일", "기념일"] },
  { kind: "expense", name: "기타 지출", icon: "📦", color: "#94a3b8", keywords: [] },
  // 수입
  { kind: "income", name: "급여", icon: "💼", color: "#2563eb", keywords: ["월급", "급여", "상여", "보너스", "성과급", "인센티브"] },
  { kind: "income", name: "부수입", icon: "💰", color: "#16a34a", keywords: ["알바", "부업", "외주", "프리랜서", "강연료"] },
  { kind: "income", name: "용돈", icon: "🧧", color: "#f59e0b", keywords: ["용돈"] },
  { kind: "income", name: "금융수입", icon: "📈", color: "#0d9488", keywords: ["이자", "배당", "배당금", "캐시백", "환급"] },
  { kind: "income", name: "기타 수입", icon: "📦", color: "#94a3b8", keywords: ["중고", "당근", "판매", "환불"] },
];

export async function seedDefaultsForUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx.insert(wallets).values(DEFAULT_WALLETS.map((w, i) => ({ ...w, userId, sortOrder: i })));
    await tx.insert(categories).values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, userId, sortOrder: i })));
  });
}
