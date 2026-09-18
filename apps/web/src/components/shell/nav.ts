import { Compass, Grid2X2, Home, MapPin, Landmark, ListChecks, User } from "lucide-react";

export interface NavItem {
  href: "/home" | "/trips" | "/plan" | "/navigate" | "/tools" | "/currency" | "/profile";
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

/** Desktop/iPad: Home, Trips, Plan, Navigate (Premium), Currency (Premium), Profile — Translate/Split stay phone-only. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/trips", label: "Trips", Icon: MapPin },
  { href: "/plan", label: "Plan", Icon: ListChecks },
  { href: "/navigate", label: "Navigate", Icon: Compass, premium: true },
  { href: "/currency", label: "Currency", Icon: Landmark, premium: true },
  { href: "/profile", label: "Profile", Icon: User },
];

/** On phones, Plan lives under the Trip tab; on desktop it has its own item. */
export function isActive(pathname: string, href: string, layout: "phone" | "desktop" = "desktop"): boolean {
  if (layout === "phone" && href === "/trips" && pathname.startsWith("/plan")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
