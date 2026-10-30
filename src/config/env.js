// Single place for environment-derived settings. These are functions (not
// constants) so tests and late-loaded .env files are always respected.
export const SESSION_COOKIE_NAME = "eventease.sid";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const isProduction = () => process.env.NODE_ENV === "production";

export const secureCookiesEnabled = () =>
  process.env.PREVIEW_SECURE_COOKIE === "true" || isProduction();

export const sessionCookieOptions = () => {
  const secure = secureCookiesEnabled();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
};

export const eventsProviderConfigured = () =>
  Boolean(process.env.EVENTS_API_KEY && process.env.EVENTS_API_BASE_URL);

export const geminiModel = () =>
  process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
