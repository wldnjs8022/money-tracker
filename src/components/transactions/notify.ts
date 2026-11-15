"use client";

import { toast } from "sonner";
import { formatKRW } from "@/lib/money";
import type { DeletedTransaction } from "@/lib/review";
import { deleteTransaction, restoreTransaction, unconfirmTransaction } from "@/server/actions";

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

/** One toast for several new transactions; undo deletes them all. */
export function notifyCreatedMany(ids: string[], label: string) {
  toast.success(label, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        const results = await Promise.all(ids.map((id) => deleteTransaction(id)));
        const failed = results.filter((r) => !r.ok).length;
        if (failed === 0) toast(`${ids.length}건 기록을 취소했어요`);
        else toast.error(`${failed}건은 취소하지 못했어요`);
      },
    },
  });
}

/**
 * "삭제했어요" toast with an undo button that puts the record back exactly as it was.
 * `onRestored` runs after a successful undo, e.g. to select the record again.
 */
export function notifyDeleted(deleted: DeletedTransaction, onRestored?: (id: string) => void) {
  toast(`삭제했어요 · ${formatKRW(deleted.amount)}`, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        const result = await restoreTransaction(deleted);
        if (result.ok) {
          onRestored?.(result.data.id);
          toast.success("되돌렸어요");
        } else toast.error(result.error);
      },
    },
  });
}

/** "확인했어요" toast with an undo button that puts the record back in the review queue. */
export function notifyConfirmed(id: string, label = "확인했어요") {
  toast.success(label, {
    duration: UNDO_MS,
    action: {
      label: "되돌리기",
      onClick: async () => {
        const result = await unconfirmTransaction(id);
        if (result.ok) toast("확인을 취소했어요");
        else toast.error(result.error);
      },
    },
  });
}
