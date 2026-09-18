import type { NextConfig } from "next";

// CSP is set per-request in proxy.ts (it needs a nonce). Static headers live here.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    // Geolocation/mic/camera are allowed for *this* origin only (Navigate, Translate, Split need them later).
    value: "geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@voya/core", "@voya/tokens"],
  typedRoutes: true,
  images: { remotePatterns: [] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
