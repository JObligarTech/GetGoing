import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { DEMO_COOKIE, isDemo, publicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/welcome", "/login", "/signup", "/reset", "/welcome-back", "/auth", "/legal", "/api/health"];
const isPublic = (p: string) => p === "/" || PUBLIC_PATHS.some((x) => p === x || p.startsWith(`${x}/`));

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // MapLibre injects inline styles for markers/popups; unavoidable without patching.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    `connect-src 'self' ${supabase} ${supabaseWs} https://tile.openstreetmap.org https://*.tile.openstreetmap.org${dev ? " ws: wss:" : ""}`,
    "font-src 'self'",
    "worker-src 'self' blob:",
    "child-src blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.getRandomValues(new Uint8Array(16)).join(""));
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  let signedIn = false;
  if (isDemo) {
    signedIn = request.cookies.get(DEMO_COOKIE)?.value === "1";
  } else {
    const { supabase, getResponse } = createProxyClient(request, response);
    // Refreshes the session cookie if needed; getUser() validates the JWT server-side.
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
    response = getResponse();
  }

  const path = request.nextUrl.pathname;
  if (!signedIn && !isPublic(path)) {
    const url = new URL("/welcome", request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    response = NextResponse.redirect(url);
  } else if (signedIn && (path === "/" || path === "/welcome" || path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    response = NextResponse.redirect(url);
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Skip Next internals (static chunks, HMR websocket, image optimizer) and static files;
    // every page and API route gets CSP + auth handling.
    "/((?!_next/|favicon.ico|icons/|fonts/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
