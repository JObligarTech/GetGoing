import { Gift } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { redeemCodeAction } from "@/app/(app)/pass/actions";

/** "Been gifted access?" — paste the code from the gift link; the gift page does the accepting. */
export function RedeemForm({ error }: { error?: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-tint text-primary"><Gift size={20} /></span>
        <div><p className="text-[15px] font-semibold">Redeem a gift</p><p className="text-[12px] text-muted">Paste the code from the link a traveler sent you. No card needed; nothing renews.</p></div>
      </div>
      <form action={redeemCodeAction} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="gift-code" className="sr-only">Gift code</label>
        <input id="gift-code" name="code" required autoComplete="off" spellCheck={false} placeholder="24-character code" aria-invalid={error || undefined} aria-describedby={error ? "gift-code-err" : undefined} className="h-11 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 font-mono text-[14px] text-ink outline-none placeholder:text-faint focus:border-primary" />
        <Button type="submit" variant="secondary">Redeem</Button>
      </form>
      {error && <p id="gift-code-err" role="alert" className="text-[12.5px] font-semibold text-danger">That doesn&apos;t look like a gift code. It&apos;s the last part of the link, 24 letters and numbers.</p>}
    </Card>
  );
}
