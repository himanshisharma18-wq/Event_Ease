import { AppError } from "./errors.js";
import { databaseReady } from "../config/database.js";

export function ownerQuery(userId, filters = {}) {
  return { ...filters, userId };
}

export function requireDatabase(req, res, next) {
  if (!databaseReady())
    return next(
      new AppError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Connect MongoDB Atlas by setting MONGODB_URI in your local .env to enable accounts and durable saved plans.",
      ),
    );
  if (!process.env.SESSION_SECRET)
    return next(
      new AppError(
        503,
        "SESSION_SECRET_REQUIRED",
        "Set a long, private SESSION_SECRET before enabling accounts in production.",
      ),
    );
  next();
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId)
    return next(
      new AppError(
        401,
        "AUTH_REQUIRED",
        "Sign in to use this saved workspace.",
      ),
    );
  next();
}
