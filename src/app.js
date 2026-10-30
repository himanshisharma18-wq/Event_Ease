import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import planRoutes from "./routes/plans.js";
import resourceRoutes from "./routes/resources.js";
import venueRoutes from "./routes/venues.js";
import { databaseReady } from "./config/database.js";
import { authLimiter, aiLimiter } from "./middleware/rate-limits.js";
import { errorHandler } from "./middleware/errors.js";
import { csrfProtection } from "./middleware/csrf.js";
import { curatedEvents } from "./services/seed-events.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  eventsProviderConfigured,
  geminiModel,
  isProduction,
  secureCookiesEnabled,
} from "./config/env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, "../public");
const sessionSecret =
  process.env.SESSION_SECRET || randomBytes(48).toString("base64url");

function databaseState() {
  if (databaseReady()) return "connected";
  return process.env.MONGODB_URI ? "unavailable" : "not-configured";
}

function describeEventData() {
  if (eventsProviderConfigured())
    return "Curated and configured provider listings; community listings require an account";
  return databaseReady()
    ? "Curated demo and community-created listings"
    : "Curated demo listings only; community submissions need a configured account";
}

function buildStatus() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  return {
    accounts: databaseReady() && Boolean(process.env.SESSION_SECRET),
    sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
    databaseConfigured: Boolean(process.env.MONGODB_URI),
    databaseReady: databaseReady(),
    geminiConfigured,
    geminiAccess: geminiConfigured
      ? "Configured; model access is confirmed only when a plan is generated"
      : "Not configured; the local planning guide is used",
    geminiModel: geminiConfigured ? geminiModel() : null,
    eventProviderConfigured: eventsProviderConfigured(),
    eventData: describeEventData(),
    seededEventCount: curatedEvents.length,
  };
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      frameguard: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          formAction: ["'self'"],
          frameAncestors: null,
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "https://unpkg.com"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: isProduction() ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin: process.env.CLIENT_BASE_URL || false,
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  const secureCookie = secureCookiesEnabled();
  const sessionOptions = {
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite: secureCookie ? "none" : "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    },
  };
  if (databaseReady())
    sessionOptions.store = MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: "sessions",
      ttl: SESSION_MAX_AGE_MS / 1000,
    });
  app.use(session(sessionOptions));
  app.use("/api", csrfProtection);

  app.get("/api/health", (req, res) =>
    res.json({ ok: true, data: { status: "ok", database: databaseState() } }),
  );
  app.get("/api/status", (req, res) =>
    res.json({ ok: true, data: buildStatus() }),
  );

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/plans/generate", aiLimiter);
  app.use("/api/plans", planRoutes);
  app.use("/api", venueRoutes);
  app.use("/api", resourceRoutes);

  app.use("/api", (req, res) =>
    res.status(404).json({
      ok: false,
      error: {
        code: "API_NOT_FOUND",
        message: "We could not find that endpoint.",
      },
    }),
  );
  app.use(
    express.static(publicRoot, {
      extensions: ["html"],
      maxAge: isProduction() ? "1h" : 0,
      etag: true,
    }),
  );
  app.get("*splat", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(
      path.join(publicRoot, "index.html"),
      (error) => error && next(error),
    );
  });
  app.use(errorHandler);
  return app;
}
