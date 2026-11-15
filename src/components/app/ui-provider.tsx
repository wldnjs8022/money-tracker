"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { CHORD_ROUTES } from "@/components/app/nav";
import { authClient } from "@/lib/auth-client";
import {
  endChord,
  findPageSearch,
  hotkeyName,
  isChordPending,
  isKeyHandled,
  isOverlayOpen,
  shouldIgnoreHotkey,
  startChord,
} from "@/lib/hotkeys";

export type TransactionDraft = {
  type: "income" | "expense" | "transfer";
  amount: number | null;
  date: string;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  memo: string;
  tags: string[];
};

/** A record opened in the full form. The names let an archived wallet still show what it was. */
export type EditableTransaction = TransactionDraft & {
  id: string;
  walletName?: string | null;
  toWalletName?: string | null;
};

type FormState =
  | { open: false }
  | { open: true; mode: "create"; draft?: Partial<TransactionDraft> }
  | { open: true; mode: "edit"; transaction: EditableTransaction };

type UIContextValue = {
  quickEntryOpen: boolean;
  setQuickEntryOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  form: FormState;
  openNewTransaction: (draft?: Partial<TransactionDraft>) => void;
  openEditTransaction: (transaction: EditableTransaction) => void;
  closeForm: () => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const value = use(UIContext);
  if (!value) throw new Error("useUI must be used inside <UIProvider>");
  return value;
}

// A bare modifier keydown (e.g. Shift) is not a key press of its own and must not end a pending chord.
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

// Session check cadence: hourly while the tab stays open, and on coming back at most every 10 minutes.
// Better Auth only slides the session once per updateAge (a day), so most checks are a single lookup.
const SESSION_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const SESSION_CHECK_MIN_GAP_MS = 10 * 60 * 1000;

export function UIProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ open: false });

  const openNewTransaction = useCallback((draft?: Partial<TransactionDraft>) => {
    setQuickEntryOpen(false);
    setPaletteOpen(false);
    setForm({ open: true, mode: "create", draft });
  }, []);
  const openEditTransaction = useCallback((transaction: EditableTransaction) => {
    setForm({ open: true, mode: "edit", transaction });
  }, []);
  const closeForm = useCallback(() => setForm({ open: false }), []);

  // Global shortcuts. ⌘K anywhere (but never on top of another dialog); N, ?, / and "G then D/T/W/C"
  // only when nothing is focused for typing and no overlay is open. Page shortcuts (useHotkeys) run
  // first and preventDefault() what they handle, so a handled key is skipped here.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && hotkeyName(event) === "k") {
      event.preventDefault();
      if (paletteOpen) setPaletteOpen(false);
      else if (!isOverlayOpen()) setPaletteOpen(true);
      return;
    }
    if (isKeyHandled(event) || shouldIgnoreHotkey(event) || MODIFIER_KEYS.has(event.key)) return;
    const key = hotkeyName(event);

    if (isChordPending()) {
      // Whatever comes next ends the chord; only D/T/W/C navigate.
      endChord();
      const href = CHORD_ROUTES[key];
      if (href) {
        event.preventDefault();
        router.push(href);
      }
      return;
    }
    if (key === "g") {
      startChord();
      return;
    }
    if (key === "n") {
      event.preventDefault(); // keep the "n" out of the quick entry input that opens with focus
      setQuickEntryOpen(true);
      return;
    }
    if (event.key === "?") {
      event.preventDefault();
      setHelpOpen(true);
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      const pageSearch = findPageSearch();
      if (pageSearch) {
        pageSearch.focus();
        if (pageSearch instanceof HTMLInputElement) pageSearch.select();
      } else {
        setPaletteOpen(true);
      }
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Keeps the 30-day session sliding for a daily user. Server reads pass disableRefresh because they can't
  // write the cookie (see src/server/session.ts), so the browser asks the auth route instead: once the
  // session is a day old, GET /api/auth/get-session extends it in the DB and its response sets a fresh cookie.
  useEffect(() => {
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < SESSION_CHECK_MIN_GAP_MS) return;
      lastCheck = Date.now();
      authClient.getSession().catch(() => {}); // offline or server down: a later check tries again
    };
    check();
    const timer = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const value = useMemo(
    () => ({
      quickEntryOpen,
      setQuickEntryOpen,
      paletteOpen,
      setPaletteOpen,
      helpOpen,
      setHelpOpen,
      form,
      openNewTransaction,
      openEditTransaction,
      closeForm,
    }),
    [quickEntryOpen, paletteOpen, helpOpen, form, openNewTransaction, openEditTransaction, closeForm],
  );

  return <UIContext value={value}>{children}</UIContext>;
}
