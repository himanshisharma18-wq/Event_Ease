# EventEase — implementation approach

## Product and architecture

Build a single Node.js/Express application that serves a modular vanilla HTML/CSS/ES-module interface and REST API. Keep services swappable and provider integrations explicit: curated seed event listings are always labeled as curated demo data; external listing/vendor search is only enabled when its provider is actually configured. MongoDB/Mongoose and Gemini are optional runtime integrations, read only from server-side environment variables. A location-scoped Nager.Date adapter supplies published future holiday dates and confidence notes without pretending that its country-level feed is a city calendar. When optional integrations are absent, expose actionable setup status and working local demo/planner fallbacks rather than pretending an integration succeeded.

The backend separates configuration, route handlers, middleware, models, validators and services. It provides health/status, event discovery, authentication, planning, saved events, venue comparisons, guest/expense/task management and profile endpoints. Passwords are bcrypt-hashed; HttpOnly cookie sessions use `SameSite=None; Secure` for public HTTPS Preview and separate local HTTP handling. User-owned resources authenticate, check ownership and omit internal owner identifiers. Express applies Helmet, bounded request bodies, rate limits, CSRF checks, validation and centralized errors. The browser uses modular API/auth/discovery/planner/dashboard/budget/guests/venues/event-composer code and shared utilities. MongoDB accounts persist owner-scoped data; unauthenticated demo actions are clearly session-only.

Gemini integration will use Google's supported SDK and a currently supported model, only from the server. The backend will validate planner inputs and structured responses; safe fallback plan generation will remain available when the model key/quota is unavailable. Generated prices remain estimates. Event and venue provider interfaces will not invent live listings.

## Project structure

- `public/`: HTML, responsive design-token/component styles, route manifest, accessible dialogs, and modular browser JavaScript.
- `src/config/`: environment and Mongo configuration.
- `src/routes/`, `middleware/`, `validators/`: HTTP boundaries, strict identifier and request validation, CSRF/session controls and safe error handling.
- `src/models/`: Mongoose users, public/community events, saved events and plans with guests, expenses, tasks and manual venue options.
- `src/services/`: Gemini structured generation/local fallback, curated/provider discovery, holiday date lookup and transactional plan cleanup.
- `scripts/seed.js`: repeatable, clearly labeled demo event seed data.
- `tests/`: Node test-runner coverage for health, validation, auth, location-scoped festival data, ownership-safe cascade logic and business rules.
- Root: package manifest/lock, `.env.example`, ignored local `.env`, README, deployment Dockerfile, and this plan.

## Design

Three directions considered: **Midnight editorial** (0.07), a dark, typographic celebration journal with warm coral/amber notes; **Ritual atlas** (0.04), map-inspired cultural discovery with deep indigo and saffron; **Modern social club** (0.02), bright magazine typography with ink-blue accents. Selected: **Midnight editorial**, reflecting the requested dark purple/navy, coral and amber palette.

- **Design Movement:** Contemporary editorial design blended with the quiet precision of boutique event production.
- **Core Principles:** Clear hierarchy; expressive photography; warm human copy; purposeful, low-friction controls.
- **Color Philosophy:** Ink and plum make a calm canvas for vivid occasion photography; coral gives the brand a human pulse and amber signals warmth and celebration.
- **Layout Paradigm:** Magazine-like, asymmetric editorial flow with a focused search masthead, wide photographic feature, and compact horizontal discovery rows rather than a uniform card grid.
- **Signature Elements:** Small sunburst/asterisk brand mark; fine coral rules; labeled “curated” provenance chips.
- **Interaction Philosophy:** Every action has an understandable response, plain error recovery and safe fallback; no decorative controls without behavior.
- **Animation:** Short ease-out reveals and hover lifts; no heavy parallax; honor reduced-motion settings.
- **Typography System:** DM Sans for utility and body, paired with a readable editorial serif such as DM Serif Display for major headlines; clear, restrained scale.
- **Brand Essence:** A thoughtful planning desk for people bringing people together; warm, capable, considered.
- **Brand Voice:** Specific, relaxed, reassuring. Examples: “Every Occasion. Beautifully Planned.” and “Good plans leave room for the good bits.”
- **Wordmark & Logo:** Custom compact “ee” monogram formed from two offset event-ticket arcs, paired with a deliberate wordmark.
- **Signature Brand Color:** Coral `#F47C67`.

## Delivery constraints

The public website runs on the initialized Webdev preview port. The downloadable ZIP will contain source, docs and lockfile but exclude `.env`, `node_modules`, Git metadata and build/runtime artifacts. The README will document local Node setup, MongoDB Atlas, Gemini key setup, tests and Render deployment. No credentials will be solicited or embedded.
