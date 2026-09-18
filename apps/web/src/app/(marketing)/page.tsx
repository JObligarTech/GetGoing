import type { Metadata } from "next";
import { Accessibility, Compass, GitFork, Languages, Lock, Receipt, Sparkles, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ContextFlow } from "@/components/marketing/ContextFlow";
import { Gallery } from "@/components/marketing/Gallery";
import { Hero } from "@/components/marketing/Hero";
import { Marquee } from "@/components/marketing/Marquee";
import { NavigateScene } from "@/components/marketing/NavigateScene";
import { WindowFrame } from "@/components/marketing/PhoneFrame";
import { Reveal } from "@/components/marketing/Reveal";
import { ScrubText } from "@/components/marketing/ScrubText";
import { TreeScene } from "@/components/marketing/TreeScene";

export const metadata: Metadata = {
  title: "Voya — Your whole trip. One place.",
  description: "Voya is a travel companion where the trip is the context for everything: the hotel, the saved places, the travelers, the currency and the language flow into directions, group routes and the day's plan.",
  robots: { index: true, follow: true },
  openGraph: { title: "Voya — Your whole trip. One place.", description: "Save the hotel once. Voya carries it into directions, group routes, money and the day's plan.", type: "website", images: ["/marketing/tree-light.jpg"] },
};

function Section({ id, eyebrow, title, children, tone = "canvas", pinned }: { id: string; eyebrow: string; title: string; children: React.ReactNode; tone?: "canvas" | "surface"; pinned?: boolean }) {
  const heading = (
    <Reveal className={pinned ? "flex flex-col gap-3 lg:sticky lg:top-28" : "flex max-w-[60ch] flex-col gap-3"}>
      <p className="font-serif text-[20px] italic text-primary md:text-[22px]">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-[34px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance md:text-[48px]">{title}</h2>
    </Reveal>
  );
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tone === "surface" ? "bg-surface" : "bg-canvas"}>
      {pinned ? (
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:px-7 md:py-36 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>{heading}</div>
          <div>{children}</div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-24 md:px-7 md:py-36">
          {heading}
          {children}
        </div>
      )}
    </section>
  );
}

