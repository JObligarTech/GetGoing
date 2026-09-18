# Voya — Your whole trip. One place.

Voya is a travel companion where **the trip is the context for everything**: the hotel, the saved places, the travelers, the currency and the language flow into every tool instead of being typed again.

This repo implements the [Claude Design](https://claude.ai/design) handoff (green system, Manrope) as:

| Package | What it is |
|---|---|
| `apps/web` | Next.js 16 / React 19 web app — phone, tablet and desktop layouts from the iPhone, iPad and Desktop mockups |
| `apps/mobile` | Expo SDK 57 app (expo-router) — iPhone and Android mockups, runs in Expo Go |
| `packages/core` | Domain types, zod validation, trip-context selectors, formatters, provider interfaces (maps / routing / translation / FX / OCR) with mock adapters, demo dataset |
| `packages/tokens` | Design tokens (light + dark) with WCAG-AA contrast tests; generates the CSS variables and the native theme |
| `supabase` | Postgres schema, row-level security, account deletion / data export RPCs, seed, RLS tests |

## Status — build round 3 (Navigation trees)

**Round 1 (foundation + core flows), done and verified:** design tokens · Supabase schema + RLS · auth (welcome, log in, create account with 16+ gate and unticked marketing consent, welcome back, reset) · Home (live map, countdown, local/home clocks, stay card, today's places, trip switcher) · Trips (list, overview, create) · Plan (day timeline, open-slot suggestions, map view) · saved place / stay details ("Take me back to my hotel", address in 日本語) · profile (theme, legal, data export, account deletion).

**Round 2 (Navigate), done and verified on web and mobile:**

- **Hub** — the contextual shortcuts from the brief ("Take me to my hotel", "Tonight's dinner", "Next planned"), "Navigate the day", and the trip's saved routes.
- **Directions** — hotel → place compared across walk / transit / drive / cycle (a keyboard-operable radiogroup), ETA and fare in the trip currency, step list, turn card over the map, route line drawn on the map, Share ETA (Web Share API → clipboard fallback), "Instead" shortcuts.
- **Day route** — hotel → the day's places → hotel with totals (time, on foot, fares), arrival/departure timeline that leaves in time for the first plan, reorder with move up/down buttons that announce the new position, walk/transit switch, save as a named route (`routes` / `route_stops` tables with RLS, cross-trip stops rejected by a trigger).
- **Routing provider** — `RoutingProvider` interface with a deterministic mock (works offline / in tests) and an OSRM adapter (`ROUTING_PROVIDER=osrm`, `OSRM_URL`; `EXPO_PUBLIC_OSRM_URL` on mobile). Transit stays on the mock until a transit provider is wired in, and is labelled "estimated".

**Round 3 (Navigation trees + Send my location), done and verified on web and mobile:**

- **Tree editor** (mockup 3b/3c) — a route that splits into groups and meets again: trunk stops everyone shares, one lane per group with its own stops, travelers and modes, a merge stop where everyone meets. Add / remove / reorder stops, branch after any shared stop, add another group, merge at a chosen place, assign travelers per branch (a traveler is on one branch of a split), pick the mode per segment with live durations, planned times and dwell. Every edit re-routes; nodes are toggle buttons with spoken arrival/departure, lanes are labelled regions, edits are announced, and the segment sheet is a dialog on phones and an inline panel on desktop (editor left, map right with one coloured line per lane).
- **Route comparison** — per group: door-to-meeting time, travel, walking, fares per person, transfers, arrival; an insight line ("Group B arrives 12 min earlier. Both make the 7:30 PM plan."); one-tap alternatives (walk instead of train, taxi) that edit the tree; "Start Group A" hands off to directions; share the comparison.
- **Storage** — `route_branches` / `route_branch_travelers` with RLS through trip membership, `route_stops.branch_id`, integrity triggers (branches can't cross routes, travelers can't cross trips), and a `save_route_tree` RPC that replaces a whole tree atomically as the caller (RLS still applies). Ids are minted by the app, never taken from the editor.
- **Send my location** — reads the device position once, builds an OpenStreetMap link and hands it to the OS share sheet (clipboard on desktop). Nothing is stored or sent to Voya's backend; permission denial is explained in place.

Scheduled for the next rounds (routes exist as honest placeholders): Translate, Currency, Split, People, Atlas Premium Pass checkout, offline states.

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
pnpm test                          # tokens contrast (15) + core (62) + web components (9, axe) + mobile (17, RNTL)
pnpm --filter @voya/core test:db   # migrations + seed + RLS scenarios (11) on a throwaway Postgres 16
pnpm test:e2e                      # Playwright: 150 tests across iPhone/Android/iPad/desktop × light/dark
pnpm typecheck && pnpm lint
```

The e2e suite runs against a production build in demo mode. Every screen is checked with axe (WCAG 2.2 AA), aria-tree snapshots (what a screen reader announces), keyboard-only navigation, reduced-motion, and security headers. In sandboxes with a pinned Chromium set `PW_CHROMIUM_PATH`.

## Design → code decisions worth knowing

- **Contrast:** the mockups' muted grey `#6B7570` measured 4.37:1 on the paper canvas; it's `#5F6964` here (4.5:1+). A dedicated `on-tint` colour keeps chips readable on tinted rows in dark mode. `packages/tokens` tests fail if a token drops below AA.
- **Maps:** OpenStreetMap tiles via MapLibre (web) and MapLibre-in-WebView (mobile) — no API keys, matches the mockups' `voya-map`. Maps are `role="img"` with a text list of pins for assistive tech.
- **Dates:** 2027-03-15 is a Monday; the mockup's "Sat, Mar 15" was illustrative.
- **Motion:** 3% press scale, 220 ms fades, 40 ms list stagger — all disabled under "Reduce motion".
- **Demo mode:** in-memory data isolated per browser session; refused on production deployments (`VERCEL_ENV`/`VOYA_ENV=production`).
- **Inserts mint their own ids:** creating a trip or route never uses `RETURNING` — the row's select policy depends on a membership the after-insert trigger creates, so reading it back in the same statement would be refused by RLS.

## Layout

```
apps/web/src/app        routes: (auth)/* · (app)/{home,trips,plan,navigate/{route,day,tree},profile,…} · auth/actions.ts · legal/[doc]
apps/web/src/components ui primitives, shell (tab bar / rail / sidebar), map, per-feature components
apps/web/src/proxy.ts   CSP nonce, security headers, session refresh, route protection
apps/mobile/app         expo-router: (auth)/* · (tabs)/* · plan · place/[id] · trips/[id] · navigate/{route,day,tree}
packages/core/src       domain.ts · schemas.ts · selectors.ts · navigate.ts · tree.ts · format.ts · providers/* · db/*
supabase/migrations     0100 schema · 0200 RLS · 0300 account deletion & export · 0400 routes · 0500 route trees
```

See `SECURITY.md` for the threat model and controls.
