"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hotkeyName, shouldIgnoreHotkey } from "@/lib/hotkeys";

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

export type EditableTransaction = TransactionDraft & { id: string };

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

const GO_TO: Record<string, string> = { d: "/", t: "/transactions", w: "/wallets", c: "/categories" };

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

  // Global shortcuts: ⌘K anywhere; N, ?, and "G then D/T/W/C" when not typing.
  const pendingG = useRef(0);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && hotkeyName(event) === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (shouldIgnoreHotkey(event)) return;
      const key = hotkeyName(event);

      if (Date.now() - pendingG.current < 1200 && GO_TO[key]) {
        event.preventDefault();
        pendingG.current = 0;
        router.push(GO_TO[key]);
        return;
      }
      if (key === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        setQuickEntryOpen(true);
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

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
