"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/** "Restore purchase": asks the billing provider for this account's receipts and re-grants them. */
export function RestoreButton({ action, icon }: { action: () => Promise<{ restored: number } | { error: string }>; icon?: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("");
  return (
    <span className="flex items-center gap-2">
      <Button variant="ghost" size="sm" icon={icon} loading={pending} onClick={() => start(async () => {
        const r = await action();
        setStatus("error" in r ? r.error : r.restored ? `Restored ${r.restored} purchase${r.restored > 1 ? "s" : ""}.` : "Nothing to restore for this account.");
        if (!("error" in r) && r.restored) router.refresh();
      })}>Restore purchase</Button>
      <span role="status" className={status ? "text-[12px] font-semibold text-muted" : "sr-only"}>{status}</span>
    </span>
  );
}
