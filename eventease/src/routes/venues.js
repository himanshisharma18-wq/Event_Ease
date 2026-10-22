import { Router } from "express";
import { z } from "zod";
import { VenueOption, EventPlan } from "../models/index.js";
import {
  requireAuth,
  requireDatabase,
  ownerQuery,
} from "../middleware/auth.js";
import { validate } from "../middleware/errors.js";
import { objectIdParam } from "../middleware/object-id.js";
import { searchVenueProvider } from "../services/venues.js";

const router = Router();
router.param("planId", objectIdParam);
router.param("id", objectIdParam);
const publicOption = (row) => {
  const value =
    typeof row.toObject === "function" ? row.toObject() : { ...row };
  delete value.userId;
  delete value.planId;
  delete value.__v;
  return value;
};
const categories = [
  "venue",
  "catering",
  "photography",
  "decoration",
  "entertainment",
  "other",
];
const venueInput = z.object({
  name: z.string().trim().min(2).max(140),
  category: z.enum(categories).default("venue"),
  city: z.string().max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(50000).optional(),
  estimatedCost: z.coerce.number().min(0).max(100000000).optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("INR"),
  contact: z.string().max(200).optional(),
  link: z
    .string()
    .url()
    .max(500)
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value)),
  notes: z.string().max(1000).optional(),
});

router.get("/venues/search", async (req, res, next) => {
  try {
    const filters = z
      .object({
        city: z.string().max(100).optional(),
        category: z.enum(categories).optional(),
        capacity: z.coerce.number().int().min(1).max(50000).optional(),
        maxPrice: z.coerce.number().min(0).max(100000000).optional(),
      })
      .parse(req.query);
    const result = await searchVenueProvider(filters);
    res.json({
      ok: true,
      data: result.data,
      meta: { configured: result.configured, message: result.message },
    });
  } catch (error) {
    next(error);
  }
});
router.use("/plans/:planId/venues", requireDatabase, requireAuth);
router.get("/plans/:planId/venues", async (req, res, next) => {
  try {
    const plan = await EventPlan.exists(
      ownerQuery(req.session.userId, { _id: req.params.planId }),
    );
    if (!plan)
      return res.status(404).json({
        ok: false,
        error: {
          code: "PLAN_NOT_FOUND",
          message: "We could not find that plan in your account.",
        },
      });
    const options = await VenueOption.find(
      ownerQuery(req.session.userId, { planId: req.params.planId }),
    )
      .select("-userId -planId -__v")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, data: options });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/plans/:planId/venues",
  validate(venueInput),
  async (req, res, next) => {
    try {
      const plan = await EventPlan.exists(
        ownerQuery(req.session.userId, { _id: req.params.planId }),
      );
      if (!plan)
        return res.status(404).json({
          ok: false,
          error: {
            code: "PLAN_NOT_FOUND",
            message: "We could not find that plan in your account.",
          },
        });
      const option = await VenueOption.create({
        ...req.body,
        source: "manual",
        userId: req.session.userId,
        planId: req.params.planId,
      });
      res.status(201).json({ ok: true, data: publicOption(option) });
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/plans/:planId/venues/:id",
  validate(venueInput.partial()),
  async (req, res, next) => {
    try {
      const option = await VenueOption.findOneAndUpdate(
        ownerQuery(req.session.userId, {
          _id: req.params.id,
          planId: req.params.planId,
          source: "manual",
        }),
        { $set: req.body },
        { new: true, runValidators: true },
      );
      if (!option)
        return res.status(404).json({
          ok: false,
          error: {
            code: "VENUE_OPTION_NOT_FOUND",
            message: "That manually entered option is not in this plan.",
          },
        });
      res.json({ ok: true, data: publicOption(option) });
    } catch (error) {
      next(error);
    }
  },
);
router.delete("/plans/:planId/venues/:id", async (req, res, next) => {
  try {
    const option = await VenueOption.findOneAndDelete(
      ownerQuery(req.session.userId, {
        _id: req.params.id,
        planId: req.params.planId,
        source: "manual",
      }),
    );
    if (!option)
      return res.status(404).json({
        ok: false,
        error: {
          code: "VENUE_OPTION_NOT_FOUND",
          message: "That manually entered option is not in this plan.",
        },
      });
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
export default router;
