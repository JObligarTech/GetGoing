"use client";
import Link from "next/link";
import { useActionState } from "react";
import { MIN_AGE } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FormError } from "@/components/ui/Form";
import { requestReset, signIn, signUp, type ActionState } from "@/app/auth/actions";

const initial: ActionState = {};

export function LoginForm({ next, presetEmail }: { next?: string; presetEmail?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError>{state.error}</FormError>
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email ?? presetEmail} error={state.fieldErrors?.email} onDark />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} onDark />
      <Button type="submit" size="cta" full loading={pending} className="bg-[#7DBA8E] text-[#0F1A13] hover:bg-[#93CBA3]">Log in</Button>
      <p className="text-center text-[12px] text-[#98A39C]">
        <Link href="/reset" className="font-bold text-[#7DBA8E]">Forgot password?</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/signup" className="font-bold text-[#7DBA8E]">Create account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h2 className="text-[22px] font-extrabold">Check your email</h2>
        <p className="text-[14px] text-[#C9D3CC]">{state.message}</p>
        <Button href="/login" variant="translucent" size="cta" full>Back to log in</Button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError>{state.error}</FormError>
      <Field label="Your name" name="displayName" autoComplete="name" required maxLength={80} defaultValue={state.values?.displayName} error={state.fieldErrors?.displayName} onDark />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} onDark />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters with upper, lower case and a number." error={state.fieldErrors?.password} onDark />
      <Field label="Date of birth" name="dateOfBirth" type="date" autoComplete="bday" required defaultValue={state.values?.dateOfBirth} hint={`You must be ${MIN_AGE} or older. We check this once and don't store it.`} error={state.fieldErrors?.dateOfBirth} onDark />
      <Checkbox
        name="acceptTerms"
        required
        onDark
        error={state.fieldErrors?.acceptTerms}
        label={<>I agree to the <Link href="/legal/terms" className="font-bold text-[#7DBA8E]">Terms</Link> and <Link href="/legal/privacy" className="font-bold text-[#7DBA8E]">Privacy Policy</Link></>}
      />
      <Checkbox name="marketingOptIn" onDark label="Send me occasional trip tips and updates" description="Optional. Unsubscribe any time." />
      <Button type="submit" size="cta" full loading={pending} className="bg-[#7DBA8E] text-[#0F1A13] hover:bg-[#93CBA3]">Create account</Button>
      <p className="text-center text-[12px] text-[#98A39C]">
        Already have an account? <Link href="/login" className="font-bold text-[#7DBA8E]">Log in</Link>
      </p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(requestReset, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.ok ? (
        <p role="status" className="rounded-lg bg-white/10 px-3.5 py-3 text-[14px] text-[#C9D3CC]">{state.message}</p>
      ) : (
        <>
          <FormError>{state.error}</FormError>
          <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required error={state.fieldErrors?.email} onDark />
          <Button type="submit" size="cta" full loading={pending} className="bg-[#7DBA8E] text-[#0F1A13] hover:bg-[#93CBA3]">Send reset link</Button>
        </>
      )}
      <p className="text-center text-[12px] text-[#98A39C]"><Link href="/login" className="font-bold text-[#7DBA8E]">Back to log in</Link></p>
    </form>
  );
}
