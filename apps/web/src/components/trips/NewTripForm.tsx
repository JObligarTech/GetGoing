"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Form";
import { createTrip } from "@/app/(app)/actions";
import type { ActionState } from "@/app/auth/actions";

export function NewTripForm() {
  const [state, action, pending] = useActionState(createTrip, {} as ActionState);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="card flex flex-col gap-4 p-4" noValidate>
      <FormError>{state.error}</FormError>
      <Field label="Trip name" name="name" required maxLength={120} placeholder="Japan 2027" defaultValue={v.name} error={e.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" name="startDate" type="date" defaultValue={v.startDate} error={e.startDate} />
        <Field label="End date" name="endDate" type="date" defaultValue={v.endDate} error={e.endDate} />
      </div>
      <Field label="Cities" name="cities" placeholder="Tokyo, Kyoto, Osaka" hint="Comma-separated, in order." defaultValue={v.cities} error={e.cities} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country code" name="countries" placeholder="JP" maxLength={2} hint="2-letter code" defaultValue={v.countries} error={e.countries} />
        <Field label="Local currency" name="localCurrency" placeholder="JPY" maxLength={3} hint="3-letter code" defaultValue={v.localCurrency} error={e.localCurrency} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time zone" name="localTz" placeholder="Asia/Tokyo" defaultValue={v.localTz} error={e.localTz} />
        <Field label="Language" name="localLanguage" placeholder="ja" maxLength={16} defaultValue={v.localLanguage} error={e.localLanguage} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="cta" full loading={pending}>Create trip</Button>
        <Button href="/trips" variant="secondary" size="cta">Cancel</Button>
      </div>
    </form>
  );
}
