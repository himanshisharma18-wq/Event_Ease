import { EventPlan } from "../models/index.js";
import { AppError } from "../middleware/errors.js";

export const planNotFound = () =>
  new AppError(
    404,
    "PLAN_NOT_FOUND",
    "We could not find that plan in your account.",
  );

// Throws a 404 unless the plan exists and belongs to the user.
export async function assertPlanOwner(userId, planId) {
  const owned = await EventPlan.exists({ _id: planId, userId });
  if (!owned) throw planNotFound();
}
