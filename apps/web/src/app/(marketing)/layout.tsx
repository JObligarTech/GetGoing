import { Newsreader } from "next/font/google";
import { Footer } from "@/components/marketing/Footer";
import { MarketingNav } from "@/components/marketing/MarketingNav";

// The landing page's one editorial voice: Newsreader italic for the thesis line.
const newsreader = Newsreader({ subsets: ["latin"], style: ["italic"], weight: ["400", "500"], variable: "--font-newsreader", display: "swap" });

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${newsreader.variable} flex min-h-dvh flex-col bg-canvas text-ink`}>
      <MarketingNav />
      <main id="main" tabIndex={-1} className="w-full max-w-full flex-1 overflow-x-hidden">{children}</main>
      <Footer />
    </div>
  );
}
