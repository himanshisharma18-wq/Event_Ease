import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { searchEvents } from "../services/events.js";
import { getFestivalGuides } from "../services/festival-dates.js";
import { curatedEvents } from "../services/seed-events.js";
import { Event } from "../models/index.js";
import { databaseReady } from "../config/database.js";
import { eventsProviderConfigured } from "../config/env.js";
import { requireAuth, requireDatabase } from "../middleware/auth.js";
import { AppError, validate } from "../middleware/errors.js";
import { toPublic } from "../utils/serializers.js";

const router = Router();

const listQuerySchema = z.object({
  q: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  category: z.string().max(60).optional(),
  format: z.enum(["in-person", "online"]).optional(),
  withinDays: z.coerce.number().int().min(1).max(365).optional(),
  price: z.enum(["free", "under500", "under1000"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  sort: z.enum(["date", "relevance", "popularity"]).default("date"),
});

const festivalQuerySchema = z
  .object({
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default("IN"),
    region: z
      .string()
      .regex(/^[A-Z]{2}-[A-Z0-9-]{1,8}$/)
      .optional()
      .default(""),
  })
  .refine(
    (value) => !value.region || value.region.startsWith(`${value.country}-`),
    {
      path: ["region"],
      message: "Choose a region that belongs to the selected country.",
    },
  );

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const createEventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  category: z.string().max(60),
  city: z.string().max(100),
  startsAt: z
    .string()
    .datetime()
    .refine(
      (value) => new Date(value) >= new Date(),
      "Choose a future event date.",
    ),
  venue: z.string().max(160).default(""),
  organizer: z.string().trim().max(120).default(""),
  price: z.string().trim().max(100).default(""),
  link: z
    .string()
    .max(500)
    .default("")
    .refine(isHttpUrl, "Only HTTP and HTTPS event links are supported."),
  description: z.string().max(2000).default(""),
  format: z.enum(["in-person", "online"]).default("in-person"),
});

const finitePopularity = (event) =>
  Number.isFinite(event.popularity) ? event.popularity : -1;

function sortEvents(events, { sort, q }) {
  if (sort === "relevance" && q) {
    const needle = q.toLowerCase();
    const score = (event) => Number(event.title.toLowerCase().includes(needle));
    events.sort((a, b) => score(b) - score(a));
  } else if (sort === "popularity") {
    events.sort((a, b) => finitePopularity(b) - finitePopularity(a));
  }
}

function listingSource() {
  if (eventsProviderConfigured()) return "curated-and-configured-provider";
  return databaseReady() ? "curated-and-user-created" : "curated-only";
}

router.get("/", validate(listQuerySchema, "query"), async (req, res) => {
  const query = req.query;
  const events = await searchEvents(query);
  sortEvents(events, query);
  const offset = (query.page - 1) * query.limit;
  res.json({
    ok: true,
    data: events.slice(offset, offset + query.limit),
    meta: {
      page: query.page,
      limit: query.limit,
      total: events.length,
      hasMore: offset + query.limit < events.length,
      popularityAvailable: events.some((event) =>
        Number.isFinite(event.popularity),
      ),
      source: listingSource(),
      communityListingsEnabled:
        databaseReady() && Boolean(process.env.SESSION_SECRET),
      liveProviderConfigured: eventsProviderConfigured(),
    },
  });
});

router.get(
  "/festivals",
  validate(festivalQuerySchema, "query"),
  async (req, res) => {
    const { country, region } = req.query;
    const data = await getFestivalGuides({ countryCode: country, region });
    res.json({ ok: true, data });
  },
);

router.post(
  "/",
  requireDatabase,
  requireAuth,
  validate(createEventSchema),
  async (req, res) => {
    const event = await Event.create({
      ...req.body,
      createdBy: req.session.userId,
      source: "user-created",
    });
    res.status(201).json({
      ok: true,
      data: { ...toPublic(event, ["createdBy", "__v"]), id: String(event._id) },
    });
  },
);

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const curated = curatedEvents.find((event) => event.id === id);
  if (curated) return res.json({ ok: true, data: curated });

  if (databaseReady() && mongoose.isObjectIdOrHexString(id)) {
    const event = await Event.findOne({
      _id: id,
      source: { $in: ["user-created", "verified-external"] },
    }).lean();
    if (event)
      return res.json({
        ok: true,
        data: { ...toPublic(event, ["createdBy"]), id: String(event._id) },
      });
  }

  // Provider-hosted events only exist in the provider's search results.
  if (eventsProviderConfigured()) {
    const external = (await searchEvents({})).find((event) => event.id === id);
    if (external) return res.json({ ok: true, data: external });
  }

  throw new AppError(
    404,
    "EVENT_NOT_FOUND",
    "This event is no longer available.",
  );
});

export default router;
