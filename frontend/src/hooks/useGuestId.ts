import { useMemo } from "react";

const STORAGE_KEY = "financeManagerGuestId";

export function useGuestId() {
  return useMemo(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const guestId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, guestId);
    return guestId;
  }, []);
}
