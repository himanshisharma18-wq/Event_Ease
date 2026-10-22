import { randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors.js";

const writable = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfHeader = "X-CSRF-Token";

export function csrfProtection(req, res, next) {
  if (!req.session)
    return next(
      new AppError(
        500,
        "SESSION_UNAVAILABLE",
        "The request session could not be initialized.",
      ),
    );

  if (!writable.has(req.method)) {
    if (req.method === "GET" && req.path === "/auth/me") {
      if (!req.session.csrfToken)
        req.session.csrfToken = randomBytes(32).toString("base64url");
      res.setHeader(csrfHeader, req.session.csrfToken);
    }
    return next();
  }

  const expected = req.session.csrfToken;
  const supplied = req.get(csrfHeader);
  const expectedBytes = expected ? Buffer.from(expected) : Buffer.alloc(0);
  const suppliedBytes = supplied ? Buffer.from(supplied) : Buffer.alloc(0);
  const matches =
    expectedBytes.length > 0 &&
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
  if (!matches)
    return next(
      new AppError(
        403,
        "CSRF_VALIDATION_FAILED",
        "This request could not be verified. Refresh the page and try again.",
      ),
    );
  res.setHeader(csrfHeader, expected);
  next();
}
