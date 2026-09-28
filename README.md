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

## Status — build round 6 (Atlas Premium Pass, Profile & Settings, offline)

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

**Landing page** — `/` is a public marketing page in the same design system: the welcome screen's world-map hero with a floating live screenshot, animated scenes built from the app's own components (trip context flowing into tools, a route drawing itself per mode, groups splitting and meeting again), real product screenshots in device frames with scroll parallax, a scroll-scrubbed paragraph, roadmap and CTA. Every animation has a still, readable resting state and switches off under "Reduce motion"; scenes carry text equivalents for screen readers. Signed-in users land on Home instead. Screenshots come from `apps/web/scripts/marketing-shots.mjs` (real OpenStreetMap tiles when reachable, a generated basemap otherwise).

**Round 4 (Translate + Currency), done and verified on web and mobile:**

- **Translate** (mockup 4a/4c) — the language bar opens on the trip's language ("Suggested for Japan"), the box auto-translates after a pause (500-character counter), the green result card has Speak (speech synthesis / `expo-speech`), Copy and Save phrase. Saved phrases are trip-scoped chips (`phrases` table with RLS, seeded with "Where is the station?", "No peanuts, please", "Table for four"); a chip reloads its translation offline. "From your trip" links the hotel address for a driver, tonight's dinner, a ready-made question for the next planned place, and the camera. Results outside the offline phrasebook are labelled as demo output rather than passed off as a translation.
- **Conversation** — the top half is rotated 180° toward the other person and labelled in their language ("聞いています" / "タップして話す"), each side has a mic (Web Speech API where the browser has it) and a typed fallback, turns are translated both ways and read aloud, "Auto-detect" decides which side typed from the script, and a transcript lists every turn.
- **Camera** — take or choose a photo; the server (web) or device (mobile) runs OCR and translates each line, keeping prices as numbers. Overlay draws chips over the photo at the recognised boxes; Text lists lines with the price in the trip currency and the home equivalent. A bundled sample menu works without a camera. Photos are never stored. "Live" is marked Soon; "Send to Split" waits for round 5.
- **Show to driver** (mockup 4b) — from a place page or Translate: "ここまでお願いします" with the local-script name, address and phone on a dark card, English underneath, Speak, Enlarge, Show map (drive directions).
- **Currency** (mockup 4b/4c) — home → trip currency with the mid-market rate and "Updated 2 min ago", swap, quick amounts ($1…$100, scaled for yen-like currencies), trip currency chips ("JPY", "KRW · Seoul layover", add/remove via `trip_currencies`), a keypad with Tip and % off presets, Save (kept on the device), "Common in Japan" reference prices, and a rate cache with a stale fallback so the converter keeps working offline (`createFxCache`; server-side on web, persisted per pair on mobile). Frankfurter (keyless) is one env var away from live rates.

**Round 5 (People + Split), done and verified on web and mobile:**

