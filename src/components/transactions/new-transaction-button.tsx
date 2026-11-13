"use client";

import { PlusIcon } from "lucide-react";
import { useUI } from "@/components/app/ui-provider";
import { Button } from "@/components/ui/button";

export function NewTransactionButton() {
  const { openNewTransaction } = useUI();
  return (
    <Button onClick={() => openNewTransaction()}>
      <PlusIcon />새 거래
    </Button>
  );
}
