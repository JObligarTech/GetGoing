# Security

## Boundary

**Row Level Security in Postgres is the authorization boundary.** Both apps talk to Supabase with the public anon key and the user's own JWT; every table is deny-by-default and access derives from `trip_members` (`supabase/migrations/20260918000200_rls.sql`). The service-role key is never shipped to a client and `apps/web/src/lib/env.ts` throws if it is present.

Verified by `supabase/tests/rls.test.sql` (pgTAP) and `packages/core/db-tests/rls.test.ts` (runs on plain Postgres): unrelated users see nothing, the anon role has no table access, viewers can't write, editors can't transfer ownership, deletion hands shared trips to another editor.

## Web (`apps/web`)

- **CSP with per-request nonce + `strict-dynamic`**, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; HSTS (preload), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, COOP, `Permissions-Policy` scoped to `self`. Set in `src/proxy.ts` and `next.config.ts`; asserted by `e2e/auth.spec.ts`.
- **Auth cookies** are `HttpOnly; SameSite=Lax; Secure` (prod). Session validation uses `supabase.auth.getUser()` (server-side JWT check), not the unverified cookie payload.
- **Server actions** validate every input with zod (`packages/core/src/schemas.ts`): length caps mirroring the SQL checks, control-character stripping, `http(s)`-only URLs, 16+ age gate, ISO codes.
- **Open-redirect protection**: post-login `next` must be a same-origin relative path (`safeNext`).
- **No account enumeration**: login, sign-up-conflict and reset return the same messages regardless of whether the email exists.
- **Rate limiting**: in-memory token bucket per IP+scope(+email) for auth actions (`src/lib/rate-limit.ts`), on top of Supabase's own auth limits. For multi-instance deployments back it with a shared store (e.g. Upstash).
- **CSRF**: server actions are same-origin by construction; the destructive `deleteAccount` and the export route additionally reject `Sec-Fetch-Site: cross-site`.
- **Trip switching and slot assignment** only accept ids the user can see; writes filter by `trip_id` so a guessed row id can't cross trips even before RLS.
- **Navigate** takes only uuids for `to`/`from`/`route` (zod-checked before any lookup; anything else is a 404), resolves them inside the active trip's bundle, and `saveRoute` verifies every stop belongs to that trip before inserting. The database repeats the check: `guard_route_stop()` raises on a stop whose place is from another trip, and `route_stops` are readable/writable only through the parent trip's membership.
- **Routing requests** are made server-side (web) or on-device (mobile) with coordinates only — no place names or user identifiers leave the app. The OSRM adapter is opt-in; the default is an offline mock.
- **Navigation trees** are validated as a whole (`treeSchema`: ids, branch ↔ trunk references, 2–60 stops, ≤12 branches) and every place/traveler must belong to the caller's trip before planning or saving. Row ids are minted by the app; `save_route_tree` runs as the caller so RLS governs every insert, and triggers reject branches that split from another route's stop or travelers from another trip.
- **Translate / Camera / Currency** run through server actions that check the session, validate with zod (500-character text, supported language codes only, ISO currency codes) and apply a per-user rate limit (60 translations, 20 photos, 60 rate lookups per minute) so one account can't drain a paid provider's quota. Provider keys stay server-side. Uploaded photos are checked for type (JPEG/PNG/WebP/HEIC) and size (8 MB), read into memory, handed to the OCR provider and dropped — never written to disk or storage. The phrasebook mock never invents a translation: unknown text comes back flagged and can't be saved.
- **Saved phrases and trip currencies** (`phrases`, `trip_currencies`) follow trip membership like every other table; a trigger caps phrases at 200 per trip; both are included in the data export. Speech synthesis and recognition use the browser's / OS's own engines; nothing is recorded by Voya.
- **Invites** are the only way a guest becomes a member: a 36-hex-character token issued by the database, 30-day expiry, one use. `invite_preview` (anonymous) returns the trip name, inviter's first name and the guest's name, nothing else; `accept_trip_invite` runs as definer but only for the signed-in caller and only while the invite is valid. Nobody can insert an invite on another user's behalf (`created_by = auth.uid()`).
- **Claim links** never touch a table from the anon role. `bill_claim_view` / `bill_claim_submit` are token-scoped definer functions: the token is issued by the database (a trigger refuses client-chosen tokens), stays unusable until the sender shares it, expires after 30 days, and stops accepting picks when the bill is closed. The view carries first names, items and shares only — no trip, no contact details, no other tokens — and the export strips tokens. Submissions ignore item ids that aren't on that bill. Both are rate-limited per IP on the web.
- **Bills** are trip-scoped with the same RLS as everything else; `save_bill` runs as the caller. Integrity triggers use `is distinct from` so a row hidden by RLS (subquery returns NULL) is treated as "doesn't match" rather than silently passing — the earlier route/branch guards were hardened the same way in migration 0700 after a test caught the gap. Receipt photos are type- and size-checked, read into memory, handed to the OCR provider and dropped.
- **Entitlements** (Atlas Premium Pass) are readable by their owner only; there is no client insert/update/delete policy. Purchases are written only by `grant_pass` / `grant_extension`, which are executable by the service role alone (explicitly revoked from `anon` and `authenticated`, since Supabase grants execute on new public functions by default) and are idempotent on the receipt id, so a retried webhook can't grant twice. The app never sees card details: the `BillingProvider` interface hands the buyer to the vendor, and the vendor's webhook (`supabase/functions/billing-webhook`, HMAC-verified, 16 KB body cap, uuid-checked) does the granting. The mock provider's receipts are honoured only in demo mode (`isDemo`), never in a real deployment. Split's server actions re-check the pass on every call, not just when rendering the gate; purchase, extension and gift actions are rate-limited per user.
- **Gifts** are created only through `create_pass_gift` (giver must hold Monthly/Yearly, be a member, pick a traveler on the trip who isn't themselves and has no pass; one gift per trip per giver enforced by a partial unique index). The 24-hex code is issued by the database and is the only key: `gift_preview` (anonymous) returns the giver's first name, the trip and the days; `redeem_gift` runs for the signed-in caller only, refuses the giver, a traveler row that belongs to someone else, and anyone who already holds a pass, and links the traveler, adds membership and inserts the entitlement in one transaction. Gift rows are readable by the giver and the recipient only (not every member), and the export strips codes. `trip_pass_marks` exposes only member id + pass kind to trip members.
- **Profile defaults and settings** are updated by the owner only (existing `profiles_update` policy); `settings` is constrained to a JSON object under 4 KB and the app reads only known boolean keys.
- **Permission pre-prompts** are explanations, not gates: declining never blocks a fallback, and the "already asked" flag is a per-device preference. On the web, permission state is read through `navigator.permissions.query`; nothing is requested from the Permissions page itself.
- **Offline state** on the web is a per-device localStorage summary (counts and timestamps only, no place data) that drives the banner and the "Available offline" card; offline text translation uses the on-device phrasebook, nothing is queued to a server.
- **Send my location** never touches the backend: one foreground position read on the device, an OpenStreetMap link, the OS share sheet (or clipboard on desktop). No coordinates are logged or stored; the iOS/Android permission strings say exactly that.
- **404, not 403** for trips you can't see — no existence leak.
- **Demo mode** (`VOYA_DEMO=1`) is per-session, in-memory, and refuses to boot on a production deployment.
- **Dependencies**: no analytics, no third-party scripts; map tiles come from `tile.openstreetmap.org` only (allow-listed in CSP `img-src`/`connect-src`).

## Mobile (`apps/mobile`)

- Session tokens live in the device keychain / keystore via `expo-secure-store` (chunked for Android's 2 KB limit).
- "Welcome back" re-entry requires a biometric check (`expo-local-authentication`, device fallback disabled) before an existing session is unlocked.
- The map WebView has a strict CSP (MapLibre from jsDelivr, tiles from OSM only), `originWhitelist` limited to `about:blank`, file access and multiple windows off; pin labels are inserted via `textContent`, never HTML.
- No deep-link handler executes actions; `voya://auth/callback` only completes Supabase OAuth.
- Invite and claim links are shared through the OS share sheet; the app never posts them anywhere itself. Bills and travelers are edited through the same RLS-scoped tables and RPCs as the web.
- Camera and photo-library access are requested only when the user taps Take / Choose photo, after Voya's own explanation sheet (once per device), with permission strings that say the photo is read once and never stored. The Permissions screen reads the current state with the `get*PermissionsAsync` APIs and links to OS Settings for recovery; it never requests anything itself.
- Purchases go through `BillingProvider` (`src/lib/billing.ts`): the mock in demo mode, "unavailable" until a store-billing adapter (StoreKit / Play through RevenueCat) is configured. The app never writes entitlements; the webhook does. Translation and OCR stay on the offline mocks on the device (no keyed provider ships in the bundle); FX can use the keyless Frankfurter API. Saved conversion amounts and cached rates live in the device keystore under the user's prefs.

## Privacy / compliance hooks (from the design's Round 9)

- Date of birth is checked at sign-up and **not stored**.
- Marketing consent is unticked by default and stored as an explicit boolean.
- `Profile → Download my data` (`export_my_data` RPC, RLS-scoped) and `Delete my account` (`delete_my_account` RPC, cascades, two-step dialog).
- Legal pages: Terms, Privacy, Refunds, Cookies (essential-only, so no consent banner is required), Licences.

## Dependency audit (as of this build)

`pnpm audit --prod` reports one moderate advisory: `uuid < 11.1.1` reached only through `expo → @expo/config-plugins → xcode`, i.e. the native-project generator used at build time. It is not part of the shipped JavaScript bundle, and forcing a major-version override there risks breaking `expo prebuild`; it clears when Expo updates the plugin chain. `decode-uri-component` (via `expo-router → query-string`) is pinned to a patched version with a pnpm override.

## Reporting

Open a private security advisory on the repository or email the maintainers listed in `package.json`. Please don't file public issues for vulnerabilities.