- **People** (mockup 2c) — everyone on the trip with how they show up ("You · Organizer · All 14 nights · Home USD", "Guest · Tokyo only, Mar 15–20 · Home CAD"), the groups tree routes created, and add / edit for guests: a name is enough; contact, home currency and joining dates are optional. **Invite** builds a 30-day link (`trip_invites`); the public `/join/[token]` page shows only the trip name, who asked and the guest's name, and `accept_trip_invite` adds the membership and turns the guest row into the account's row. Guests never need an account for Split.
- **Split** (mockups 5a/5b/5c/8b), part of Atlas Premium Pass — the locked state with the three tiers and the gift path; **scan** with the merchant (tonight's dinner), currency and people prefilled from the trip, several pages, "Enter by hand"; **check items** with OCR correction (quantities, prices, a flagged low-confidence line, "read as つけ麹"), Translate, tax / service / discount, and the manual "Add item by hand" sheet (name, price, quantity, who had it); **who had what** with an avatar on every item, shared items, "Split rest evenly", tax shared in proportion or evenly, a guest added to one bill, and a **claim link** per person; **everyone's share** with fractions (½ Gyoza), tax, rounding to the yen, each person's own home currency (Daniel sees CA$), the payer's "Collects ¥3,924 from 3 people", Share summary, Close / Reopen. Desktop shows the receipt lines on the left and the steps on the right.
- **Claim link** — `/s/[token]` is a public page with no account: "Joe sent you a bill from Afuri. Chris, pick what you ordered." It runs through two token-scoped database functions that expose first names and items only, mark the link opened, and accept picks only while the bill is open. Tokens are issued by the database, unusable until the sender shares them, and expire after 30 days.
- **Cross-feature** — Restaurant → "Split a bill here"; Camera → "Send to Split" turns priced menu lines into a draft bill; Split → each person's home currency uses the Currency rates.
- **Atlas Premium Pass** — `entitlements` (single trip, monthly, yearly, gift) gate Split on web and mobile; the demo account holds a yearly pass.

**Round 6 (Atlas Premium Pass, Profile & Settings, offline & error states), done and verified on web and mobile:**

- **Checkout** (mockup 7a) — the three plans as a radio group (Single trip · Japan 2027 $2.99 one time, Monthly $4.99, Yearly $49.99 · Save 17%), a way to pay, one Pay button; **Congratulations** with the pass on the avatar, "Yearly · renews Mar 3, 2028", what was paid with, the receipt line, "Scan tonight's receipt". Card details never touch Voya: purchases go through a `BillingProvider` interface (`packages/core/src/providers/billing.ts`). The mock takes payment instantly and is honoured only in demo mode; in a real deployment the vendor's webhook (`supabase/functions/billing-webhook`, a stub with HMAC verification) grants the entitlement through `grant_pass` / `grant_extension` with the service role, idempotent on the receipt id. Stripe, RevenueCat or store billing slot in behind the same interface — pick one and only the adapter changes.
- **Gifting** (mockup 8c) — Monthly/Yearly members gift one traveler per trip 3 days ("Voya account · no pass", "Guest · will need to create an account", "Already has Atlas Premium Pass · yearly" greyed out). The gift is a 24-hex code in a link; `/gift/[code]` shows "A gift from Joe · 3 days of Atlas Premium Pass · ends Tue, Mar 18 · 11:59 PM JST"; accepting (`redeem_gift`) links the traveler row, adds membership and inserts the entitlement in one call. Recipients **extend** for $0.99 (1–7 days, "7 days covers you through Thu, Mar 25 · 4 more nights after that"), or buy the single-trip pass. Codes can also be pasted on the pass page (web) or the Redeem screen (mobile).
- **Pass mark** (mockup 8a) — the four-point compass star on the accent amber: ring + corner badge for holders, ring only for gifted access; on People rows, Split results, the sidebar user row, Profile and the pass page. `trip_pass_marks` exposes only "which members hold a pass, and of what kind", nothing about receipts. Sidebar Premium badges turn into the mark once you hold a pass.
- **Profile & Settings** (mockup 6a) — name, email, the pass line, Trips / Saved places / Countries; **Defaults** every tool reuses (home currency, home time zone, "I speak", km/mi) in an edit dialog, saved to `profiles` (new `units`, `languages`, `settings` columns); Account rows for the pass, offline downloads, privacy & data. **Settings**: theme (Light / Dark / Auto, persisted), Trip behaviour switches (suggest local language / currency, show home time, quick action button), Offline packs (the trip pack, one map per city with the rest grouped "Wi-Fi only", the text translation pack; sizes are estimates, downloads are per device).
- **Permissions & legal** (mockup 7a) — Voya explains each permission once *before* the OS or browser asks (location for directions, microphone for voice translation, camera for receipts), with the fallback if you decline; the Permissions page shows each capability's state with the way back in (OS Settings on mobile, the browser's site settings on the web), plus Terms, Privacy, Refunds, Cookies, Licences and Download / delete my data. Terms open with the mockup's "Short version" cards.
- **Offline & error states** (mockup 6b) — "You're offline · showing Japan 2027 saved 41 min ago" above every page; Home's "Available offline" card (saved places, map and routes, the rate from 41 min ago, text translation, and what needs internet); Translate keeps working offline with the on-device phrasebook while voice, camera and receipt scan say so; Directions offer "Show address in 日本語" for a taxi when the connection is slow; a stale rate is dashed-underlined; "Couldn't sync your trips" and "Atlas Premium Pass ended" states; error boundaries that keep the device usable.
- **Demo accounts** — `joe@example.com` (yearly pass) and `chris@example.com` (no pass, the gift recipient); Sarah holds her own pass. Password `VoyaDemo-2027!` for both. Local seed only.

