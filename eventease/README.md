# EventEase

EventEase is an editorial-style event discovery and planning workspace. The project uses native HTML, CSS and browser ES modules with a single Node/Express server. It can be previewed without provider credentials: the public discovery feed is composed of clearly labeled curated sample ideas, and the planner uses a deterministic local guide when Gemini is not configured. Accounts and durable saved data require MongoDB Atlas; they are deliberately not simulated.

## Requirements

Use Node.js 22.12 or later from the supported Node.js 22 LTS line, and npm 10 or later. A MongoDB Atlas connection string is needed for persistent user accounts, saved plans, saved events, guests, expenses and tasks. A Google Gemini API key is optional and is used only by the backend. Event-provider and vendor-search keys are optional.

## Run locally

```sh
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5000`. Change `PORT` to `3000` if you need to use the same port as the hosted preview. The starter `.env` template includes blank placeholders for the requested variables; never commit it. `.gitignore` excludes `.env`.

Useful commands:

```sh
npm start          # production server
npm run dev        # Node watch mode
npm test           # API and business-logic tests
npm run check      # JavaScript syntax checks
npm run seed        # seed the configured MongoDB with curated sample events
```

## MongoDB Atlas and accounts

1. Create an Atlas project and a database user with a strong password.
2. Allow network access from the application host. Use a narrow allow-list where the host supplies stable egress; avoid leaving `0.0.0.0/0` open longer than needed.
3. Copy the Node.js connection string and replace the example database name if desired.
4. Put the connection string in `.env` as `MONGODB_URI=...`. Create a long random `SESSION_SECRET` separately. Never commit either value.
5. Start the app. Registration and sign-in then use bcrypt-hashed passwords and server-side sessions stored in MongoDB. Each plan, guest, expense, task and bookmark query is scoped to the signed-in user.
6. Run `npm run seed` to insert clearly labeled curated sample listings. Re-running the seed upserts the examples rather than inventing live data.

Without a reachable `MONGODB_URI`, health checks and curated event discovery remain available, and signup returns a clear setup response. Temporary dashboard guest/expense/task entries are held only in the current page session and are not a database replacement.

## Gemini setup

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and set it in the server-only `.env` entry `GEMINI_API_KEY=...`. The default model is `gemini-3.8-flash`; override it with `GEMINI_MODEL` if your Google AI Studio project has different availability. The client uses Google's official `@google/genai` package and the Interactions API with a JSON response schema. The backend parses and validates the structured plan before returning it. Keys never go into browser code or API responses.

If `GEMINI_API_KEY` is missing, the planner clearly says its result came from the local planning guide, not from AI. If the model errors, returns invalid JSON, or its output fails checks, EventEase keeps the form details and offers a validated local fallback. Every cost is an estimate, not a vendor quotation.

