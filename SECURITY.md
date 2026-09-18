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
- **404, not 403** for trips you can't see — no existence leak.
- **Demo mode** (`VOYA_DEMO=1`) is per-session, in-memory, and refuses to boot on a production deployment.
- **Dependencies**: no analytics, no third-party scripts; map tiles come from `tile.openstreetmap.org` only (allow-listed in CSP `img-src`/`connect-src`).

## Mobile (`apps/mobile`)

- Session tokens live in the device keychain / keystore via `expo-secure-store` (chunked for Android's 2 KB limit).
- "Welcome back" re-entry requires a biometric check (`expo-local-authentication`, device fallback disabled) before an existing session is unlocked.
- The map WebView has a strict CSP (MapLibre from jsDelivr, tiles from OSM only), `originWhitelist` limited to `about:blank`, file access and multiple windows off; pin labels are inserted via `textContent`, never HTML.
- No deep-link handler executes actions; `voya://auth/callback` only completes Supabase OAuth.

## Privacy / compliance hooks (from the design's Round 9)

- Date of birth is checked at sign-up and **not stored**.
- Marketing consent is unticked by default and stored as an explicit boolean.
- `Profile → Download my data` (`export_my_data` RPC, RLS-scoped) and `Delete my account` (`delete_my_account` RPC, cascades, two-step dialog).
- Legal pages: Terms, Privacy, Refunds, Cookies (essential-only, so no consent banner is required), Licences.

## Dependency audit (as of this build)

`pnpm audit --prod` reports one moderate advisory: `uuid < 11.1.1` reached only through `expo → @expo/config-plugins → xcode`, i.e. the native-project generator used at build time. It is not part of the shipped JavaScript bundle, and forcing a major-version override there risks breaking `expo prebuild`; it clears when Expo updates the plugin chain. `decode-uri-component` (via `expo-router → query-string`) is pinned to a patched version with a pnpm override.

## Reporting

Open a private security advisory on the repository or email the maintainers listed in `package.json`. Please don't file public issues for vulnerabilities.
