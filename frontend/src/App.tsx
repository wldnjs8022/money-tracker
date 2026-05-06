import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Calendar,
  ChartNoAxesColumn,
  ChevronDown,
  CreditCard,
  DatabaseZap,
  Edit3,
  Home,
  Landmark,
  Layers3,
  LineChart,
  LogIn,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Wallet,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { createAsset, deleteAsset, getAssets, updateAsset } from "./api/assets";
import { login, register } from "./api/auth";
import { createTransaction, deleteTransaction, getSummary, getTransactions, updateTransaction } from "./api/transactions";
import { balanceSeries, monthlySeries } from "./data";
import { useGuestId } from "./hooks/useGuestId";
import type { Asset, AssetType, PageKey, Transaction, TransactionType, UserSession } from "./types/finance";
import { krw, percent, signedKrw } from "./utils/format";

type Totals = {
  income: number;
  expense: number;
  balance: number;
  netWorth: number;
};

type EntryFormState = {
  date: string;
  category: string;
  tags: string;
  amount: string;
  method: string;
  memo: string;
};

type AssetFormState = {
  name: string;
  type: AssetType;
  amount: string;
  profit: string;
  memo: string;
};

type LedgerFilters = {
  startDate: string;
  endDate: string;
  type: "all" | TransactionType;
  category: string;
  tag: string;
  query: string;
  sort: "desc" | "asc";
  pageSize: number;
};

const SESSION_KEY = "financeManagerUser";

const navItems: Array<{ key: PageKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "대시보드", icon: <Home size={21} /> },
  { key: "ledger", label: "가계부", icon: <Calendar size={21} /> },
  { key: "stats", label: "통계", icon: <ChartNoAxesColumn size={21} /> },
  { key: "assets", label: "자산관리", icon: <Layers3 size={21} /> },
  { key: "entry", label: "내역 등록", icon: <Edit3 size={21} /> },
  { key: "auth", label: "로그인", icon: <LogIn size={21} /> },
  { key: "mypage", label: "마이페이지", icon: <User size={21} /> }
];

const categoryIcons: Record<string, string> = {
  급여: "💼",
  식비: "🍽",
  교통: "🚇",
  투자: "📈",
  생활: "🏠",
  카드값: "💳",
  용돈: "🎁",
  "문화/여가": "🎬",
  통신비: "📱",
  "기타 수입": "📦",
  기타: "📦"
};

const categoryColors = ["#3176f6", "#ff4d4f", "#f6b300", "#3fbe82", "#8b6df5", "#39c2d7", "#ff8a2a", "#b7bdc8"];
const assetTypeLabels: Record<AssetType, string> = {
  CASH: "현금",
  BANK: "은행",
  STOCK: "주식",
  ETC: "기타"
};

function loadStoredUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function App() {
  const guestId = useGuestId();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [managedAssets, setManagedAssets] = useState<Asset[]>([]);
  const [apiTotals, setApiTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => loadStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const ownerId = currentUser?.ownerId ?? guestId;

  const refresh = async () => {
    try {
      setLoading(true);
      setError("");
      const [nextTransactions, nextSummary, nextAssets] = await Promise.all([
        getTransactions(ownerId),
        getSummary(ownerId),
        getAssets(ownerId)
      ]);
      setTransactions(nextTransactions);
      setApiTotals(nextSummary);
      setManagedAssets(nextAssets);
    } catch {
      setError("백엔드 또는 MySQL에 연결할 수 없습니다. Spring Boot 서버와 DB 실행 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [ownerId]);

  const totals: Totals = useMemo(() => {
    const netWorth = managedAssets.reduce((sum, asset) => sum + asset.amount, 0) + apiTotals.balance;
    return { ...apiTotals, netWorth };
  }, [apiTotals, managedAssets]);

  const expenseCategoryStats = useMemo(() => {
    const grouped = transactions
      .filter((item) => item.type === "expense")
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + item.amount;
        return acc;
      }, {});
    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index % categoryColors.length]
    }));
  }, [transactions]);

  const saveTransaction = async (type: TransactionType, form: EntryFormState) => {
    const payload = {
      guestId: ownerId,
      date: form.date,
      type,
      category: form.category,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      amount: Number(form.amount),
      method: form.method,
      memo: form.memo
    };
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload);
    } else {
      await createTransaction(payload);
    }
    setEditingTransaction(null);
    await refresh();
    setPage("ledger");
  };

  const removeTransaction = async (id: number) => {
    if (!window.confirm("이 내역을 삭제할까요?")) return;
    await deleteTransaction(id, ownerId);
    await refresh();
  };

  const saveAsset = async (form: AssetFormState) => {
    const payload = {
      guestId: ownerId,
      name: form.name,
      type: form.type,
      amount: Number(form.amount),
      profit: Number(form.profit || 0),
      memo: form.memo
    };
    if (editingAsset) {
      await updateAsset(editingAsset.id, payload);
    } else {
      await createAsset(payload);
    }
    setEditingAsset(null);
    await refresh();
  };

  const removeAsset = async (id: number) => {
    if (!window.confirm("이 자산을 삭제할까요?")) return;
    await deleteAsset(id, ownerId);
    await refresh();
  };

  const handleAuthSuccess = async (session: UserSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem("accessToken", session.token);
    setCurrentUser(session);
    setPage("mypage");
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("accessToken");
    setCurrentUser(null);
    setPage("dashboard");
    await refresh();
  };

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandIcon"><Layers3 size={25} /></span>
          <strong>자산 가계부</strong>
        </div>
        <nav className="navList">
          {navItems.map((item) => (
            <button className={page === item.key ? "navItem active" : "navItem"} key={item.key} onClick={() => setPage(item.key)}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <section className="guestBox">
          <ShieldCheck size={34} />
          <h3>{currentUser ? "로그인 모드" : "게스트 모드"}</h3>
          <p>{currentUser ? `${currentUser.email} 계정으로 데이터가 저장됩니다.` : "UUID 기준으로 MySQL에 데이터가 저장됩니다."}</p>
          <button onClick={() => setPage(currentUser ? "mypage" : "auth")}>자세히 보기</button>
        </section>
      </aside>
      <main className="workspace">
        <Topbar currentUser={currentUser} setPage={setPage} onLogout={logout} />
        {error && <div className="errorBanner">{error}</div>}
        {page === "dashboard" && <Dashboard totals={totals} transactions={transactions} assets={managedAssets} categoryStats={expenseCategoryStats} setPage={setPage} loading={loading} />}
        {page === "ledger" && <Ledger totals={totals} transactions={transactions} setPage={setPage} onDelete={removeTransaction} onEdit={(transaction) => { setEditingTransaction(transaction); setPage("entry"); }} loading={loading} />}
        {page === "entry" && <Entry initial={editingTransaction} onCancel={() => setEditingTransaction(null)} onSave={saveTransaction} />}
        {page === "stats" && <Stats transactions={transactions} totals={totals} categoryStats={expenseCategoryStats} />}
        {page === "assets" && <Assets assets={managedAssets} totals={totals} editingAsset={editingAsset} onEdit={setEditingAsset} onDelete={removeAsset} onSave={saveAsset} />}
        {page === "auth" && <Auth guestId={guestId} currentUser={currentUser} onSuccess={handleAuthSuccess} />}
        {page === "mypage" && <Mypage guestId={guestId} ownerId={ownerId} currentUser={currentUser} transactions={transactions} assets={managedAssets} onLogout={logout} setPage={setPage} />}
      </main>
    </div>
  );
}

function Topbar({ currentUser, setPage, onLogout }: { currentUser: UserSession | null; setPage: (page: PageKey) => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <span className="modeBadge">{currentUser ? "로그인 모드" : "게스트 모드"}</span>
      <div className="userTools">
        <div className="profileMenu">
          <button className="profile" onClick={() => setOpen((value) => !value)}><User size={24} />{currentUser?.name ?? "게스트"} <ChevronDown size={16} /></button>
          {open && (
            <div className="profileDropdown">
              <button onClick={() => { setPage("mypage"); setOpen(false); }}>마이페이지</button>
              {currentUser ? (
                <button onClick={() => { onLogout(); setOpen(false); }}>로그아웃</button>
              ) : (
                <button onClick={() => { setPage("auth"); setOpen(false); }}>로그인</button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SummaryCard({ title, value, trend, tone, icon }: { title: string; value: string; trend: string; tone: string; icon: React.ReactNode }) {
  return (
    <article className={`summaryCard ${tone}`}>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <small>이번 달 <b>{trend}</b></small>
      </div>
      <span>{icon}</span>
    </article>
  );
}

function Dashboard({ totals, transactions, assets, categoryStats, setPage, loading }: { totals: Totals; transactions: Transaction[]; assets: Asset[]; categoryStats: Array<{ name: string; value: number; color: string }>; setPage: (page: PageKey) => void; loading: boolean }) {
  return (
    <section className="page">
      <div className="summaryGrid four">
        <SummaryCard title="총 수입" value={krw(totals.income)} trend="+12.5%" tone="blue" icon={<Wallet size={52} />} />
        <SummaryCard title="총 지출" value={krw(totals.expense)} trend="+8.3%" tone="red" icon={<CreditCard size={52} />} />
        <SummaryCard title="잔액" value={krw(totals.balance)} trend="+21.7%" tone="green" icon={<WalletCards size={52} />} />
        <SummaryCard title="전체 순자산" value={krw(totals.netWorth)} trend="+5.1%" tone="purple" icon={<DatabaseZap size={52} />} />
      </div>
      <div className="dashboardGrid">
        <Panel title="최근 거래 내역" action="전체 보기" onAction={() => setPage("ledger")} className="wide">
          {loading ? <EmptyState text="거래 내역을 불러오는 중입니다." /> : <TransactionTable transactions={transactions.slice(0, 7)} compact />}
        </Panel>
        <Panel title="자산 현황" action="전체 자산 보기" onAction={() => setPage("assets")}>
          <AssetSnapshot assets={assets} />
        </Panel>
      </div>
      <Panel title="통계">
        <div className="chartGrid">
          <MiniBar />
          <Donut categoryStats={categoryStats} totalExpense={totals.expense} />
          <BalanceChart />
        </div>
      </Panel>
    </section>
  );
}

function Ledger({ totals, transactions, setPage, onDelete, onEdit, loading }: { totals: Totals; transactions: Transaction[]; setPage: (page: PageKey) => void; onDelete: (id: number) => void; onEdit: (transaction: Transaction) => void; loading: boolean }) {
  const [filters, setFilters] = useState<LedgerFilters>({ startDate: "", endDate: "", type: "all", category: "all", tag: "all", query: "", sort: "desc", pageSize: 10 });
  const [currentPage, setCurrentPage] = useState(1);
  const categories = useMemo(() => Array.from(new Set(transactions.map((item) => item.category))).sort(), [transactions]);
  const tags = useMemo(() => Array.from(new Set(transactions.flatMap((item) => item.tags))).sort(), [transactions]);
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((item) => !filters.startDate || item.date >= filters.startDate)
      .filter((item) => !filters.endDate || item.date <= filters.endDate)
      .filter((item) => filters.type === "all" || item.type === filters.type)
      .filter((item) => filters.category === "all" || item.category === filters.category)
      .filter((item) => filters.tag === "all" || item.tags.includes(filters.tag))
      .filter((item) => {
        const query = filters.query.trim().toLowerCase();
        if (!query) return true;
        return [item.date, item.category, item.method, item.memo, item.type, ...item.tags].join(" ").toLowerCase().includes(query);
      })
      .sort((a, b) => filters.sort === "desc" ? b.date.localeCompare(a.date) || b.id - a.id : a.date.localeCompare(b.date) || a.id - b.id);
  }, [transactions, filters]);
  const totalPages = Math.max(Math.ceil(filteredTransactions.length / filters.pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const visibleTransactions = useMemo(() => {
    const start = (safePage - 1) * filters.pageSize;
    return filteredTransactions.slice(start, start + filters.pageSize);
  }, [filteredTransactions, filters.pageSize, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.startDate, filters.endDate, filters.type, filters.category, filters.tag, filters.query, filters.sort, filters.pageSize]);

  return (
    <section className="page">
      <PageTitle title="가계부" subtitle="수입과 지출 내역을 MySQL에 저장하고 관리합니다.">
        <button className="primaryBtn" onClick={() => setPage("entry")}><Plus size={18} />지출/수입 추가</button>
      </PageTitle>
      <div className="summaryGrid three">
        <SummaryCard title="총 수입" value={krw(totals.income)} trend="+12.5%" tone="blue" icon={<Wallet size={52} />} />
        <SummaryCard title="총 지출" value={krw(totals.expense)} trend="+8.3%" tone="red" icon={<CreditCard size={52} />} />
        <SummaryCard title="잔액" value={krw(totals.balance)} trend="+15.8%" tone="green" icon={<WalletCards size={52} />} />
      </div>
      <Filters filters={filters} categories={categories} tags={tags} onChange={setFilters} />
      <Panel title="">
        {loading ? <EmptyState text="거래 내역을 불러오는 중입니다." /> : <TransactionTable transactions={visibleTransactions} onDelete={onDelete} onEdit={onEdit} />}
      </Panel>
      <div className="pagination">
        <span>총 {filteredTransactions.length}건 중 {visibleTransactions.length}건 표시</span>
        <button disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button key={page} className={safePage === page ? "active" : ""} onClick={() => setCurrentPage(page)}>{page}</button>
        ))}
        <button disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}>›</button>
        <select value={filters.pageSize} onChange={(e) => setFilters({ ...filters, pageSize: Number(e.target.value) })}><option value={5}>5개씩 보기</option><option value={10}>10개씩 보기</option><option value={20}>20개씩 보기</option><option value={50}>50개씩 보기</option></select>
      </div>
    </section>
  );
}

function Entry({ initial, onCancel, onSave }: { initial: Transaction | null; onCancel: () => void; onSave: (type: TransactionType, form: EntryFormState) => Promise<void> }) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "income");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EntryFormState>({
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    category: initial?.category ?? "급여",
    tags: initial?.tags.join(", ") ?? "",
    amount: initial?.amount ? String(initial.amount) : "",
    method: initial?.method ?? "입금",
    memo: initial?.memo ?? ""
  });
  const categories = type === "income" ? ["급여", "투자", "용돈", "기타 수입"] : ["식비", "교통", "생활", "카드값", "문화/여가", "통신비", "기타"];

  useEffect(() => {
    if (!categories.includes(form.category)) {
      setForm((prev) => ({ ...prev, category: categories[0], method: type === "income" ? "입금" : "카드" }));
    }
  }, [type]);

  const change = (key: keyof EntryFormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const addAmount = (amount: number) => change("amount", String((Number(form.amount) || 0) + amount));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      alert("금액을 입력하세요.");
      return;
    }
    try {
      setSaving(true);
      await onSave(type, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <PageTitle title={initial ? "내역 수정" : "내역 등록"} subtitle="저장하면 Spring Boot API를 통해 MySQL에 반영됩니다." />
      <div className="entryGrid">
        <Panel title="">
          <div className="segmented full">
            <button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>수입</button>
            <button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>지출</button>
          </div>
          <form className="entryForm" onSubmit={submit}>
            <label>날짜 <b>*</b><input type="date" value={form.date} onChange={(e) => change("date", e.target.value)} /></label>
            <label>카테고리 <b>*</b><select value={form.category} onChange={(e) => change("category", e.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>태그<input value={form.tags} onChange={(e) => change("tags", e.target.value)} placeholder="예: 외식, 가족" /></label>
            <label>금액 <b>*</b><div className="moneyInput"><span>₩</span><input value={form.amount} onChange={(e) => change("amount", e.target.value.replace(/\D/g, ""))} placeholder="금액을 입력하세요" /><button type="button" onClick={() => addAmount(100000)}>+10만</button><button type="button" onClick={() => addAmount(500000)}>+50만</button><button type="button" onClick={() => addAmount(1000000)}>+100만</button></div></label>
            <label>결제 수단<input value={form.method} onChange={(e) => change("method", e.target.value)} placeholder="입금, 카드, 자동이체" /></label>
            <label>메모<textarea value={form.memo} onChange={(e) => change("memo", e.target.value)} placeholder="메모를 입력하세요 (선택)" maxLength={200} /></label>
            <label>반복 여부<select><option>반복 안 함</option><option>매월 반복</option></select></label>
            <footer><button type="button" className="ghostBtn" onClick={onCancel}>취소</button><button className="primaryBtn" disabled={saving}>{saving ? "저장 중..." : "저장하기"}</button></footer>
          </form>
        </Panel>
        <aside className="sideStack">
          <Panel title="빠른 태그">
            <div className="quickTags">{["급여", "식비", "교통", "생활", "카드값", "투자"].map((tag) => <button key={tag} onClick={() => change("tags", form.tags ? `${form.tags}, ${tag}` : tag)}>{tag}</button>)}</div>
          </Panel>
          <Panel title="내역 저장 미리보기" className="previewPanel">
            <div className="previewCard">
              <div><strong>{form.category}</strong><span className={type}>{type === "income" ? "수입" : "지출"}</span></div>
              <p>{form.date} <b>{krw(Number(form.amount) || 0)}</b></p>
              <small>{form.method || "결제 수단"} · {form.memo || "메모가 입력되면 여기에 표시됩니다."}</small>
            </div>
            <p className="safeNote">저장한 내역은 가계부 화면에서 수정하거나 삭제할 수 있습니다.</p>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function Stats({ transactions, totals, categoryStats }: { transactions: Transaction[]; totals: Totals; categoryStats: Array<{ name: string; value: number; color: string }> }) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "custom">("month");
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today.slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(today);

  const filteredTransactions = useMemo(() => {
    if (period !== "custom") return transactions;
    return transactions.filter((item) => item.date >= startDate && item.date <= endDate);
  }, [transactions, period, startDate, endDate]);

  const periodRows = useMemo(() => {
    const grouped = filteredTransactions.reduce<Record<string, { label: string; income: number; expense: number; balance: number }>>((acc, item) => {
      const date = new Date(`${item.date}T00:00:00`);
      const key = getPeriodKey(item.date, date, period);
      if (!acc[key]) acc[key] = { label: key, income: 0, expense: 0, balance: 0 };
      if (item.type === "income") acc[key].income += item.amount;
      if (item.type === "expense") acc[key].expense += item.amount;
      acc[key].balance = acc[key].income - acc[key].expense;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredTransactions, period]);

  const scopedTotals = filteredTransactions.reduce(
    (acc, item) => {
      if (item.type === "income") acc.income += item.amount;
      if (item.type === "expense") acc.expense += item.amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, balance: 0 }
  );

  return (
    <section className="page">
      <PageTitle title="통계" subtitle="">
        <div className="segmented">
          <button className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>일</button>
          <button className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>주</button>
          <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>월</button>
          <button className={period === "year" ? "active" : ""} onClick={() => setPeriod("year")}>연</button>
          <button className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>사용자 정의</button>
        </div>
        {period === "custom" && <div className="dateRange"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>}
        <button className="ghostBtn"><Calendar size={17} />{periodLabel(period)}</button>
      </PageTitle>
      <div className="summaryGrid four">
        <SummaryCard title="총 수입" value={krw(scopedTotals.income || totals.income)} trend="+12.5%" tone="blue" icon={<Wallet size={52} />} />
        <SummaryCard title="총 지출" value={krw(scopedTotals.expense || totals.expense)} trend="+8.3%" tone="red" icon={<CreditCard size={52} />} />
        <SummaryCard title="평균 지출" value={krw(Math.round((scopedTotals.expense || totals.expense) / Math.max(periodRows.length, 1)))} trend="+6.7%" tone="purple" icon={<LineChart size={52} />} />
        <SummaryCard title="저축률" value={(scopedTotals.income || totals.income) ? `${Math.round(((scopedTotals.balance || totals.balance) / (scopedTotals.income || totals.income)) * 100)}%` : "0%"} trend="+3.6%p" tone="green" icon={<ShieldCheck size={52} />} />
      </div>
      <div className="statsGrid">
        <Panel title={`${periodLabel(period)} 수입 · 지출 비교`}><PeriodBar rows={periodRows} /></Panel>
        <Panel title="카테고리별 지출 비율"><Donut categoryStats={categoryStats} totalExpense={totals.expense} detailed /></Panel>
        <Panel title="태그 분석 (지출)"><TagBars /></Panel>
        <Panel title="잔액 추이"><PeriodBalance rows={periodRows} /></Panel>
      </div>
    </section>
  );
}

function Assets({ assets, totals, editingAsset, onEdit, onDelete, onSave }: { assets: Asset[]; totals: Totals; editingAsset: Asset | null; onEdit: (asset: Asset | null) => void; onDelete: (id: number) => void; onSave: (form: AssetFormState) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssetFormState>({ name: "", type: "CASH", amount: "", profit: "", memo: "" });

  useEffect(() => {
    if (editingAsset) {
      setForm({
        name: editingAsset.name,
        type: editingAsset.type,
        amount: String(editingAsset.amount),
        profit: String(editingAsset.profit ?? 0),
        memo: editingAsset.memo
      });
    }
  }, [editingAsset]);

  const byType = (type: AssetType) => assets.filter((asset) => asset.type === type).reduce((sum, asset) => sum + asset.amount, 0);
  const change = (key: keyof AssetFormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const reset = () => {
    onEdit(null);
    setForm({ name: "", type: "CASH", amount: "", profit: "", memo: "" });
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.amount || Number(form.amount) < 0) {
      alert("자산명과 보유금액을 입력하세요.");
      return;
    }
    try {
      setSaving(true);
      await onSave(form);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <PageTitle title="자산관리" subtitle="자산 등록, 수정, 삭제가 MySQL에 바로 반영됩니다.">
      </PageTitle>
      <div className="assetLayout">
        <div>
          <div className="summaryGrid four">
            <SummaryCard title="총 자산" value={krw(totals.netWorth)} trend="+5.21%" tone="blue" icon={<Wallet size={52} />} />
            <SummaryCard title="금융 자산" value={krw(byType("BANK"))} trend="+4.12%" tone="blue" icon={<Landmark size={52} />} />
            <SummaryCard title="투자 자산" value={krw(byType("STOCK"))} trend="+6.78%" tone="green" icon={<LineChart size={52} />} />
            <SummaryCard title="기타 자산" value={krw(byType("ETC"))} trend="+1.02%" tone="purple" icon={<DatabaseZap size={52} />} />
          </div>
          <Panel title="보유 자산 목록">
            <AssetTable assets={assets} onEdit={onEdit} onDelete={onDelete} />
          </Panel>
        </div>
        <aside className="sideStack">
          <Panel title={editingAsset ? "자산 수정" : "빠른 자산 등록"}>
            <form className="compactForm" onSubmit={submit}>
              <input value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="예) 삼성전자 주식" />
              <select value={form.type} onChange={(e) => change("type", e.target.value as AssetType)}><option value="CASH">현금</option><option value="BANK">은행</option><option value="STOCK">주식</option><option value="ETC">기타</option></select>
              <input value={form.amount} onChange={(e) => change("amount", e.target.value.replace(/\D/g, ""))} placeholder="보유금액" />
              <input value={form.profit} onChange={(e) => change("profit", e.target.value.replace(/[^\d-]/g, ""))} placeholder="평가손익" aria-label="평가손익" />
              <textarea value={form.memo} onChange={(e) => change("memo", e.target.value)} placeholder="메모를 입력하세요" />
              <button className="primaryBtn" disabled={saving}>{saving ? "저장 중..." : editingAsset ? "수정하기" : "등록하기"}</button>
              {editingAsset && <button type="button" className="ghostBtn" onClick={reset}>수정 취소</button>}
            </form>
          </Panel>
          <Panel title="자산 요약"><AssetDonut assets={assets} /></Panel>
        </aside>
      </div>
    </section>
  );
}

function Auth({ guestId, currentUser, onSuccess }: { guestId: string; currentUser: UserSession | null; onSuccess: (session: UserSession) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      const payload = { email, password, name, guestId };
      const session = mode === "login" ? await login(payload) : await register(payload);
      onSuccess(session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인/회원가입에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (currentUser) {
    return (
      <section className="page">
        <PageTitle title="로그인 상태" subtitle="이미 계정으로 로그인되어 있습니다." />
        <Panel title="계정 정보">
          <div className="infoRows">
            <div><span>이메일</span><b>{currentUser.email}</b></div>
            <div><span>이름</span><b>{currentUser.name}</b></div>
            <div><span>Owner ID</span><b>{currentUser.ownerId}</b></div>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <section className="authPage">
      <div className="authHero">
        <span>게스트에서 회원으로, 데이터는 그대로</span>
        <h1>게스트 데이터 병합</h1>
        <p>회원가입할 때 현재 guestId로 저장된 가계부와 자산 데이터가 회원 계정으로 한 번만 이전됩니다.</p>
        {["UUID 기반 게스트 세션", "회원가입 시 기존 데이터 최초 병합", "로그인 시 계정 데이터만 불러오기"].map((item) => <div className="heroItem" key={item}><ShieldCheck />{item}</div>)}
      </div>
      <div className="authMain">
        <h2>로그인 / 회원가입</h2>
        <Panel title="">
          <div className="segmented full"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>로그인</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>회원가입</button></div>
          <form className="compactForm authForm" onSubmit={submit}>
            {mode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" />}
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 주소를 입력하세요" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호를 입력하세요" />
            <label className="check"><input type="checkbox" defaultChecked />로그인 상태 유지<a>비밀번호 찾기</a></label>
            {message && <div className="formMessage">{message}</div>}
            <button className="primaryBtn" disabled={saving}>{saving ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}</button>
            <p>{mode === "login" ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"} <b onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "회원가입" : "로그인"}</b></p>
          </form>
        </Panel>
      </div>
      <Panel title="" className="mergeCard">
        <div className="successMark">✓</div>
        <h3>데이터 병합 준비 완료</h3>
        <p>회원가입 성공 시에만 게스트 데이터를 회원 ownerId로 전환합니다.</p>
        {["가계부 내역", "자산 정보", "마이페이지 정보"].map((item) => <div className="mergeRow" key={item}>✓ {item}<b>연결됨</b></div>)}
      </Panel>
    </section>
  );
}

function Mypage({ guestId, ownerId, currentUser, transactions, assets, onLogout, setPage }: { guestId: string; ownerId: string; currentUser: UserSession | null; transactions: Transaction[]; assets: Asset[]; onLogout: () => void; setPage: (page: PageKey) => void }) {
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const assetTotal = assets.reduce((sum, asset) => sum + asset.amount, 0);
  const joinedLabel = currentUser ? "회원 계정" : "게스트 세션";

  return (
    <section className="page">
      <PageTitle title="마이페이지" subtitle="내 계정과 저장된 가계부 데이터를 간단히 확인합니다." />
      <div className="profileSummary">
        <div className="profileAvatar"><User size={36} /></div>
        <div>
          <h2>{currentUser?.name ?? "게스트 사용자"}</h2>
          <p>{currentUser?.email ?? "로그인하지 않은 임시 사용자"}</p>
        </div>
        <span className="modeBadge">{joinedLabel}</span>
      </div>
      <div className="mypageGrid simple">
        <InfoCard title="내 정보" icon={<User />} rows={[
          ["이름", currentUser?.name ?? "게스트"],
          ["이메일", currentUser?.email ?? "없음"],
          ["사용 상태", currentUser ? "로그인 중" : "게스트 사용 중"]
        ]} />
        <InfoCard title="가계부 요약" icon={<WalletCards />} rows={[
          ["등록 내역", `${transactions.length}건`],
          ["총 수입", krw(income)],
          ["총 지출", krw(expense)],
          ["잔액", krw(income - expense)]
        ]} />
        <InfoCard title="자산 요약" icon={<DatabaseZap />} rows={[
          ["등록 자산", `${assets.length}개`],
          ["총 자산", krw(assetTotal)],
          ["순자산", krw(assetTotal + income - expense)]
        ]} />
        <InfoCard title="데이터 보관" icon={<ShieldCheck />} rows={[
          ["저장 방식", currentUser ? "회원 계정 저장" : "게스트 ID 저장"],
          ["현재 ID", ownerId],
          ["초기 게스트 ID", guestId]
        ]} />
      </div>
      <Panel title="계정 관리">
        {currentUser ? <button className="dangerBtn" onClick={onLogout}>로그아웃</button> : <button className="primaryBtn" onClick={() => setPage("auth")}>로그인하여 데이터 영구 보존</button>}
      </Panel>
    </section>
  );
}

function PageTitle({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <header className="pageTitle">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      <div className="titleActions">{children}</div>
    </header>
  );
}

function Panel({ title, action, onAction, className = "", children }: { title: string; action?: string; onAction?: () => void; className?: string; children: React.ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <header><h2>{title}</h2>{action && <button onClick={onAction}>{action} ›</button>}</header>}
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function Filters({ filters, categories, tags, onChange }: { filters: LedgerFilters; categories: string[]; tags: string[]; onChange: (filters: LedgerFilters) => void }) {
  const change = (patch: Partial<LedgerFilters>) => onChange({ ...filters, ...patch });
  const clearDates = () => change({ startDate: "", endDate: "" });

  return (
    <div className="filters">
      <div className="filterField dateFilter">
        <span>기간</span>
        <input type="date" value={filters.startDate} onChange={(e) => change({ startDate: e.target.value })} />
        <input type="date" value={filters.endDate} onChange={(e) => change({ endDate: e.target.value })} />
        <button type="button" onClick={clearDates}>전체</button>
      </div>
      <label className="filterField"><span>구분</span><select value={filters.type} onChange={(e) => change({ type: e.target.value as LedgerFilters["type"] })}><option value="all">전체</option><option value="income">수입</option><option value="expense">지출</option></select></label>
      <label className="filterField"><span>카테고리</span><select value={filters.category} onChange={(e) => change({ category: e.target.value })}><option value="all">전체</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="filterField"><span>태그</span><select value={filters.tag} onChange={(e) => change({ tag: e.target.value })}><option value="all">전체</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <label className="filterField searchField"><Search size={17} /><input value={filters.query} onChange={(e) => change({ query: e.target.value })} placeholder="메모, 결제수단, 태그 검색" /></label>
      <label className="filterField"><span>정렬</span><select value={filters.sort} onChange={(e) => change({ sort: e.target.value as LedgerFilters["sort"] })}><option value="desc">최신순</option><option value="asc">오래된순</option></select></label>
    </div>
  );
}

function TransactionTable({ transactions, compact = false, onDelete, onEdit }: { transactions: Transaction[]; compact?: boolean; onDelete?: (id: number) => void; onEdit?: (transaction: Transaction) => void }) {
  if (transactions.length === 0) {
    return <EmptyState text="아직 저장된 내역이 없습니다. 내역 등록에서 수입 또는 지출을 추가하세요." />;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>날짜</th><th>구분</th><th>카테고리</th><th>태그</th><th>금액</th><th>결제수단</th><th>메모</th>{!compact && <th>관리</th>}</tr></thead>
        <tbody>
          {transactions.map((item) => (
            <tr key={item.id}>
              <td>{item.date}</td>
              <td><span className={`pill ${item.type}`}>{item.type === "income" ? "수입" : "지출"}</span></td>
              <td><span className="categoryIcon">{categoryIcons[item.category] ?? "📦"}</span>{item.category}</td>
              <td>{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</td>
              <td className={item.type === "income" ? "money plus" : "money minus"}>{signedKrw(item.type === "income" ? item.amount : -item.amount)}</td>
              <td>{item.method}</td>
              <td>{item.memo}</td>
              {!compact && <td className="actions"><button onClick={() => onEdit?.(item)}><Edit3 size={14} />수정</button><button onClick={() => onDelete?.(item.id)}><Trash2 size={14} />삭제</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetTable({ assets, onEdit, onDelete }: { assets: Asset[]; onEdit: (asset: Asset) => void; onDelete: (id: number) => void }) {
  if (assets.length === 0) {
    return <EmptyState text="아직 등록된 자산이 없습니다. 오른쪽 폼에서 자산을 추가하세요." />;
  }

  const total = assets.reduce((sum, asset) => sum + asset.amount, 0);
  const profit = assets.reduce((sum, asset) => sum + (asset.profit ?? 0), 0);
  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>자산명</th><th>유형</th><th>보유금액</th><th>평가손익</th><th>수익률</th><th>메모</th><th>관리</th></tr></thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              <td><span className="tag">{assetTypeLabels[asset.type]}</span></td>
              <td className="money">{krw(asset.amount)}</td>
              <td className={asset.profit >= 0 ? "money plus" : "money minus"}>{signedKrw(asset.profit ?? 0)}</td>
              <td className={asset.profit >= 0 ? "plus" : "minus"}>{asset.amount ? percent(((asset.profit ?? 0) / asset.amount) * 100) : "0%"}</td>
              <td>{asset.memo}</td>
              <td className="actions"><button onClick={() => onEdit(asset)}><Edit3 size={14} />수정</button><button onClick={() => onDelete(asset.id)}><Trash2 size={14} />삭제</button></td>
            </tr>
          ))}
          <tr className="totalRow"><td>합계</td><td /><td>{krw(total)}</td><td className={profit >= 0 ? "plus" : "minus"}>{signedKrw(profit)}</td><td className={profit >= 0 ? "plus" : "minus"}>{total ? percent((profit / total) * 100) : "0%"}</td><td /><td /></tr>
        </tbody>
      </table>
    </div>
  );
}

function AssetSnapshot({ assets }: { assets: Asset[] }) {
  const sum = (type: AssetType) => assets.filter((asset) => asset.type === type).reduce((total, asset) => total + asset.amount, 0);
  const groups = [["현금", krw(sum("CASH")), "💵"], ["은행 계좌", krw(sum("BANK")), "🏦"], ["주식", krw(sum("STOCK")), "📈"], ["기타 자산", krw(sum("ETC")), "🎁"]];
  return <div className="assetSnapshot">{groups.map(([name, amount, icon]) => <div key={name}><span>{icon}</span><strong>{name}</strong><b>{amount}</b></div>)}<footer><span>총 순자산</span><b>{krw(assets.reduce((total, asset) => total + asset.amount, 0))}</b></footer></div>;
}

function AssetDonut({ assets }: { assets: Asset[] }) {
  const total = assets.reduce((sum, asset) => sum + asset.amount, 0);
  const data = (["BANK", "STOCK", "CASH", "ETC"] as AssetType[]).map((type, index) => ({
    name: assetTypeLabels[type],
    value: assets.filter((asset) => asset.type === type).reduce((sum, asset) => sum + asset.amount, 0),
    color: categoryColors[index]
  })).filter((item) => item.value > 0);
  return <Donut categoryStats={data} totalExpense={total} />;
}

function MiniBar({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "chartBox large" : "chartBox"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlySeries}><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `${v / 10000}만`} /><Tooltip formatter={(v) => krw(Number(v))} /><Bar dataKey="income" fill="#1f6fff" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" fill="#ff4d55" radius={[5, 5, 0, 0]} /><Bar dataKey="saving" fill="#e8edf5" radius={[5, 5, 0, 0]} /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeriodBar({ rows }: { rows: Array<{ label: string; income: number; expense: number; balance: number }> }) {
  if (rows.length === 0) {
    return <EmptyState text="선택한 기간에 표시할 통계 데이터가 없습니다." />;
  }

  return (
    <div className="chartBox large">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => `${Number(v) / 10000}만`} />
          <Tooltip formatter={(v) => krw(Number(v))} />
          <Bar dataKey="income" fill="#1f6fff" radius={[5, 5, 0, 0]} />
          <Bar dataKey="expense" fill="#ff4d55" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeriodBalance({ rows }: { rows: Array<{ label: string; income: number; expense: number; balance: number }> }) {
  if (rows.length === 0) {
    return <EmptyState text="선택한 기간에 표시할 잔액 데이터가 없습니다." />;
  }

  return (
    <div className="chartBox large">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => `${Number(v) / 10000}만`} />
          <Tooltip formatter={(v) => krw(Number(v))} />
          <Area type="monotone" dataKey="balance" stroke="#1f6fff" fill="#dbe9ff" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function getPeriodKey(rawDate: string, date: Date, period: "day" | "week" | "month" | "year" | "custom") {
  if (period === "day" || period === "custom") return rawDate;
  if (period === "month") return rawDate.slice(0, 7);
  if (period === "year") return rawDate.slice(0, 4);

  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.ceil((dayOffset + firstDay.getDay() + 1) / 7);
  return `${date.getFullYear()}-${String(week).padStart(2, "0")}주`;
}

function periodLabel(period: "day" | "week" | "month" | "year" | "custom") {
  return {
    day: "일별",
    week: "주별",
    month: "월별",
    year: "연별",
    custom: "사용자 정의"
  }[period];
}

function Donut({ categoryStats, totalExpense, detailed = false }: { categoryStats: Array<{ name: string; value: number; color: string }>; totalExpense: number; detailed?: boolean }) {
  if (categoryStats.length === 0) {
    return <EmptyState text="데이터가 쌓이면 차트가 표시됩니다." />;
  }

  return (
    <div className={detailed ? "donut detailed" : "donut"}>
      <ResponsiveContainer width="48%" height={220}>
        <PieChart><Pie data={categoryStats} innerRadius={58} outerRadius={96} dataKey="value">{categoryStats.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(v) => krw(Number(v))} /></PieChart>
      </ResponsiveContainer>
      <div className="legendList">{categoryStats.slice(0, detailed ? 8 : 6).map((item) => <div key={item.name}><span style={{ background: item.color }} />{item.name}<b>{totalExpense ? ((item.value / totalExpense) * 100).toFixed(1) : "0"}%</b>{detailed && <em>{krw(item.value)}</em>}</div>)}</div>
    </div>
  );
}

function BalanceChart({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "chartBox large" : "chartBox"}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={balanceSeries}><XAxis dataKey="day" minTickGap={28} /><YAxis tickFormatter={(v) => `${v / 10000}만`} /><Tooltip formatter={(v) => krw(Number(v))} /><Area type="monotone" dataKey="balance" stroke="#1f6fff" fill="#dbe9ff" strokeWidth={3} /></AreaChart></ResponsiveContainer>
    </div>
  );
}

function TagBars() {
  return <div className="tagBars">{["카페", "외식", "배달", "영화", "마트", "편의점", "택시", "여행"].map((tag, index) => <div key={tag}><span>{tag}</span><meter value={30 - index * 3} min={0} max={30} /><b>{krw(432600 - index * 42700)}</b></div>)}</div>;
}

function InfoCard({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: string[][] }) {
  return <Panel title={title}><div className="infoIcon">{icon}</div><div className="infoRows">{rows.map(([key, value]) => <div key={key}><span>{key}</span><b>{value}</b></div>)}</div></Panel>;
}

export default App;
