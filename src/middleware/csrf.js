import { timingSafeEqual } from "node:crypto";
import { AppError } from "./errors.js";
import { CSRF_HEADER, newCsrfToken } from "../services/session.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function tokensMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function csrfProtection(req, res, next) {
  if (!req.session)
    return next(
      new AppError(
        500,
        "SESSION_UNAVAILABLE",
        "The request session could not be initialized.",
      ),
    );

  if (!WRITE_METHODS.has(req.method)) {
    // The client fetches its token from this endpoint on page load.
    if (req.method === "GET" && req.path === "/auth/me") {
      req.session.csrfToken ||= newCsrfToken();
      res.setHeader(CSRF_HEADER, req.session.csrfToken);
    }
    return next();
  }

  if (!tokensMatch(req.session.csrfToken, req.get(CSRF_HEADER)))
    return next(
      new AppError(
        403,
        "CSRF_VALIDATION_FAILED",
        "This request could not be verified. Refresh the page and try again.",
      ),
    );
  res.setHeader(CSRF_HEADER, req.session.csrfToken);
  next();
}
