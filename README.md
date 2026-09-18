# Voya — Your whole trip. One place.

Voya is a travel companion where **the trip is the context for everything**: the hotel, the saved places, the travelers, the currency and the language flow into every tool instead of being typed again.

This repo implements the [Claude Design](https://claude.ai/design) handoff (green system, Manrope) as:

| Package | What it is |
|---|---|
| `apps/web` | Next.js 16 / React 19 web app — phone, tablet and desktop layouts from the iPhone, iPad and Desktop mockups |
| `apps/mobile` | Expo SDK 57 app (expo-router) — iPhone and Android mockups, runs in Expo Go |
| `packages/core` | Domain types, zod validation, trip-context selectors, formatters, provider interfaces (maps / translation / FX / OCR) with mock adapters, demo dataset |
| `packages/tokens` | Design tokens (light + dark) with WCAG-AA contrast tests; generates the CSS variables and the native theme |
| `supabase` | Postgres schema, row-level security, account deletion / data export RPCs, seed, RLS tests |

## Status — build round 1 (foundation + core flows)

Done and verified: design tokens · Supabase schema + RLS · auth (welcome, log in, create account with 16+ gate and unticked marketing consent, welcome back, reset) · Home (live map, countdown, local/home clocks, stay card, today's places, trip switcher) · Trips (list, overview, create) · Plan (day timeline, open-slot suggestions, map view) · saved place / stay details ("Take me back to my hotel", address in 日本語) · profile (theme, legal, data export, account deletion).

Scheduled for the next rounds (routes exist as honest placeholders): Navigate, Translate, Currency, Split, People, Atlas Premium Pass checkout, offline states.

## Run it

```bash
pnpm install

# Web — demo mode, no backend needed (deterministic "Japan 2027" data, sign in as joe@example.com / VoyaDemo-2027!)
pnpm dev:web            # http://localhost:3000

# Mobile — Expo Go on iPhone or Android, same demo mode
pnpm dev:mobile         # scan the QR code with Expo Go
```

### Connect Supabase

1. Create a project at supabase.com, then: `supabase link --project-ref <ref> && supabase db push` (applies `supabase/migrations`).
2. Copy `.env.example` → `apps/web/.env.local` and `apps/mobile/.env`, fill in the project URL and **anon** key. Remove `VOYA_DEMO=1`.
3. Optional: enable Apple/Google sign-in in `supabase/config.toml` / the dashboard, and set `GEOCODE_PROVIDER=nominatim`, `FX_PROVIDER=frankfurter` for live (keyless) data.

The service-role key is never used by either app; the web app refuses to start if it finds one in its environment. RLS is the security boundary.

## Verify

```bash
pnpm test                          # tokens contrast + core (40) + web components (axe) + mobile (RNTL)
pnpm --filter @voya/core test:db   # migrations + seed + RLS scenarios on a throwaway Postgres 16
pnpm test:e2e                      # Playwright: 96 tests across iPhone/Android/iPad/desktop × light/dark
pnpm typecheck && pnpm lint
```

The e2e suite runs against a production build in demo mode. Every screen is checked with axe (WCAG 2.2 AA), aria-tree snapshots (what a screen reader announces), keyboard-only navigation, reduced-motion, and security headers. In sandboxes with a pinned Chromium set `PW_CHROMIUM_PATH`.

## Design → code decisions worth knowing

- **Contrast:** the mockups' muted grey `#6B7570` measured 4.37:1 on the paper canvas; it's `#5F6964` here (4.5:1+). A dedicated `on-tint` colour keeps chips readable on tinted rows in dark mode. `packages/tokens` tests fail if a token drops below AA.
- **Maps:** OpenStreetMap tiles via MapLibre (web) and MapLibre-in-WebView (mobile) — no API keys, matches the mockups' `voya-map`. Maps are `role="img"` with a text list of pins for assistive tech.
- **Dates:** 2027-03-15 is a Monday; the mockup's "Sat, Mar 15" was illustrative.
- **Motion:** 3% press scale, 220 ms fades, 40 ms list stagger — all disabled under "Reduce motion".
- **Demo mode:** in-memory data isolated per browser session; refused on production deployments (`VERCEL_ENV`/`VOYA_ENV=production`).

## Layout

```
apps/web/src/app        routes: (auth)/* · (app)/{home,trips,plan,profile,…} · auth/actions.ts · legal/[doc]
apps/web/src/components ui primitives, shell (tab bar / rail / sidebar), map, per-feature components
apps/web/src/proxy.ts   CSP nonce, security headers, session refresh, route protection
apps/mobile/app         expo-router: (auth)/* · (tabs)/* · plan · place/[id] · trips/[id]
packages/core/src       domain.ts · schemas.ts · selectors.ts · format.ts · providers/* · db/*
supabase/migrations     0100 schema · 0200 RLS · 0300 account deletion & export
```

See `SECURITY.md` for the threat model and controls.
