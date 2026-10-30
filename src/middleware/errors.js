import { isProduction } from "../config/env.js";

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const formatIssues = (error) =>
  error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");

// Validates req[source] with a zod schema and replaces it with the parsed
// value. Works for "query" too: in Express 5 req.query is a getter-only
// property, so it has to be redefined instead of assigned.
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success)
      return next(
        new AppError(400, "VALIDATION_ERROR", formatIssues(result.error)),
      );
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  const message =
    error instanceof AppError || status < 500
      ? error.message
      : "Something went wrong on our side. Please try again.";
  // Full stack outside production so failures are debuggable.
  if (status >= 500)
    console.error("Request failed:", isProduction() ? error.name : error);
  res.status(status).json({
    ok: false,
    error: { code: error.code || "INTERNAL_ERROR", message },
  });
}