Google references: [JavaScript quickstart and structured output](https://ai.google.dev/gemini-api/docs/quickstart?lang=node), [Gemini 3.8 Flash model details](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [model catalog](https://ai.google.dev/gemini-api/docs/models), [Interactions API](https://ai.google.dev/gemini-api/docs/interactions), and [structured-output guide](https://ai.google.dev/gemini-api/docs/structured-output). EventEase submits `store: false` for private planning details. A key's presence is not proof that it can call a model: authentication, quota, output-schema and transient service failures are explained separately when the plan uses its local fallback.

## Optional discovery providers

No global event database is configured by default. Curated entries and festival ideas are presented as samples or planning inspiration, never as a live ticket listing. If you connect an event provider, set `EVENTS_API_KEY` and `EVENTS_API_BASE_URL`. The provider is expected to accept `q`, `city` and `category` query parameters and return JSON shaped like `{ "events": [{ "id": "...", "title": "...", "startsAt": "ISO-8601", "category": "...", "city": "...", "format": "in-person", "description": "...", "image": "https://...", "link": "https://...", "popularity": 0 }] }`. `popularity` is optional and must be an actual nonnegative provider score for the “Most popular” sort to appear. Stable event IDs are required for bookmarks and share links; records without IDs are not shown. Authentication is sent in a server-side Bearer header. Returned records are labeled “Verified external listing”; configure only an endpoint and key from a provider you trust. For venue search, optional `VENUES_API_KEY` and `VENUES_API_BASE_URL` use a server-side JSON `{ "options": [{ "id": "...", "name": "...", "category": "venue", "city": "...", "capacity": 80, "estimatedCost": 30000, "currency": "INR", "link": "https://..." }] }` contract and receive `city`, `category`, `capacity` and `maxPrice` filters. Without that provider, the comparison workspace accepts manually entered options; no venue businesses, availability, reviews or contact details are fabricated.

## Festival dates and local calendars

Seasonal cards are planning guides, not event listings. For exact future dates, the backend optionally reads the public [Nager.Date v4 holiday API](https://nagerholidays.com/api/v4/Holidays/{CountryCode}/{Year}) for the selected country and, when supplied, a first-level ISO subdivision code such as `IN-MH`. Its public holiday dates are cached for six hours. This feed is not city-specific, may not publish future years yet, and does not cover every religious/local observance; lunar dates such as Eid can depend on local moon sighting. EventEase therefore shows an approximate season or “date varies” and does not highlight an unverified day in the monthly calendar. No API key is required for the public holiday endpoint; if it is unavailable, festival context and the manual guide still work.

Reference: [Nager.Date project/API and data coverage](https://github.com/nager/nager.date).

## REST API overview

All application endpoints are under `/api`. `GET /api/health` reports a small health object; `GET /api/status` reports which integrations are configured without exposing credentials. `GET /api/events` supports text, city, category, format, next-days and sample-price filters plus pagination; `POST /api/events` accepts an authenticated, clearly labeled member listing. `GET /api/events/festivals?country=IN&region=IN-MH` returns date-confidence labels for the selected country/subdivision; both query parameters are optional, and `region` must belong to the selected country. `POST /api/plans/generate` generates a plan draft; `POST /api/plans/generate/section` refreshes a section. Authenticated MongoDB users get `/api/auth`, `/api/plans`, `/api/auth/saved`, and nested plan routes `/api/plans/:planId/guests`, `/expenses`, `/tasks` and `/venues` for owned list/create/update/delete operations. Saved drafts reopen for editing and update in place. Plan deletion transactionally removes associated guests, costs, tasks and venue options. Responses omit database ownership internals and use `{ ok, data }` on success and `{ ok: false, error: { code, message } }` on errors.

## Render deployment

1. Push this source to a Git repository and create a Render Web Service using the Dockerfile.
2. Set the build context to the repository root. The container installs production dependencies and starts with `npm start`.
3. Configure `PORT=5000`, `NODE_ENV=production`, a long random `SESSION_SECRET`, and a MongoDB Atlas `MONGODB_URI`. Add `GEMINI_API_KEY` only if AI generation is desired. Add `EVENTS_API_KEY` and `EVENTS_API_BASE_URL` only for an actual event provider.
4. Configure a health check at `/api/health`.
5. Set `CLIENT_BASE_URL` to the deployed site origin if you host a separate local frontend; the standard deployment serves UI and API from one origin.
6. Keep secrets in the host’s protected environment settings, not source control. Confirm TLS and Atlas IP/network rules before opening registration.

The Express app serves `public/` directly, so a separate frontend server is not required. The same container honors the runtime `PORT` environment variable.

## Security and data notes

Passwords are hashed using bcryptjs. Sessions use an HttpOnly cookie, with `Secure; SameSite=None` on the HTTPS Manus Preview or production and local-HTTP handling kept separate. Set `PREVIEW_SECURE_COOKIE=true` only when serving inside public HTTPS Preview; leave it false for ordinary `http://localhost`. Production sets secure cookies automatically. Unsafe API requests require a cryptographically random session-bound CSRF header, and a missing `SESSION_SECRET` disables account mutations with clear setup guidance. Helmet security headers, a bounded JSON body, same-origin defaults, auth/AI rate limits, input schemas, generic production errors, and server-side user ownership filters are enabled. The app does not set `X-Frame-Options` or restrictive `frame-ancestors` that would block the hosted preview. Do not paste keys into source files or browser devtools.

Seasonal festival dates not returned by the selected country's published holiday feed remain approximate; lunar, state-level and city calendars can differ. Currency display formats numbers but does not convert them. A saved plan keeps one consistent currency; its currency selector is locked to avoid silently relabeling existing estimates. If a saved-data request fails, the dashboard offers a real retry and does not overwrite the MongoDB data with its temporary session-only draft. The page-session demo data is temporary. Use MongoDB for durable accounts and user-owned data.

## Troubleshooting

- **App opens but sign-in says MongoDB is missing:** set `MONGODB_URI` and `SESSION_SECRET`, verify Atlas IP access and database credentials, then restart.
- **Mongo connection fails:** inspect the Atlas connection string, database user password escaping, TLS/network allow-list and host egress. The startup log reports the error category without echoing the DSN.
- **AI draft says local guide:** add a valid server-side `GEMINI_API_KEY`; check model access and quota in Google AI Studio. The deterministic fallback is still available.
- **External feed is empty:** without an event provider key and compatible base URL, only curated and user-created listings are expected. The provider response must contain an `events` array with titles and ISO date values.
- **A festival shows a season rather than a day:** the selected country/region feed did not publish a future date, or the observance depends on local moon sighting. Check the local calendar before making plans; unconfirmed days are intentionally not placed on the month grid.
- **Port is already used:** set `PORT` to an available port and update your preview/runtime settings accordingly.
- **Changes look cached:** clear site data or unregister the service worker; the current shell uses the `eventease-shell-v3` cache and removes older versions on activation. The service worker does not cache API or account responses.

## Project layout

`public/` contains the home page, responsive design system, local photography, manifest, service worker, route manifest and modular browser code for API/auth/discovery/festival calendar/planner/dashboard/community listings/venues. `src/` separates configuration, Mongoose models (including saved venue comparisons), middleware, REST routes, validators and provider/fallback services, including Nager.Date lookup and transactional plan cleanup. `scripts/seed.js` contains repeatable demo data; `tests/` contains API and business-logic coverage.
