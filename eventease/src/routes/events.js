import { Router } from "express";
import { searchEvents } from "../services/events.js";
import { getFestivalGuides } from "../services/festival-dates.js";
import { Event } from "../models/index.js";
import { databaseReady } from "../config/database.js";
import { requireAuth, requireDatabase } from "../middleware/auth.js";
import { validate } from "../middleware/errors.js";
import { z } from "zod";
import mongoose from "mongoose";

const router = Router();
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
router.get("/", async (req, res, next) => {
  try {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        category: z.string().max(60).optional(),
        format: z.enum(["in-person", "online"]).optional(),
        withinDays: z.coerce.number().int().min(1).max(365).optional(),
        price: z.enum(["free", "under500", "under1000"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(60).default(24),
        sort: z.enum(["date", "relevance", "popularity"]).default("date"),
      })
      .parse(req.query);
    const events = await searchEvents(q);
    if (q.sort === "relevance" && q.q)
      events.sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(q.q.toLowerCase())) -
          Number(a.title.toLowerCase().includes(q.q.toLowerCase())),
      );
    if (q.sort === "popularity")
      events.sort(
        (a, b) =>
          (Number.isFinite(b.popularity) ? b.popularity : -Infinity) -
          (Number.isFinite(a.popularity) ? a.popularity : -Infinity),
      );
    const offset = (q.page - 1) * q.limit;
    res.json({
      ok: true,
      data: events.slice(offset, offset + q.limit),
      meta: {
        page: q.page,
        limit: q.limit,
        total: events.length,
        hasMore: offset + q.limit < events.length,
        popularityAvailable: events.some(
          (event) =>
            typeof event.popularity === "number" &&
            Number.isFinite(event.popularity),
        ),
        source:
          process.env.EVENTS_API_KEY && process.env.EVENTS_API_BASE_URL
            ? "curated-and-configured-provider"
            : databaseReady()
              ? "curated-and-user-created"
              : "curated-only",
        communityListingsEnabled:
          databaseReady() && Boolean(process.env.SESSION_SECRET),
        liveProviderConfigured: Boolean(
          process.env.EVENTS_API_KEY && process.env.EVENTS_API_BASE_URL,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get("/festivals", async (req, res, next) => {
  try {
    const result = festivalQuerySchema.safeParse(req.query);
    if (!result.success)
      return res.status(400).json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: result.error.issues
            .map(
              (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
            )
            .join("; "),
        },
      });
    const { country, region } = result.data;
    const data = await getFestivalGuides({ countryCode: country, region });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/",
  requireDatabase,
  requireAuth,
  validate(
    z.object({
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
        .refine((value) => {
          if (!value) return true;
          try {
            return ["http:", "https:"].includes(new URL(value).protocol);
          } catch {
            return false;
          }
        }, "Only HTTP and HTTPS event links are supported."),
      description: z.string().max(2000).default(""),
      format: z.enum(["in-person", "online"]).default("in-person"),
    }),
  ),
  async (req, res, next) => {
    try {
      const event = await Event.create({
        ...req.body,
        createdBy: req.session.userId,
        source: "user-created",
      });
      const publicEvent = event.toObject();
      delete publicEvent.createdBy;
      delete publicEvent.__v;
      res
        .status(201)
        .json({ ok: true, data: { ...publicEvent, id: String(event._id) } });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/:id", async (req, res, next) => {
  try {
    const curated = (await searchEvents({})).find(
      (event) => event.id === req.params.id,
    );
    if (curated) return res.json({ ok: true, data: curated });
    if (databaseReady() && mongoose.isObjectIdOrHexString(req.params.id)) {
      const event = await Event.findOne({
        _id: req.params.id,
        source: { $in: ["user-created", "verified-external"] },
      }).lean();
      if (event) {
        const { createdBy, ...publicEvent } = event;
        return res.json({
          ok: true,
          data: { ...publicEvent, id: String(event._id) },
        });
      }
    }
    res.status(404).json({
      ok: false,
      error: {
        code: "EVENT_NOT_FOUND",
        message: "This event is no longer available.",
      },
    });
  } catch (error) {
    next(error);
  }
});
export default router;
