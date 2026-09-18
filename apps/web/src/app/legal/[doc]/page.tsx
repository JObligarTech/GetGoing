import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Placeholder legal copy — replace with lawyer-reviewed text. Structure mirrors the Round 9 Legal hub. */
const DOCS: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  terms: {
    title: "Terms of Service",
    sections: [
      { h: "Your content", p: "Trips, places and notes you add are yours. We store them to run Voya and never sell them." },
      { h: "Partner services", p: "Maps use OpenStreetMap data. Translation, rates and receipts may use third-party providers listed in Licences & credits." },
      { h: "Split doesn't move money", p: "Split calculates who owes what. Payments happen outside Voya." },
      { h: "Passes and subscriptions", p: "Atlas Premium Pass: Single trip (up to 14 days) $2.99, Monthly $4.99, Yearly $49.99. Single-trip passes end automatically; subscriptions renew until cancelled." },
      { h: "Optional permissions", p: "Location, microphone and camera are only requested for the feature you're using and can be declined." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { h: "What we collect", p: "Your account email and name, the trips you create, and the settings you choose. Date of birth is checked at sign-up and not stored." },
      { h: "What we don't", p: "No advertising trackers, no selling of data, no analytics cookies without consent." },
      { h: "Your rights", p: "Download or delete everything from Profile → Download or delete my data. Deletion is immediate and permanent." },
    ],
  },
  refunds: {
    title: "Refund Policy",
    sections: [
      { h: "App Store / Google Play purchases", p: "Refunds are handled by the store where you bought the pass, under its rules." },
      { h: "Web purchases", p: "Email support within 14 days of purchase for a full refund of an unused pass." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      { h: "Essential only", p: "Voya on the web sets sign-in session cookies and a cookie remembering your active trip. Nothing else, and no third-party cookies." },
      { h: "Preferences", p: "Your theme choice is kept in your browser's local storage, not a cookie." },
    ],
  },
  licences: {
    title: "Licences & credits",
    sections: [
      { h: "Maps", p: "© OpenStreetMap contributors, ODbL." },
      { h: "Type", p: "Manrope by Mikhail Sharanda, SIL Open Font License." },
      { h: "Icons", p: "Lucide, ISC licence." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}
export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Legal" };
}

export default async function LegalDoc({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-10 md:px-7">
      <nav aria-label="Legal" className="flex flex-wrap gap-2 text-[12.5px] font-bold">
        {Object.entries(DOCS).map(([k, v]) => (
          <Link key={k} href={`/legal/${k}`} aria-current={k === doc ? "page" : undefined} className={k === doc ? "rounded-pill bg-tint px-3 py-1.5 text-primary" : "rounded-pill px-3 py-1.5 text-muted hover:bg-tint"}>{v.title}</Link>
        ))}
      </nav>
      <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">{d.title}</h1>
      <p className="text-[13px] text-muted">Placeholder wording — have a lawyer review before launch.</p>
      <div className="card divide-y divide-line">
        {d.sections.map((s) => (
          <section key={s.h} className="px-4 py-4">
            <h2 className="text-[15px] font-bold">{s.h}</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.p}</p>
          </section>
        ))}
      </div>
      <footer className="text-[12px] text-muted">
        Voya Labs (placeholder) · 123 Example Street, San Francisco, CA · <a href="mailto:hello@voya.app" className="font-bold text-primary">hello@voya.app</a>
      </footer>
    </main>
  );
}
