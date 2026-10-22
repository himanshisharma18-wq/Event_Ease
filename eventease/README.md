EventEase

Every occasion, beautifully planned. EventEase brings event discovery and celebration planning together in one responsive web app.

Live website

Open EventEase: 

https://event-ease-gdk3.onrender.com

The live site is hosted on Render. Its home page and health endpoint were reachable when this README was prepared. The health endpoint is 

https://event-ease-gdk3.onrender.com/api/health.

What you can do

•
Explore events: search and filter by location, category, format, date range and price. Curated sample events are planning inspiration, not verified live listings. Configured external-provider results are labeled separately.

•
Plan an event: use the multi-step planner to create an editable draft. With a working Gemini key, the server requests an AI-generated plan; if Gemini is not configured, over quota or unavailable, EventEase clearly uses its local planning guide instead. Budget figures are estimates, not vendor quotes.

•
Browse festivals: view seasonal guidance and available public-holiday dates. Some observances vary by location or lunar calendar, so dates that are not verified are not presented as confirmed.

•
Manage a plan: signed-in users can save plans and manage guests, expenses, tasks, venue options and bookmarks.

•
Compare venues: add and compare venue options manually. PredictHQ is an event and geographic-place data source, not a searchable venue-business directory; automatic venue listings require a separate compatible provider.

•
Use community listings: signed-in members can submit future event listings when MongoDB and the session secret are configured.

An external provider may not supply an official event-page URL for every record. EventEase should only link out when a real external URL is present. Confirm event details with the organizer before making plans.

Technology

•
Node.js and Express

•
Native HTML, CSS and browser JavaScript modules (no React or Next.js)

•
MongoDB Atlas and Mongoose for accounts and durable user data

•
Google Gemini through the backend-only @google/genai package (optional)

•
Nager.Date public-holiday API for festival calendar dates (optional/unkeyed public endpoint)

•
Optional event-provider integration through server-side environment variables

Run locally on Windows

Install Node.js 22.12 or newer and npm 10 or newer. Open PowerShell and change to the folder containing package.json. In the downloaded folder layout, that may be:

Plain Text


cd "C:\Users\YOUR_NAME\Downloads\Build and preview the EventEase website\EventEase-source\eventease"



Use your actual Windows account and extracted folder path. Check that you are in the correct folder:

Plain Text


Test-Path .\package.json



It should print True. On the first run, create a local environment file and install dependencies:

Plain Text


Copy-Item .env.example .env
npm install



If .env already exists, do not overwrite it—just run npm install if dependencies have not yet been installed. Start the development server with:

Plain Text


npm run dev



Open 
http://localhost:5000. Keep that PowerShell window open while using the local site. After closing the terminal or restarting the computer, open PowerShell again, return to the folder containing package.json, and run npm run dev.

Press Ctrl+C in the server window to stop it.

Useful commands

Plain Text


npm start       # Run the regular server command
npm run dev     # Run locally with Node watch mode
npm test        # Run the automated tests
npm run check   # Check JavaScript syntax
npm run seed    # Add the clearly labeled sample events to the configured MongoDB



Local environment setup

The .env.example file is a template. Copy it to .env for local development and put local values only in .env:

Plain Text


PORT=5000
NODE_ENV=development
MONGODB_URI=
SESSION_SECRET=
PREVIEW_SECURE_COOKIE=false
GEMINI_API_KEY=
EVENTS_API_KEY=
EVENTS_API_BASE_URL=
CLIENT_BASE_URL=http://localhost:5000
VENUES_API_KEY=
VENUES_API_BASE_URL=
GEMINI_MODEL=gemini-3.8-flash



Leave optional values blank when you do not use that integration. Do not commit .env, share it, or paste secret keys into GitHub, browser code or chat. Only commit .env.example, which contains placeholders.

Accounts and MongoDB Atlas

A reachable MongoDB Atlas connection is required for registration, sign-in and durable saved data. Configure MONGODB_URI and a long, random SESSION_SECRET in the server environment. Check Atlas database credentials, URI encoding and Network Access rules if the app reports that the database is unavailable.

