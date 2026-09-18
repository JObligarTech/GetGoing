import { Button } from "@/components/ui/Button";
import { signInWithProvider } from "@/app/auth/actions";

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-4.2zM13.9 4.8c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" />
    </svg>
  );
}
function GoogleIcon() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full" style={{ background: "conic-gradient(#EA4335 0 25%,#FBBC05 0 50%,#34A853 0 75%,#4285F4 0)" }} />;
}

/** Apple / Google / email — order and styling per the iPhone mockup. */
export function ProviderButtons({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <form action={signInWithProvider.bind(null, "apple")}>
        {next && <input type="hidden" name="next" value={next} />}
        <Button type="submit" variant="light" size="cta" full icon={<AppleIcon />}>Continue with Apple</Button>
      </form>
      <form action={signInWithProvider.bind(null, "google")}>
        {next && <input type="hidden" name="next" value={next} />}
        <Button type="submit" variant="translucent" size="cta" full icon={<GoogleIcon />}>Continue with Google</Button>
      </form>
      <Button href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} size="cta" full className="bg-[#7DBA8E] text-[#0F1A13] hover:bg-[#93CBA3]">
        Continue with email
      </Button>
    </div>
  );
}
