# Going live: backend and real services

This takes Get Going from demo mode (made-up "Japan 2027" data) to a real backend with real translation, photo reading, exchange rates, place search and directions. Plan on about 30 minutes. Everything here has a free tier.

What you'll end up with:

| Service | What it does | Cost to start | Key needed |
|---|---|---|---|
| Supabase | Accounts, trips, places, bills — the database and sign-in | Free tier | Project URL + anon key |
| DeepL | Translate, Conversation, menu and receipt item names | Free up to 500,000 characters a month | Yes |
| Google Cloud Vision | Reading text in photos (Camera, Split receipts) | 1,000 photos a month free; billing account required | Yes |
| Frankfurter | Exchange rates (European Central Bank) | Free | No |
| OpenStreetMap Nominatim | Place search | Free (fair-use limits) | No |
| OSRM | Walk, cycle and drive directions | Free (public demo server) | No |

Frankfurter, Nominatim and OSRM switch on automatically as soon as the app runs against Supabase instead of demo mode. DeepL and Vision switch on when their key is present.

## 1. Supabase

1. Sign up at [supabase.com](https://supabase.com) and create a project. Pick a region near your users and save the database password somewhere safe.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) on your computer, then from the repo root:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>   # the id in your project's dashboard URL
   supabase db push                                  # creates every table, security rule and function
   ```

   `db push` applies `supabase/migrations` only. It does **not** load the demo seed, so the real database starts empty. Don't run `db reset` against the hosted project.
3. In the dashboard, open **Authentication → URL Configuration**:
   - **Site URL:** where the web app will live (`https://getgoing.app`, or `http://localhost:3000` while testing).
   - **Redirect URLs:** add `https://<your site>/auth/callback` and `getgoing://auth/callback`.
4. Still under **Authentication**, set the password policy to match the app: minimum length **10**, require **lowercase, uppercase letters and digits**. Turn **Confirm email** on for production.
5. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

   The **service_role** key is different: never put it in either app. The web app refuses to start if it finds one.

## 2. DeepL (translation)

1. Sign up for the **DeepL API Free** plan at [deepl.com/pro-api](https://www.deepl.com/pro-api). (The API plan is separate from the DeepL app subscription.)
2. In your DeepL account, open **API Keys** and copy the key. Free keys end in `:fx`; the app picks the right DeepL server from that automatically.

All 16 languages in the app's language bar are supported by DeepL.

## 3. Google Cloud Vision (reading photos)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or use an existing one).
2. **Billing:** Vision needs a billing account linked to the project even on the free tier. The first 1,000 photos each month are free.
3. Open **APIs & Services → Library**, search for **Cloud Vision API** and click **Enable**.
4. Open **APIs & Services → Credentials → Create credentials → API key**.
5. Click the new key → **API restrictions → Restrict key → Cloud Vision API** → Save. This way a leaked key can't be used for anything else.

Optional but recommended: set a budget alert under **Billing → Budgets & alerts**.

## 4. Fill in the keys

### Web app (`apps/web/.env.local` locally, or your host's environment variables)

```bash
VOYA_DEMO=0                                      # local .env.local only
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_SITE_URL=https://getgoing.app        # or http://localhost:3000

DEEPL_API_KEY=<your DeepL key>
GOOGLE_VISION_API_KEY=<your Vision key>
```

For local development also add `VOYA_DEMO=0` to `.env.local`: `apps/web/.env.development` turns demo mode on for `pnpm dev:web`, and `.env.local` is what overrides it. A deployed build doesn't read `.env.development`, so the host needs no `VOYA_DEMO` at all. `DEEPL_API_KEY` and `GOOGLE_VISION_API_KEY` are server-only: never prefix them with `NEXT_PUBLIC_`.

### Mobile app (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
EXPO_PUBLIC_SITE_URL=https://getgoing.app        # the deployed web app
```

The mobile app never holds the DeepL or Vision key. It sends translation and photo requests to the web app's relay (`/api/v1/translate`, `/api/v1/ocr`) with the signed-in user's session, and the web server calls DeepL and Vision. So **the web app must be deployed** (or reachable from the phone) for real translation on mobile. Until then the phone keeps using the offline phrasebook.

## 5. Check it

```bash
pnpm install
pnpm dev:web
```

Open `http://localhost:3000/api/health`. You should see:

```json
{ "ok": true, "mode": "supabase", "providers": { "routing": "osrm", "geocode": "nominatim", "fx": "frankfurter", "translation": "deepl", "ocr": "google-vision" } }
```

Any `"mock"` there means that key is missing. Then create an account in the app, make a trip, and try Translate.

Run the test suites as before (`pnpm test`, `pnpm test:e2e`); they always use the mocks, so they never call DeepL or Vision or spend your quota.

## Overrides

Each service can be forced with an environment variable, which beats the automatic choice:

| Variable | Values |
|---|---|
| `TRANSLATION_PROVIDER` | `deepl`, `mock` |
| `OCR_PROVIDER` | `google-vision`, `mock` |
| `FX_PROVIDER` / `EXPO_PUBLIC_FX_PROVIDER` | `frankfurter`, `mock` |
| `GEOCODE_PROVIDER` | `nominatim`, `mock` |
| `ROUTING_PROVIDER` | `osrm`, `mock` |
| `OSRM_URL` / `EXPO_PUBLIC_OSRM_URL` | your own OSRM server (default: the public demo server) |

## Before real launch

- **OSRM and Nominatim** public servers are for light use. Their usage policies ask heavy users to self-host or use a paid host (Stadia Maps, MapTiler, Geoapify all offer both). Point `OSRM_URL` at it when you switch.
- **Upload size:** some hosts cap request bodies (Vercel: 4.5 MB). The mobile app now takes photos at 60% quality, which keeps typical phone photos under that, but a very large photo can still be refused. Adding on-device resizing (`expo-image-manipulator`) before upload removes the risk.
- **Rate limiting** is per server instance. If the web app runs on more than one instance, back `apps/web/src/lib/rate-limit.ts` with a shared store (e.g. Upstash Redis) so one user can't exceed the DeepL / Vision limits by hitting different instances.
- **Transit directions** are still estimates; no transit provider is wired in yet.
