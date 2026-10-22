import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  buildFallbackPlan,
  explainGeminiFailure,
} from "../src/services/planner.js";
import { clearFestivalDateCache } from "../src/services/festival-dates.js";
import { removePlanAndChildren } from "../src/services/plan-deletion.js";
import {
  savedPlanCreateSchema,
  savedPlanPatchSchema,
} from "../src/routes/plans.js";
import { curatedEvents } from "../src/services/seed-events.js";
import { planSchema, plannerInputSchema } from "../src/validators/planner.js";
import { ownerQuery } from "../src/middleware/auth.js";

process.env.MONGODB_URI = "";
process.env.SESSION_SECRET = "test-only-session-secret";
const app = createApp();

async function csrfAgent() {
  const agent = request.agent(app);
  const response = await agent.get("/api/auth/me").expect(200);
  return { agent, token: response.headers["x-csrf-token"] };
}

test("health check is public and exposes no credentials", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(JSON.stringify(response.body).includes("SESSION_SECRET"), false);
  assert.equal(response.headers["x-frame-options"], undefined);
});

test("discovery returns curated, clearly labeled sample events", async () => {
  const response = await request(app)
    .get("/api/events?category=Festival")
    .expect(200);
  assert.ok(response.body.data.length > 0);
  assert.ok(response.body.data.every((item) => item.source === "curated"));
});

test("event city and online filters are applied", async () => {
  const response = await request(app)
    .get("/api/events?city=Online&format=online")
    .expect(200);
  assert.ok(response.body.data.length > 0);
  assert.ok(response.body.data.every((item) => item.format === "online"));
});

