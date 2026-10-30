import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import {
  EventPlan,
  Expense,
  Guest,
  Task,
  VenueOption,
} from "../models/index.js";
import {
  requireAuth,
  requireDatabase,
  ownerQuery,
} from "../middleware/auth.js";
import { validate } from "../middleware/errors.js";
import { objectIdParam } from "../middleware/object-id.js";
import { plannerInputSchema, planSchema } from "../validators/planner.js";
import { generatePlan } from "../services/planner.js";
import { removePlanAndChildren } from "../services/plan-deletion.js";
import { planNotFound } from "../services/plan-access.js";
import { toPublic } from "../utils/serializers.js";

const router = Router();
router.param("id", objectIdParam);

const PLAN_SECTIONS = Object.keys(planSchema.shape);
const HIDDEN_FIELDS = "-userId -__v";
const money = z.coerce.number().min(0).max(100000000);
const guestCount = z.coerce.number().int().min(1).max(50000);
const currency = z.string().regex(/^[A-Z]{3}$/);

export const savedPlanCreateSchema = z.object({
  title: z.string().trim().min(2).max(140),
  eventType: z.string().trim().min(2).max(60),
  city: z.string().max(100).default(""),
  startsAt: z.string().optional().default(""),
  guests: guestCount,
  budget: money,
  currency,
  plan: planSchema,
  input: plannerInputSchema,
  completed: z.array(z.string().max(160)).max(300).default([]),
});

// Fields that must be updated together with the full planner input.
const INPUT_BOUND_FIELDS = [
  "eventType",
  "city",
  "startsAt",
  "guests",
  "budget",
  "currency",
];

export const savedPlanPatchSchema = z
  .object({
    title: z.string().trim().min(2).max(140).optional(),
    eventType: z.string().trim().min(2).max(60).optional(),
    city: z.string().trim().max(100).optional(),
    startsAt: z
      .string()
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value === "" ||
          (!Number.isNaN(new Date(value).valueOf()) &&
            new Date(value) >= new Date()),
        "Choose a current or future event date.",
      ),
    guests: guestCount.optional(),
    plan: planSchema.optional(),
    input: plannerInputSchema.optional(),
    completed: z.array(z.string().max(160)).max(300).optional(),
    budget: money.optional(),
    currency: currency.optional(),
  })
  .refine((value) => Object.keys(value).length > 0)
  .refine(
    (value) =>
      !INPUT_BOUND_FIELDS.some((key) => Object.hasOwn(value, key)) ||
      Object.hasOwn(value, "input"),
    "Include the matching complete planner input when updating event details, budget, or currency.",
  );

const sectionRequestSchema = z.object({
  input: plannerInputSchema,
  section: z.enum(PLAN_SECTIONS),
});

router.post("/generate", validate(plannerInputSchema), async (req, res) => {
  res.json({ ok: true, data: await generatePlan(req.body) });
});

// Note: this still generates the whole plan and returns one section of it.
router.post(
  "/generate/section",
  validate(sectionRequestSchema),
  async (req, res) => {
    const { input, section } = req.body;
    const result = await generatePlan(input);
    res.json({
      ok: true,
      data: {
        section,
        value: result.plan[section],
        source: result.source,
        note: result.note,
      },
    });
  },
);

router.get("/", requireDatabase, requireAuth, async (req, res) => {
  const plans = await EventPlan.find(ownerQuery(req.session.userId))
    .select(HIDDEN_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  res.json({ ok: true, data: plans });
});

router.post(
  "/",
  requireDatabase,
  requireAuth,
  validate(savedPlanCreateSchema),
  async (req, res) => {
    const plan = await EventPlan.create({
      ...req.body,
      userId: req.session.userId,
      startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
    });
    res.status(201).json({ ok: true, data: toPublic(plan) });
  },
);

router.get("/:id", requireDatabase, requireAuth, async (req, res) => {
  const plan = await EventPlan.findOne(
    ownerQuery(req.session.userId, { _id: req.params.id }),
  ).select(HIDDEN_FIELDS);
  if (!plan) throw planNotFound();
  res.json({ ok: true, data: toPublic(plan) });
});

router.patch(
  "/:id",
  requireDatabase,
  requireAuth,
  validate(savedPlanPatchSchema),
  async (req, res) => {
    const updates = { ...req.body };
    if (Object.hasOwn(updates, "startsAt"))
      updates.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
    const plan = await EventPlan.findOneAndUpdate(
      ownerQuery(req.session.userId, { _id: req.params.id }),
      { $set: updates },
      { new: true, runValidators: true },
    ).select(HIDDEN_FIELDS);
    if (!plan) throw planNotFound();
    res.json({ ok: true, data: toPublic(plan) });
  },
);

router.delete("/:id", requireDatabase, requireAuth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let deleted = false;
    await session.withTransaction(async () => {
      deleted = await removePlanAndChildren({
        planModel: EventPlan,
        childModels: [Guest, Expense, Task, VenueOption],
        userId: req.session.userId,
        planId: req.params.id,
        session,
      });
    });
    if (!deleted) throw planNotFound();
    res.json({ ok: true, data: { deleted: true } });
  } finally {
    await session.endSession();
  }
});

export default router;
