import mongoose from "mongoose";

export function objectIdParam(req, res, next, value) {
  if (!mongoose.isObjectIdOrHexString(value))
    return res.status(400).json({
      ok: false,
      error: {
        code: "INVALID_ID",
        message: "The requested record identifier is invalid.",
      },
    });
  next();
}
