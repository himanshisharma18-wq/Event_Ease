import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { User, SavedEvent } from "../models/index.js";
import {
  requireAuth,
  requireDatabase,
  ownerQuery,
} from "../middleware/auth.js";
import { validate } from "../middleware/errors.js";

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(90),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});
const profileSchema = z.object({ name: z.string().trim().min(2).max(90) });
const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
});

router.get("/me", (req, res) =>
  res.json({
    ok: true,
    data: {
      user: req.session?.userId
        ? { id: req.session.userId, name: req.session.userName }
        : null,
      databaseConfigured: Boolean(
        process.env.MONGODB_URI && process.env.SESSION_SECRET,
      ),
    },
  }),
);
router.post(
  "/register",
  requireDatabase,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const email = req.body.email.toLowerCase();
      if (await User.exists({ email }))
        return res.status(409).json({
          ok: false,
          error: {
            code: "ACCOUNT_EXISTS",
            message: "An account with this email already exists.",
          },
        });
      const user = await User.create({
        name: req.body.name,
        email,
        passwordHash: await bcrypt.hash(req.body.password, 12),
      });
      await new Promise((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
      req.session.userId = String(user._id);
      req.session.userName = user.name;
      req.session.csrfToken = randomBytes(32).toString("base64url");
      res.setHeader("X-CSRF-Token", req.session.csrfToken);
      res.status(201).json({ ok: true, data: { user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/login",
  requireDatabase,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const user = await User.findOne({
        email: req.body.email.toLowerCase(),
      }).select("+passwordHash");
      if (
        !user ||
        !(await bcrypt.compare(req.body.password, user.passwordHash))
      )
        return res.status(401).json({
          ok: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "That email and password do not match.",
          },
        });
      await new Promise((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
      );
      req.session.userId = String(user._id);
      req.session.userName = user.name;
      req.session.csrfToken = randomBytes(32).toString("base64url");
      res.setHeader("X-CSRF-Token", req.session.csrfToken);
      res.json({ ok: true, data: { user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  },
);
router.post("/logout", (req, res, next) =>
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("eventease.sid", {
      httpOnly: true,
      sameSite:
        process.env.PREVIEW_SECURE_COOKIE === "true" ||
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      secure:
        process.env.PREVIEW_SECURE_COOKIE === "true" ||
        process.env.NODE_ENV === "production",
      path: "/",
    });
    res.json({ ok: true, data: { loggedOut: true } });
  }),
);
router.patch(
  "/profile",
  requireDatabase,
  requireAuth,
  validate(profileSchema),
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.session.userId,
        { name: req.body.name },
        { new: true, runValidators: true },
      );
      if (!user)
        return res.status(404).json({
          ok: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Your account could not be found.",
          },
        });
      req.session.userName = user.name;
      res.json({ ok: true, data: { user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/saved", requireDatabase, requireAuth, async (req, res, next) => {
  try {
    res.json({
      ok: true,
      data: await SavedEvent.find(ownerQuery(req.session.userId))
        .select("eventId")
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/saved",
  requireDatabase,
  requireAuth,
  validate(z.object({ eventId: z.string().min(1).max(120) })),
  async (req, res, next) => {
    try {
      const saved = await SavedEvent.findOneAndUpdate(
        ownerQuery(req.session.userId, { eventId: req.body.eventId }),
        {
          $setOnInsert: ownerQuery(req.session.userId, {
            eventId: req.body.eventId,
          }),
        },
        { upsert: true, new: true },
      );
      res.status(201).json({
        ok: true,
        data: { eventId: saved.eventId },
      });
    } catch (error) {
      next(error);
    }
  },
);
router.delete(
  "/saved/:eventId",
  requireDatabase,
  requireAuth,
  async (req, res, next) => {
    try {
      await SavedEvent.deleteOne(
        ownerQuery(req.session.userId, { eventId: req.params.eventId }),
      );
      res.json({ ok: true, data: { removed: true } });
    } catch (error) {
      next(error);
    }
  },
);
export default router;
