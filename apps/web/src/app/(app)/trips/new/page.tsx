import type { Metadata } from "next";
import { Page } from "@/components/shell/Page";
import { NewTripForm } from "@/components/trips/NewTripForm";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "New trip" };

export default function NewTripPage() {
  return (
    <Page>
      <PageHeader eyebrow="Trips" title="New trip" />
      <NewTripForm />
    </Page>
  );
}
