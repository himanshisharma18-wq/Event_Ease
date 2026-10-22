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

const router = Router();
router.param("id", objectIdParam);
const safePlan = (record) => {
  const value =
    record && typeof record.toObject === "function"
      ? record.toObject()
      : { ...record };
  delete value.userId;
  delete value.__v;
  return value;
};

export const savedPlanCreateSchema = z.object({
  title: z.string().trim().min(2).max(140),
  eventType: z.string().trim().min(2).max(60),
  city: z.string().max(100).default(""),
  startsAt: z.string().optional().default(""),
  guests: z.coerce.number().int().min(1).max(50000),
  budget: z.coerce.number().min(0).max(100000000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  plan: planSchema,
  input: plannerInputSchema,
  completed: z.array(z.string().max(160)).max(300).default([]),
});

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
    guests: z.coerce.number().int().min(1).max(50000).optional(),
    plan: planSchema.optional(),
    input: plannerInputSchema.optional(),
    completed: z.array(z.string().max(160)).max(300).optional(),
    budget: z.coerce.number().min(0).max(100000000).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0)
  .refine(
    (value) =>
      !["eventType", "city", "startsAt", "guests", "budget", "currency"].some(
        (key) => Object.hasOwn(value, key),
      ) || Object.hasOwn(value, "input"),
    "Include the matching complete planner input when updating event details, budget, or currency.",
  );

router.post(
  "/generate",
  validate(plannerInputSchema),
  async (req, res, next) => {
    try {
      const result = await generatePlan(req.body);
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/generate/section",
  validate(
    z.object({
      input: plannerInputSchema,
      section: z.enum([
        "concept",
        "venue",
        "food",
        "entertainment",
        "schedule",
        "budget",
        "guestChecklist",
        "shoppingList",
        "preparationTimeline",
        "contingencies",
        "sustainableAlternatives",
      ]),
    }),
  ),
  async (req, res, next) => {
    try {
      const result = await generatePlan(req.body.input);
      res.json({
        ok: true,
        data: {
          section: req.body.section,
          value: result.plan[req.body.section],
          source: result.source,
          note: result.note,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/", requireDatabase, requireAuth, async (req, res, next) => {
  try {
    const plans = await EventPlan.find(ownerQuery(req.session.userId))
      .select("-userId -__v")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    res.json({ ok: true, data: plans });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/",
  requireDatabase,
  requireAuth,
  validate(savedPlanCreateSchema),
  async (req, res, next) => {
    try {
      const plan = await EventPlan.create({
        ...req.body,
        userId: req.session.userId,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
      });
      res.status(201).json({ ok: true, data: safePlan(plan) });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/:id", requireDatabase, requireAuth, async (req, res, next) => {
  try {
    const plan = await EventPlan.findOne(
      ownerQuery(req.session.userId, { _id: req.params.id }),
    ).select("-userId -__v");
    if (!plan)
      return res.status(404).json({
        ok: false,
        error: {
          code: "PLAN_NOT_FOUND",
          message: "We could not find that plan in your account.",
        },
      });
    res.json({ ok: true, data: safePlan(plan) });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/:id",
  requireDatabase,
  requireAuth,
  validate(savedPlanPatchSchema),
  async (req, res, next) => {
    try {
      const updates = { ...req.body };
      if (Object.hasOwn(updates, "startsAt"))
        updates.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
      const plan = await EventPlan.findOneAndUpdate(
        ownerQuery(req.session.userId, { _id: req.params.id }),
        { $set: updates },
        { new: true, runValidators: true },
      ).select("-userId -__v");
      if (!plan)
        return res.status(404).json({
          ok: false,
          error: {
            code: "PLAN_NOT_FOUND",
            message: "We could not find that plan in your account.",
          },
        });
      res.json({ ok: true, data: safePlan(plan) });
    } catch (error) {
      next(error);
    }
  },
);
router.delete("/:id", requireDatabase, requireAuth, async (req, res, next) => {
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
    if (!deleted)
      return res.status(404).json({
        ok: false,
        error: {
          code: "PLAN_NOT_FOUND",
          message: "We could not find that plan in your account.",
        },
      });
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});
export default router;
