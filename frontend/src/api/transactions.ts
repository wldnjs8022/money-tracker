import { apiRequest } from "./client";
import type { Transaction, TransactionType } from "../types/finance";

export type TransactionPayload = {
  guestId: string;
  date: string;
  type: TransactionType;
  category: string;
  tags: string[];
  amount: number;
  method: string;
  memo: string;
};

export type Summary = {
  income: number;
  expense: number;
  balance: number;
};

export function getTransactions(guestId: string) {
  return apiRequest<Transaction[]>(`/transactions?guestId=${encodeURIComponent(guestId)}`);
}

export function getSummary(guestId: string) {
  return apiRequest<Summary>(`/transactions/summary?guestId=${encodeURIComponent(guestId)}`);
}

export function createTransaction(payload: TransactionPayload) {
  return apiRequest<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateTransaction(id: number, payload: TransactionPayload) {
  return apiRequest<Transaction>(`/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteTransaction(id: number, guestId: string) {
  return apiRequest<void>(`/transactions/${id}?guestId=${encodeURIComponent(guestId)}`, {
    method: "DELETE"
  });
}
