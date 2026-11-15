"use client";

import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Signs out, then loads /login as a fresh document. A client navigation would bring back the login page
 * and the signed-in pages that Cache Components keeps mounted (hidden) with their state, amounts and memos
 * included; a full load drops all of it. `replace` keeps Back from returning to the signed-in page.
 */
export function useSignOut() {
  return useCallback(async () => {
    await authClient.signOut();
    window.location.replace("/login");
  }, []);
}
