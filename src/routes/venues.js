import { Router } from "express";
import { z } from "zod";
import { VenueOption } from "../models/index.js";
import {
  requireAuth,
  requireDatabase,
  ownerQuery,
} from "../middleware/auth.js";
import { AppError, validate } from "../middleware/errors.js";
import { objectIdParam } from "../middleware/object-id.js";
import { assertPlanOwner } from "../services/plan-access.js";
import { searchVenueProvider } from "../services/venues.js";
import { toPublic } from "../utils/serializers.js";

const router = Router();
router.param("planId", objectIdParam);
router.param("id", objectIdParam);

const HIDDEN_FIELDS = ["userId", "planId", "__v"];
const categories = [
  "venue",
  "catering",
  "photography",
  "decoration",
  "entertainment",
  "other",
];
const capacity = z.coerce.number().int().min(1).max(50000);
const money = z.coerce.number().min(0).max(100000000);

// Defined without defaults so the same shape can be made partial for PATCH
// without resetting category/currency on every update.
const venueShape = {
  name: z.string().trim().min(2).max(140),
  category: z.enum(categories),
  city: z.string().max(100).optional(),
  capacity: capacity.optional(),
  estimatedCost: money.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  contact: z.string().max(200).optional(),
  link: z
    .string()
    .url()
    .max(500)
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value)),
  notes: z.string().max(1000).optional(),
};
const venueCreateSchema = z.object({
  ...venueShape,
  category: venueShape.category.default("venue"),
  currency: venueShape.currency.default("INR"),
});
const venuePatchSchema = z.object(venueShape).partial();

const venueSearchSchema = z.object({
  city: z.string().max(100).optional(),
  category: z.enum(categories).optional(),
  capacity: capacity.optional(),
  maxPrice: money.optional(),
});

const optionNotFound = () =>
  new AppError(
    404,
    "VENUE_OPTION_NOT_FOUND",
    "That manually entered option is not in this plan.",
  );

const manualOption = (req) =>
  ownerQuery(req.session.userId, {
    _id: req.params.id,
    planId: req.params.planId,
    source: "manual",
  });

router.get(
  "/venues/search",
  validate(venueSearchSchema, "query"),
  async (req, res) => {
    const result = await searchVenueProvider(req.query);
    res.json({
      ok: true,
      data: result.data,
      meta: { configured: result.configured, message: result.message },
    });
  },
);

router.use("/plans/:planId/venues", requireDatabase, requireAuth);

router.get("/plans/:planId/venues", async (req, res) => {
  await assertPlanOwner(req.session.userId, req.params.planId);
  const options = await VenueOption.find(
    ownerQuery(req.session.userId, { planId: req.params.planId }),
  )
    .select("-userId -planId -__v")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ ok: true, data: options });
});

router.post(
  "/plans/:planId/venues",
  validate(venueCreateSchema),
  async (req, res) => {
    await assertPlanOwner(req.session.userId, req.params.planId);
    const option = await VenueOption.create({
      ...req.body,
      source: "manual",
      userId: req.session.userId,
      planId: req.params.planId,
    });
    res.status(201).json({ ok: true, data: toPublic(option, HIDDEN_FIELDS) });
  },
);

router.patch(
  "/plans/:planId/venues/:id",
  validate(venuePatchSchema),
  async (req, res) => {
    const option = await VenueOption.findOneAndUpdate(
      manualOption(req),
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!option) throw optionNotFound();
    res.json({ ok: true, data: toPublic(option, HIDDEN_FIELDS) });
  },
);

router.delete("/plans/:planId/venues/:id", async (req, res) => {
  const option = await VenueOption.findOneAndDelete(manualOption(req));
  if (!option) throw optionNotFound();
  res.json({ ok: true, data: { deleted: true } });
});

export default router;
