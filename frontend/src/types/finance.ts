export type PageKey = "dashboard" | "ledger" | "entry" | "stats" | "assets" | "auth" | "mypage";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: number;
  date: string;
  type: TransactionType;
  category: string;
  tags: string[];
  amount: number;
  method: string;
  memo: string;
};

export type AssetType = "CASH" | "BANK" | "STOCK" | "ETC";

export type Asset = {
  id: number;
  name: string;
  type: AssetType;
  amount: number;
  profit: number;
  memo: string;
};

export type UserSession = {
  id: number;
  email: string;
  name: string;
  ownerId: string;
  token: string;
};