Without a working database, public discovery and the local planner fallback can still load, but account-based saving and durable dashboard data are unavailable. Temporary browser/session data is not a substitute for database persistence.

Gemini planner

To enable Gemini, create a key in 

Google AI Studio and configure it as the server-side GEMINI_API_KEY. The default model is gemini-3.8-flash; change GEMINI_MODEL only if your AI Studio project uses a different available model. Never add the key to frontend JavaScript. A configured key can still encounter model access, quota or rate-limit errors; in those cases EventEase explains that it is using the local planning guide instead.

Events and venues

Event discovery works without a third-party event provider by showing curated sample ideas and, when enabled, member-created listings. For actual external listings, configure a compatible event provider on the server using EVENTS_API_KEY and EVENTS_API_BASE_URL. If using the PredictHQ adapter in this repository, use the PredictHQ Events API base URL:

Plain Text


EVENTS_API_BASE_URL=https://api.predicthq.com/v1



Only an actual PredictHQ key belongs in EVENTS_API_KEY; do not generate a random replacement. PredictHQ results can include active and predicted records, holidays and observances. Predicted event details may change; an active state means the provider has confirmed event details, not that an event can never later change or be canceled. Check the organizer's official information before attending.

PredictHQ does not provide venue-business listings, prices or availability. Leave VENUES_API_KEY and VENUES_API_BASE_URL blank unless you have a separate venue-directory provider that implements the app's expected API format. Manual venue comparison remains available.

Deploy on Render

The Render service uses the Node runtime, not the Docker runtime. In the Render service settings:

•
Root Directory: eventease if the GitHub repository contains the project inside an eventease subfolder; leave it blank if package.json is at the repository root.

•
Build Command: npm ci

•
Start Command: npm start

•
Health Check Path: /api/health

In Render's Environment settings, configure:

Plain Text


NODE_ENV=production
NODE_VERSION=22.22.0
SESSION_SECRET=<a privately generated random value>
MONGODB_URI=<your MongoDB Atlas connection string>



Add GEMINI_API_KEY only if you want Gemini planning. Add EVENTS_API_KEY and EVENTS_API_BASE_URL only if you have an actual compatible event integration. Render supplies PORT; do not set it manually. For the normal same-origin deployment, the frontend and API are served by the same Express application. Keep your local .env settings such as CLIENT_BASE_URL=http://localhost:5000 for local use; do not copy the entire local .env to Render.

Render free web services may spin down after being idle and take time to start on the next request. For durable application data, use MongoDB Atlas rather than local files. See 

Render's Node/Express deployment guide, 

Node version settings, and 

free service limitations.

Security and data notes

Passwords are hashed, session cookies are HTTP-only, and account-owned records are scoped to their user. The API uses server-side validation and CSRF protection for unsafe requests. Keep production secrets in Render's protected Environment settings, never in source code. The production app enables secure cookies automatically over HTTPS.

Festival guidance is not a substitute for an official local calendar. Currency formatting does not convert exchange rates. Venue costs and planner budgets are estimates and should be confirmed with providers.

Health and troubleshooting

•
Check application health: open /api/health on the website's origin. status: "ok" means the Express service answered; check the database field separately for MongoDB connectivity.

•
Sign-in or saving unavailable: confirm that MONGODB_URI and SESSION_SECRET are set in Render and that Atlas permits the Render service to connect.

•
Planner says it used a local guide: check that GEMINI_API_KEY is correct and that the Google AI Studio project has model access and available quota.

•
Event provider results are empty: confirm the provider key, base URL and adapter/response format. An API key being present does not prove that it returned matching events.

•
Venue results are empty: PredictHQ is not a venue-business directory. Use manual venue options or configure a separate compatible venue provider.

•
Render cannot find package.json: set the service's Root Directory to the folder that contains package.json—eventease for the nested GitHub layout.

•
Local port is already in use: change PORT in your local .env to another available port, then use that port in your browser.

Project layout

Plain Text


public/       HTML, CSS, images, browser JavaScript modules and static assets
src/          Express app, routes, database config, models, middleware and services
scripts/      Data-seeding utility
tests/        Automated tests
.env.example  Safe local environment template
package.json  Commands and dependencies




