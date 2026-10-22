export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success)
      return res.status(400).json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: result.error.issues
            .map(
              (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
            )
            .join("; "),
        },
      });
    req[source] = result.data;
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
  if (status >= 500) console.error("Request failed:", error.name || "Error");
  res.status(status).json({
    ok: false,
    error: { code: error.code || "INTERNAL_ERROR", message },
  });
}
