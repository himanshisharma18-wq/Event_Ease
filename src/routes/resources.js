import { Router } from "express";
import { z } from "zod";
import { Guest, Expense, Task } from "../models/index.js";
import { requireAuth, requireDatabase } from "../middleware/auth.js";
import { AppError, validate } from "../middleware/errors.js";
import { objectIdParam } from "../middleware/object-id.js";
import { assertPlanOwner } from "../services/plan-access.js";
import { toPublic } from "../utils/serializers.js";

const router = Router();
router.param("planId", objectIdParam);
router.param("id", objectIdParam);

const HIDDEN_FIELDS = ["userId", "planId", "__v"];
const money = z.coerce.number().min(0).max(100000000);
const expenseCategories = [
  "venue",
  "food",
  "decoration",
  "entertainment",
  "travel",
  "gifts",
  "miscellaneous",
];

// Each resource defines its fields once (no defaults). Create adds required
// fields/defaults; patch makes every field optional. Keeping defaults out of
// the patch schema stops a PATCH from silently resetting untouched fields.
const guestShape = {
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  status: z.enum(["pending", "confirmed", "declined"]),
  dietaryNotes: z.string().max(500).optional(),
  specialRequirements: z.string().max(500).optional(),
};
const expenseShape = {
  title: z.string().trim().min(1).max(120),
  category: z.enum(expenseCategories),
  estimated: money,
  actual: money,
  currency: z.string().regex(/^[A-Z]{3}$/),
};
const taskShape = {
  title: z.string().trim().min(2).max(180),
  dueAt: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().max(60),
  done: z.boolean(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
};

const resources = {
  guests: {
    model: Guest,
    create: z.object({
      ...guestShape,
      status: guestShape.status.default("pending"),
    }),
    patch: z.object(guestShape).partial(),
  },
  expenses: {
    model: Expense,
    create: z.object({
      ...expenseShape,
      category: expenseShape.category.default("miscellaneous"),
      actual: expenseShape.actual.default(0),
      currency: expenseShape.currency.default("INR"),
    }),
    // Currency is fixed when an expense is created.
    patch: z.object(expenseShape).omit({ currency: true }).partial(),
  },
  tasks: {
    model: Task,
    create: z.object({
      ...taskShape,
      priority: taskShape.priority.default("medium"),
      category: taskShape.category.default("General"),
      done: taskShape.done.default(false),
    }),
    patch: z.object(taskShape).partial(),
  },
};

const itemNotFound = () =>
  new AppError(404, "RESOURCE_NOT_FOUND", "That item is not in this plan.");

for (const [name, { model, create, patch }] of Object.entries(resources)) {
  const collectionPath = `/plans/:planId/${name}`;
  const itemPath = `${collectionPath}/:id`;
  // Scoped to this resource so unknown /api paths still reach the 404 handler.
  router.use(collectionPath, requireDatabase, requireAuth);
  const scope = (req) => ({
    planId: req.params.planId,
    userId: req.session.userId,
  });

  router.get(collectionPath, async (req, res) => {
    await assertPlanOwner(req.session.userId, req.params.planId);
    const rows = await model
      .find(scope(req))
      .select("-userId -planId -__v")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, data: rows });
  });

  router.post(collectionPath, validate(create), async (req, res) => {
    await assertPlanOwner(req.session.userId, req.params.planId);
    const row = await model.create({ ...req.body, ...scope(req) });
    res.status(201).json({ ok: true, data: toPublic(row, HIDDEN_FIELDS) });
  });

  router.patch(itemPath, validate(patch), async (req, res) => {
    const row = await model.findOneAndUpdate(
      { _id: req.params.id, ...scope(req) },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!row) throw itemNotFound();
    res.json({ ok: true, data: toPublic(row, HIDDEN_FIELDS) });
  });

  router.delete(itemPath, async (req, res) => {
    const row = await model.findOneAndDelete({
      _id: req.params.id,
      ...scope(req),
    });
    if (!row) throw itemNotFound();
    res.json({ ok: true, data: { deleted: true } });
  });
}

export default router;