Next: release engineering (a real Supabase project, web deploy, EAS builds, CI, the billing adapter) and the rename to Get Going.

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
pnpm test                          # tokens contrast (15) + core (103) + web components (9, axe) + mobile (41, RNTL)
pnpm --filter @voya/core test:db   # migrations + seed + RLS scenarios (21) on a throwaway Postgres 16
pnpm test:e2e                      # Playwright: 312 tests across iPhone/Android/iPad/desktop × light/dark
pnpm typecheck && pnpm lint
```

The e2e suite runs against a production build in demo mode. Every screen is checked with axe (WCAG 2.2 AA), aria-tree snapshots (what a screen reader announces), keyboard-only navigation, reduced-motion, and security headers. In sandboxes with a pinned Chromium set `PW_CHROMIUM_PATH`.

## Design → code decisions worth knowing

- **Contrast:** the mockups' muted grey `#6B7570` measured 4.37:1 on the paper canvas; it's `#5F6964` here (4.5:1+). A dedicated `on-tint` colour keeps chips readable on tinted rows in dark mode. `packages/tokens` tests fail if a token drops below AA.
- **Maps:** OpenStreetMap tiles via MapLibre (web) and MapLibre-in-WebView (mobile) — no API keys, matches the mockups' `voya-map`. Maps are `role="img"` with a text list of pins for assistive tech. MapLibre's worker is served from `public/maplibre` (copied by `scripts/sync-maplibre-worker.mjs` before dev/build) because the bundled copy doesn't start, and without it no route line renders; the map exposes `data-map-state` / `data-route-state` so tests wait for a drawn route rather than a timer.
- **Dates:** 2027-03-15 is a Monday; the mockup's "Sat, Mar 15" was illustrative.
- **Motion:** 3% press scale, 220 ms fades, 40 ms list stagger — all disabled under "Reduce motion".
- **Demo mode:** in-memory data isolated per browser session; refused on production deployments (`VERCEL_ENV`/`VOYA_ENV=production`).
- **Speech and camera:** the browser's own Web Speech API and `<input capture>` on web, `expo-speech` / `expo-image-picker` on mobile. Expo Go has no speech recognition module, so the mobile mic explains that and both sides of Conversation can type. Translation and OCR run through server actions on web (keys never reach the browser) and stay on the offline mocks on mobile until a server relay exists.
- **Inserts mint their own ids:** creating a trip or route never uses `RETURNING` — the row's select policy depends on a membership the after-insert trigger creates, so reading it back in the same statement would be refused by RLS.

## Layout

```
apps/web/src/app        routes: (marketing)/ landing · (auth)/* · (app)/{home,trips/[id]/people,plan,navigate/{route,day,tree},translate/{conversation,camera,driver},currency,split/{new,[id]},pass/{done,gift,extend},profile,settings/permissions} · s/[token] claim link · join/[token] invite · gift/[code] · legal/[doc]
apps/web/src/components ui primitives, shell (tab bar / rail / sidebar), map, per-feature components
apps/web/src/proxy.ts   CSP nonce, security headers, session refresh, route protection
apps/mobile/app         expo-router: (auth)/* · (tabs)/* · plan · place/[id] · trips/[id] · people · navigate/{route,day,tree} · translate/{index,conversation,camera,driver} · currency · split/{index,new,[id]} · pass/{index,done,gift,extend,redeem} · settings/{index,permissions}
packages/core/src       domain.ts · schemas.ts · selectors.ts · navigate.ts · tree.ts · translate.ts · money.ts · split.ts · people.ts · pass.ts · permissions.ts · format.ts · providers/* (incl. billing.ts) · db/*
supabase/migrations     0100 schema · 0200 RLS · 0300 account deletion & export · 0400 routes · 0500 route trees · 0600 phrases & trip currencies · 0700 people, invites, bills, claim links, entitlements · 0800 pass gifts, purchase grants, profile defaults
supabase/functions      billing-webhook (Edge Function stub: the only writer of entitlements, service role)
```

See `SECURITY.md` for the threat model and controls.
