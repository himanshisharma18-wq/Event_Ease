import { Router } from "express";
import { z } from "zod";
import { Guest, Expense, Task, EventPlan } from "../models/index.js";
import { requireAuth, requireDatabase } from "../middleware/auth.js";
import { validate } from "../middleware/errors.js";
import { objectIdParam } from "../middleware/object-id.js";

const router = Router();
router.param("planId", objectIdParam);
router.param("id", objectIdParam);
const publicResource = (row) => {
  const value =
    typeof row.toObject === "function" ? row.toObject() : { ...row };
  delete value.userId;
  delete value.planId;
  delete value.__v;
  return value;
};
const configs = {
  guests: {
    model: Guest,
    create: z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().email().max(254).optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
      status: z.enum(["pending", "confirmed", "declined"]).default("pending"),
      dietaryNotes: z.string().max(500).optional(),
      specialRequirements: z.string().max(500).optional(),
    }),
    patch: z.object({
      name: z.string().trim().min(1).max(100).optional(),
      email: z.string().email().max(254).optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
      status: z.enum(["pending", "confirmed", "declined"]).optional(),
      dietaryNotes: z.string().max(500).optional(),
      specialRequirements: z.string().max(500).optional(),
    }),
  },
  expenses: {
    model: Expense,
    create: z.object({
      title: z.string().trim().min(1).max(120),
      category: z
        .enum([
          "venue",
          "food",
          "decoration",
          "entertainment",
          "travel",
          "gifts",
          "miscellaneous",
        ])
        .default("miscellaneous"),
      estimated: z.coerce.number().min(0).max(100000000),
      actual: z.coerce.number().min(0).max(100000000).default(0),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default("INR"),
    }),
    patch: z.object({
      title: z.string().trim().min(1).max(120).optional(),
      category: z
        .enum([
          "venue",
          "food",
          "decoration",
          "entertainment",
          "travel",
          "gifts",
          "miscellaneous",
        ])
        .optional(),
      estimated: z.coerce.number().min(0).max(100000000).optional(),
      actual: z.coerce.number().min(0).max(100000000).optional(),
    }),
  },
  tasks: {
    model: Task,
    create: z.object({
      title: z.string().trim().min(2).max(180),
      dueAt: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      category: z.string().max(60).default("General"),
      done: z.boolean().default(false),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    }),
    patch: z.object({
      title: z.string().trim().min(2).max(180).optional(),
      dueAt: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      category: z.string().max(60).optional(),
      done: z.boolean().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    }),
  },
};

router.use(requireDatabase, requireAuth);
for (const [name, config] of Object.entries(configs)) {
  const path = `/plans/:planId/${name}`;
  router.get(path, async (req, res, next) => {
    try {
      const plan = await EventPlan.exists({
        _id: req.params.planId,
        userId: req.session.userId,
      });
      if (!plan)
        return res.status(404).json({
          ok: false,
          error: {
            code: "PLAN_NOT_FOUND",
            message: "We could not find that plan in your account.",
          },
        });
      const rows = await config.model
        .find({ planId: req.params.planId, userId: req.session.userId })
        .select("-userId -planId -__v")
        .sort({ createdAt: -1 })
        .lean();
      res.json({ ok: true, data: rows });
    } catch (error) {
      next(error);
    }
  });
  router.post(path, validate(config.create), async (req, res, next) => {
    try {
      const plan = await EventPlan.exists({
        _id: req.params.planId,
        userId: req.session.userId,
      });
      if (!plan)
        return res.status(404).json({
          ok: false,
          error: {
            code: "PLAN_NOT_FOUND",
            message: "We could not find that plan in your account.",
          },
        });
      const row = await config.model.create({
        ...req.body,
        userId: req.session.userId,
        planId: req.params.planId,
      });
      res.status(201).json({ ok: true, data: publicResource(row) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    `${path}/:id`,
    validate(config.patch),
    async (req, res, next) => {
      try {
        const row = await config.model.findOneAndUpdate(
          {
            _id: req.params.id,
            planId: req.params.planId,
            userId: req.session.userId,
          },
          { $set: req.body },
          { new: true, runValidators: true },
        );
        if (!row)
          return res.status(404).json({
            ok: false,
            error: {
              code: "RESOURCE_NOT_FOUND",
              message: "That item is not in this plan.",
            },
          });
        res.json({ ok: true, data: publicResource(row) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(`${path}/:id`, async (req, res, next) => {
    try {
      const row = await config.model.findOneAndDelete({
        _id: req.params.id,
        planId: req.params.planId,
        userId: req.session.userId,
      });
      if (!row)
        return res.status(404).json({
          ok: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "That item is not in this plan.",
          },
        });
      res.json({ ok: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  });
}
export default router;
