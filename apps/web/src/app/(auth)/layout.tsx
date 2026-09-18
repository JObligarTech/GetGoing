import { Map } from "@/components/map/Map";

/**
 * Auth hero: dark world map with the trip pin on Tokyo, radial vignette, and the
 * content panel (bottom-anchored on phones, a 520px left column on desktop).
 * Colours are fixed dark regardless of theme, matching every device mockup.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#121614] text-[#F1F3EF]">
      <div className="absolute inset-0" aria-hidden="true">
        <Map center={{ lat: 30, lng: 110 }} zoom={1.6} dark static label="" pins={[{ id: "tokyo", lat: 35.68, lng: 139.7, color: "#7DBA8E" }]} />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(18,22,20,0),rgba(18,22,20,.92)_70%)] lg:bg-[radial-gradient(ellipse_at_65%_45%,rgba(18,22,20,0),rgba(18,22,20,.6)_55%,rgba(18,22,20,.95)_100%)]" aria-hidden="true" />
      <main id="main" tabIndex={-1} className="relative flex min-h-dvh flex-col justify-end px-6 pt-16 pb-[max(44px,env(safe-area-inset-bottom))] lg:w-[520px] lg:justify-center lg:bg-[linear-gradient(90deg,rgba(18,22,20,.97),rgba(18,22,20,.85))] lg:px-20 lg:py-16">
        {children}
      </main>
    </div>
  );
}
