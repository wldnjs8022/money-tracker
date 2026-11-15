import { CommandPalette } from "@/components/app/command-palette";
import { ShortcutsHelp } from "@/components/app/shortcuts-help";
import { QuickEntryDialog } from "@/components/transactions/quick-entry-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form";
import { getEntryContext } from "@/server/queries";

/** Global dialogs. Loads wallets/categories once; refresh() after a mutation reloads them. */
export async function EntryLayer() {
  const ctx = await getEntryContext();
  return (
    <>
      <QuickEntryDialog ctx={ctx} />
      <TransactionFormDialog ctx={ctx} />
      <CommandPalette ctx={ctx} />
      <ShortcutsHelp />
    </>
  );
}
