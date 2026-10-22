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

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, "../public");
const sessionSecret =
  process.env.SESSION_SECRET || randomBytes(48).toString("base64url");
const securePreview = process.env.PREVIEW_SECURE_COOKIE === "true";
const secureCookie = securePreview || process.env.NODE_ENV === "production";

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
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
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
  const sessionOptions = {
    name: "eventease.sid",
    secret: sessionSecret || "missing-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite: secureCookie ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  };
  if (databaseReady())
    sessionOptions.store = MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60,
    });
  app.use(session(sessionOptions));
  app.use("/api", csrfProtection);

  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      data: {
        status: "ok",
        database: databaseReady()
          ? "connected"
          : process.env.MONGODB_URI
            ? "unavailable"
            : "not-configured",
      },
    }),
  );
  app.get("/api/status", (req, res) =>
    res.json({
      ok: true,
      data: {
        accounts: databaseReady() && Boolean(process.env.SESSION_SECRET),
        sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
        databaseConfigured: Boolean(process.env.MONGODB_URI),
        databaseReady: databaseReady(),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        geminiAccess: process.env.GEMINI_API_KEY
          ? "Configured; model access is confirmed only when a plan is generated"
          : "Not configured; the local planning guide is used",
        geminiModel: process.env.GEMINI_API_KEY
          ? process.env.GEMINI_MODEL || "gemini-3.8-flash"
          : null,
        eventProviderConfigured: Boolean(
          process.env.EVENTS_API_KEY && process.env.EVENTS_API_BASE_URL,
        ),
        eventData:
          process.env.EVENTS_API_KEY && process.env.EVENTS_API_BASE_URL
            ? "Curated and configured provider listings; community listings require an account"
            : databaseReady()
              ? "Curated demo and community-created listings"
              : "Curated demo listings only; community submissions need a configured account",
        seededEventCount: curatedEvents.length,
      },
    }),
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
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
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