test("popularity sorting uses only scores returned by a configured event provider", async () => {
  const previousKey = process.env.EVENTS_API_KEY;
  const previousBase = process.env.EVENTS_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.EVENTS_API_KEY = "test-only-provider-key";
  process.env.EVENTS_API_BASE_URL = "https://provider.example/events";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        events: [
          {
            id: "provider-low",
            title: "Quiet Provider Gathering",
            startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            category: "Music",
            city: "Online",
            format: "online",
            popularity: 0,
          },
          {
            id: "provider-high",
            title: "Well-loved Provider Gathering",
            startsAt: new Date(Date.now() + 172_800_000).toISOString(),
            category: "Music",
            city: "Online",
            format: "online",
            popularity: 85,
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  try {
    const response = await request(app)
      .get("/api/events?sort=popularity&limit=2")
      .expect(200);
    assert.equal(response.body.meta.popularityAvailable, true);
    assert.equal(response.body.data[0].title, "Well-loved Provider Gathering");
    assert.equal(response.body.data[1].title, "Quiet Provider Gathering");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.EVENTS_API_KEY;
    else process.env.EVENTS_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.EVENTS_API_BASE_URL;
    else process.env.EVENTS_API_BASE_URL = previousBase;
  }
});

test("unconfigured venue search returns no invented provider listings", async () => {
  const previousKey = process.env.VENUES_API_KEY;
  const previousBase = process.env.VENUES_API_BASE_URL;
  delete process.env.VENUES_API_KEY;
  delete process.env.VENUES_API_BASE_URL;
  try {
    const response = await request(app)
      .get("/api/venues/search?city=Pune")
      .expect(200);
    assert.equal(response.body.meta.configured, false);
    assert.deepEqual(response.body.data, []);
    assert.match(response.body.meta.message, /No venue provider is configured/);
  } finally {
    if (previousKey === undefined) delete process.env.VENUES_API_KEY;
    else process.env.VENUES_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.VENUES_API_BASE_URL;
    else process.env.VENUES_API_BASE_URL = previousBase;
  }
});

test("planner API validates bad inputs once the session CSRF token is supplied", async () => {
  const { agent, token } = await csrfAgent();
  assert.ok(token && token.length >= 32);
  const response = await agent
    .post("/api/plans/generate")
    .set("X-CSRF-Token", token)
    .send({ guests: -1, budget: -4 })
    .expect(400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("planner dates must be real current-or-future calendar days", async () => {
  const { agent, token } = await csrfAgent();
  const base = {
    eventType: "Birthday",
    city: "Pune",
    guests: 12,
    budget: 1000,
    currency: "INR",
  };
  await agent
    .post("/api/plans/generate")
    .set("X-CSRF-Token", token)
    .send({ ...base, date: "2026-02-30" })
    .expect(400);
  await agent
    .post("/api/plans/generate")
    .set("X-CSRF-Token", token)
    .send({ ...base, date: "2000-01-01" })
    .expect(400);
});

test("state-changing API calls reject missing session CSRF tokens", async () => {
  const response = await request(app)
    .post("/api/plans/generate")
    .send({ eventType: "Party", guests: 10 })
    .expect(403);
  assert.equal(response.body.error.code, "CSRF_VALIDATION_FAILED");
});

test("local planner fallback produces a validated budget-aware plan", () => {
  const input = {
    eventType: "Birthday",
    city: "Pune",
    guests: 40,
    budget: 30000,
    currency: "INR",
    durationHours: 4,
    setting: "either",
    food: "",
    dietary: "",
    style: "",
    atmosphere: "",
    entertainment: "",
    accessibility: "",
    date: "",
    decor: "",
    notes: "",
    format: "in-person",
  };
  const plan = buildFallbackPlan(input);
  const parsed = planSchema.parse(plan);
  assert.equal(
    parsed.budget.reduce((sum, row) => sum + row.estimated, 0),
    input.budget,
  );
  assert.ok(parsed.schedule.length >= 4);
  assert.ok(parsed.sustainableAlternatives.length > 0);
});

test("signup fails closed with clear guidance when MongoDB is not configured", async () => {
  const { agent, token } = await csrfAgent();
  const response = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", token)
    .send({
      name: "Test Person",
      email: "person@example.com",
      password: "long-enough-password",
    })
    .expect(503);
  assert.equal(response.body.error.code, "DATABASE_NOT_CONFIGURED");
  assert.match(response.body.error.message, /MONGODB_URI/);
});

test("owner filter always binds a private resource to the authenticated user", () => {
  const filter = ownerQuery("user-actual", {
    userId: "user-from-browser",
    planId: "plan-7",
  });
  assert.deepEqual(filter, { userId: "user-actual", planId: "plan-7" });
});

test("seed records are explicitly curated and include no verified live listing", () => {
  assert.ok(curatedEvents.length >= 6);
  assert.ok(curatedEvents.every((event) => event.source === "curated"));
  assert.ok(curatedEvents.every((event) => !event.link));
});

test("malformed Mongo identifiers never reach cast-based plan queries", async () => {
  const response = await request(app)
    .get("/api/plans/not-an-object-id")
    .expect(400);
  assert.equal(response.body.error.code, "INVALID_ID");
});

test("saved plans require a validated, editable wizard-input snapshot", () => {
  const input = plannerInputSchema.parse({
    eventType: "Birthday",
    city: "Pune",
    guests: 12,
    budget: 1000,
    currency: "INR",
  });
  const base = {
    title: "Birthday in Pune",
    eventType: input.eventType,
    city: input.city,
    guests: input.guests,
    budget: input.budget,
    currency: input.currency,
    plan: buildFallbackPlan(input),
  };
  assert.equal(savedPlanCreateSchema.safeParse(base).success, false);
  assert.equal(
    savedPlanCreateSchema.safeParse({ ...base, input }).success,
    true,
  );
  assert.equal(savedPlanPatchSchema.safeParse({ budget: 1500 }).success, false);
  assert.equal(
    savedPlanPatchSchema.safeParse({
      budget: 1500,
      currency: "INR",
      input: { ...input, budget: 1500 },
    }).success,
    true,
  );
});

test("plan deletion cascades only to children owned by that plan and account", async () => {
  const calls = [];
  const session = { marker: "transaction" };
  const planModel = {
    async findOneAndDelete(filter, options) {
      calls.push({ type: "plan", filter, session: options.session });
      return { _id: "plan-1" };
    },
  };
  const childModels = ["Guest", "Expense", "Task", "VenueOption"].map(
    (type) => ({
      async deleteMany(filter, options) {
        calls.push({ type, filter, session: options.session });
      },
    }),
  );
  const deleted = await removePlanAndChildren({
    planModel,
    childModels,
    userId: "user-1",
    planId: "plan-1",
    session,
  });
  assert.equal(deleted, true);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[0].filter, { _id: "plan-1", userId: "user-1" });
  assert.deepEqual(
    calls.slice(1).map((call) => call.filter),
    [
      { userId: "user-1", planId: "plan-1" },
      { userId: "user-1", planId: "plan-1" },
      { userId: "user-1", planId: "plan-1" },
      { userId: "user-1", planId: "plan-1" },
    ],
  );
  assert.ok(calls.every((call) => call.session === session));
});

test("festival feed uses future country/subdivision dates and rejects cross-country regions", async () => {
  const previousFetch = globalThis.fetch;
  clearFestivalDateCache();
  const date = `${new Date().getUTCFullYear() + 1}-10-15`;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/IN\/\d{4}$/);
    return new Response(
      JSON.stringify([
        {
          date,
          name: "Diwali",
          localName: "Deepavali",
          countryCode: "IN",
          nationalHoliday: false,
          subdivisionCodes: ["IN-MH"],
          types: ["Public"],
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const response = await request(app)
      .get("/api/events/festivals?country=IN&region=IN-MH")
      .expect(200);
    const diwali = response.body.data.find((item) => item.name === "Diwali");
    assert.equal(diwali.nextDate, date);
    assert.equal(diwali.dateSource, "Nager.Date country/region calendar");
    assert.match(diwali.confidence, /region calendar/);
    await request(app)
      .get("/api/events/festivals?country=IN&region=US-CA")
      .expect(400);
  } finally {
    globalThis.fetch = previousFetch;
    clearFestivalDateCache();
  }
});

test("AI fallback guidance distinguishes credentials and quota errors without echoing them", () => {
  assert.match(
    explainGeminiFailure({ status: 401 }, "gemini-3.8-flash"),
    /API key/,
  );
  assert.match(
    explainGeminiFailure({ status: 429 }, "gemini-3.8-flash"),
    /quota/,
  );
  const error = explainGeminiFailure(
    new Error("private test detail"),
    "gemini-3.8-flash",
  );
  assert.doesNotMatch(error, /private test detail/);
});
