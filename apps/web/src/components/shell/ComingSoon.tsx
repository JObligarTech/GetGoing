import { Page } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { Chip, EmptyState, PageHeader } from "@/components/ui/primitives";

/** Honest placeholder for flows scheduled for later rounds (Navigate, Translate, Currency, Split). */
export function ComingSoon({ title, blurb, premium }: { title: string; blurb: string; premium?: boolean }) {
  return (
    <Page>
      <PageHeader eyebrow="Next round" title={title} action={premium ? <Chip tone="premium">Atlas Premium Pass</Chip> : undefined} />
      <EmptyState title={`${title} is coming in the next build round`} body={blurb} action={<Button href="/home" variant="secondary">Back to Home</Button>} />
    </Page>
  );
}
