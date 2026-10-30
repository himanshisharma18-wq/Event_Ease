import mongoose from "mongoose";
import { AppError } from "./errors.js";

export function objectIdParam(req, res, next, value) {
  if (!mongoose.isObjectIdOrHexString(value))
    return next(
      new AppError(
        400,
        "INVALID_ID",
        "The requested record identifier is invalid.",
      ),
    );
  next();
}