const ROADMAP = [
  { Icon: Languages, name: "Translate", body: "Text, live conversation and the camera. Already knows the trip's language." },
  { Icon: Wallet, name: "Currency", body: "Convert in the trip's currency by default; rates cached for the flight." },
  { Icon: Receipt, name: "Split", body: "Scan the receipt, tap who had what, settle in everyone's home currency." },
  { Icon: Users, name: "People", body: "Guests without accounts, groups that feed straight into tree routes." },
  { Icon: Sparkles, name: "Atlas Premium Pass", body: "Offline maps and live transit for the whole group, one pass per trip." },
];

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Marquee />

      <Section id="context" eyebrow="Set it once. It follows you everywhere." title="Voya remembers the trip, so you don't have to.">
        <Reveal delay={0.05}><ContextFlow /></Reveal>
        <Reveal className="grid gap-6 text-[15px] leading-relaxed text-muted md:grid-cols-3">
          <p><strong className="text-ink">The hotel</strong> is the default start of every route, the &ldquo;take me back&rdquo; on every screen, and the check-in time on the map.</p>
          <p><strong className="text-ink">The travelers</strong> become groups in tree routes, the recipients of your location, and the people a bill gets split between.</p>
          <p><strong className="text-ink">The currency and language</strong> shape every price you see and every address you show a taxi driver.</p>
        </Reveal>
      </Section>

      <Section id="navigate" eyebrow="Take me to my hotel. Three words, no typing." title="Directions that start from what Voya already knows." tone="surface">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal className="flex flex-col gap-5">
            <NavigateScene />
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-4 text-[16px] leading-relaxed">
            <ul className="flex flex-col gap-3">
              {[
                ["Contextual shortcuts", "Tonight's dinner, the next planned place, and your hotel are one tap away, because they are already on the trip."],
                ["Every mode, compared", "Walk, transit, drive and cycle side by side with fares in the local currency."],
                ["The whole day at once", "Hotel to every stop and back, with arrival times that leave in time for the first plan, and reordering that reads out where each stop went."],
                ["Share the ETA", "One line, ready for whichever app the group is on."],
              ].map(([h, p]) => (
                <li key={h} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tint text-primary"><Compass size={14} /></span>
                  <span><strong className="block text-[15px] font-bold">{h}</strong><span className="text-muted">{p}</span></span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <Section id="trees" eyebrow="Groups split. Voya keeps the plan together." title="Tree routes: branch, compare, meet again.">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal><TreeScene /></Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-5 text-[16px] leading-relaxed text-muted">
            <ScrubText text="Half the group wants the observation deck; the other half wants the Pokémon Center. Branch after any stop, put people on each side, pick how each group travels, and choose where everyone meets. Voya times both sides and waits for the slower one." />
            <ul className="flex flex-col gap-3">
              {[
                [GitFork, "Compare the branches", "Door-to-dinner time, walking, fares per person, transfers. “Group B arrives 12 min earlier. Both make the 7:30 reservation.”"],
                [Sparkles, "One-tap alternatives", "Walk instead of the train, or a taxi to the Sky, applied to the tree with a tap."],
                [Users, "Everyone on one page", "The tree is saved to the trip, so each group can start its own directions."],
              ].map(([Icon, h, p]) => {
                const I = Icon as typeof GitFork;
                return (
                  <li key={h as string} className="flex gap-3">
                    <span aria-hidden="true" className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tint text-primary"><I size={14} /></span>
                    <span><strong className="block text-[15px] font-bold text-ink">{h as string}</strong>{p as string}</span>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <WindowFrame shot="tree" alt="The tree route editor on desktop: the Shibuya afternoon tree on the left with Group A and Group B lanes, the selected segment's travelers and mode, and a map on the right with one coloured line per group." />
        </Reveal>
      </Section>

      <Section id="plan" eyebrow="Plan the day. Then walk it." title="From a list of saved places to a route you can follow." tone="surface" pinned>
        <Gallery />
      </Section>

      <section aria-labelledby="trust-title" className="bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-24 md:grid-cols-3 md:px-7 md:py-32">
          <Reveal className="md:col-span-3"><h2 id="trust-title" className="text-[24px] font-extrabold tracking-[-0.02em] md:text-[28px]">Built for everyone, tested that way.</h2></Reveal>
          {[
            [Accessibility, "Works with a screen reader", "Every screen has landmarks, labelled controls and spoken state. Maps carry a text list of their pins. Motion switches off with your system setting."],
            [Lock, "Your data stays yours", "Row-level security in the database is the boundary. Location sharing never touches our servers. Export or delete everything from your profile."],
            [Compass, "Open maps, no keys", "OpenStreetMap tiles and open routing. No analytics, no third-party scripts."],
          ].map(([Icon, h, p], i) => {
            const I = Icon as typeof Lock;
            return (
              <Reveal key={h as string} delay={i * 0.06} className="flex flex-col gap-2">
                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-tint text-primary"><I size={20} /></span>
                <h3 className="text-[16px] font-bold">{h as string}</h3>
                <p className="text-[14px] leading-relaxed text-muted">{p as string}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <Section id="roadmap" eyebrow="Next on the road." title="The rest of the trip is on its way." tone="surface">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ROADMAP.map((r, i) => (
            <li key={r.name} className="h-full">
              <Reveal delay={i * 0.05} className="card flex h-full flex-col gap-2 p-4">
                <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-premium-bg text-premium-text"><r.Icon size={18} /></span>
                <span className="text-[15px] font-bold">{r.name}</span>
                <span className="text-[13px] leading-relaxed text-muted">{r.body}</span>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="cta-title" className="bg-[#121614] text-[#F1F3EF]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-28 md:px-7 md:py-40">
          <Reveal className="flex flex-col gap-3">
            <h2 id="cta-title" className="text-[40px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance md:text-[72px]">Start your first trip.</h2>
            <p className="font-serif text-[20px] italic text-[#C9D3CC] md:text-[24px]">Add the hotel. Voya takes it from there.</p>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-wrap gap-3">
            <Button href="/signup" variant="light" size="cta">Create account</Button>
            <Button href="/login" variant="translucent" size="cta">Log in</Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
