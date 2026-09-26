import { Compass, Grid2X2, Home, MapPin, Landmark, Languages, ListChecks, Receipt, User } from "lucide-react";

export interface NavItem {
  href: "/home" | "/trips" | "/plan" | "/navigate" | "/tools" | "/translate" | "/currency" | "/split" | "/profile";
  label: string;
  Icon: typeof Home;
  premium?: boolean;
}

/** Phone: Home | Trip | Navigate | Tools | Profile (per the iPhone/Android mockups). */
export const PHONE_NAV: NavItem[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/trips", label: "Trip", Icon: MapPin },
  { href: "/navigate", label: "Navigate", Icon: Compass },
  { href: "/tools", label: "Tools", Icon: Grid2X2 },
  { href: "/profile", label: "Profile", Icon: User },
];

/** Desktop/iPad: Home, Trips, Plan, Navigate (Premium), Translate, Currency (Premium), Split (Premium), Profile. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/trips", label: "Trips", Icon: MapPin },
  { href: "/plan", label: "Plan", Icon: ListChecks },
  { href: "/navigate", label: "Navigate", Icon: Compass, premium: true },
  { href: "/translate", label: "Translate", Icon: Languages },
  { href: "/currency", label: "Currency", Icon: Landmark, premium: true },
  { href: "/split", label: "Split", Icon: Receipt, premium: true },
  { href: "/profile", label: "Profile", Icon: User },
];

/** On phones, Plan lives under the Trip tab and the tools under Tools; on desktop each has its own item. */
export function isActive(pathname: string, href: string, layout: "phone" | "desktop" = "desktop"): boolean {
  if (layout === "phone" && href === "/trips" && pathname.startsWith("/plan")) return true;
  if (layout === "phone" && href === "/tools" && ["/translate", "/currency", "/split"].some((p) => pathname.startsWith(p))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
