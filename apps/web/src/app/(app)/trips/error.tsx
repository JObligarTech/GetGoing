"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Page } from "@/components/shell/Page";
import { PageHeader } from "@/components/ui/primitives";

/** Sync error (mockup 6b): nothing is lost, the device keeps working; try again or carry on offline. */
export default function TripsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Page>
      <PageHeader eyebrow="Trips" title="Couldn't sync your trips" />
      <section role="alert" className="card flex flex-col gap-3 p-5">
        <p className="text-[14px] text-muted">Your changes are saved on this device and will sync when the connection returns. Nothing is lost.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} size="cta">Try again</Button>
          <Button href="/home" variant="secondary" size="cta">Keep working offline</Button>
        </div>
      </section>
    </Page>
  );
}
