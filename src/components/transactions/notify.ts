"use client";

import { toast } from "sonner";
import { formatKRW } from "@/lib/money";
import { createTransaction, deleteTransaction, type TransactionInput } from "@/server/actions";

// Long enough to notice a mistake and reach for the undo button.
const UNDO_MS = 8000;

/** "기록했어요" toast with an undo button that deletes the new transaction. */
export function notifyCreated(id: string, label: string) {
  toast.success(label, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        const result = await deleteTransaction(id);
        if (result.ok) toast("기록을 취소했어요");
        else toast.error(result.error);
      },
    },
  });
}

/** "삭제했어요" toast with an undo button that re-creates the transaction. */
export function notifyDeleted(deleted: TransactionInput) {
  toast(`삭제했어요 · ${formatKRW(deleted.amount)}`, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        const result = await createTransaction(deleted);
        if (result.ok) toast.success("되돌렸어요");
        else toast.error(result.error);
      },
    },
  });
}
