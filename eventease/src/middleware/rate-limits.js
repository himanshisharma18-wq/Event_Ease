import { rateLimit } from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: "AUTH_RATE_LIMIT",
      message: "Too many sign-in attempts. Wait a little and try again.",
    },
  },
});
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: "PLANNER_RATE_LIMIT",
      message: "Please wait a moment before generating another plan.",
    },
  },
});
