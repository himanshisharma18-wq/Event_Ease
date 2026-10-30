import { randomBytes } from "node:crypto";

export const CSRF_HEADER = "X-CSRF-Token";
export const newCsrfToken = () => randomBytes(32).toString("base64url");

// Rotates the session id (prevents fixation), stores the signed-in user and
// issues a fresh CSRF token on the response.
export async function startUserSession(req, res, user) {
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.userId = String(user._id);
  req.session.userName = user.name;
  req.session.csrfToken = newCsrfToken();
  res.setHeader(CSRF_HEADER, req.session.csrfToken);
}
