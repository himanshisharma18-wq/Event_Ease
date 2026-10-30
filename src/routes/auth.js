import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, SavedEvent } from "../models/index.js";
import {
  requireAuth,
  requireDatabase,
  ownerQuery,
} from "../middleware/auth.js";
import { AppError, validate } from "../middleware/errors.js";
import { startUserSession } from "../services/session.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../config/env.js";

const router = Router();
const BCRYPT_ROUNDS = 12;

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
const savedEventSchema = z.object({ eventId: z.string().min(1).max(120) });

const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
});

// Compared against when the email is unknown so response time does not reveal
// which emails have accounts.
let dummyHash;
const getDummyHash = () =>
  (dummyHash ??= bcrypt.hash("not-a-real-password", BCRYPT_ROUNDS));

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
  async (req, res) => {
    const email = req.body.email.toLowerCase();
    const accountExists = new AppError(
      409,
      "ACCOUNT_EXISTS",
      "An account with this email already exists.",
    );
    if (await User.exists({ email })) throw accountExists;
    let user;
    try {
      user = await User.create({
        name: req.body.name,
        email,
        passwordHash: await bcrypt.hash(req.body.password, BCRYPT_ROUNDS),
      });
    } catch (error) {
      // Two simultaneous sign-ups can both pass the check above.
      if (error?.code === 11000) throw accountExists;
      throw error;
    }
    await startUserSession(req, res, user);
    res.status(201).json({ ok: true, data: { user: publicUser(user) } });
  },
);

router.post(
  "/login",
  requireDatabase,
  validate(loginSchema),
  async (req, res) => {
    const user = await User.findOne({
      email: req.body.email.toLowerCase(),
    }).select("+passwordHash");
    const passwordOk = await bcrypt.compare(
      req.body.password,
      user ? user.passwordHash : await getDummyHash(),
    );
    if (!user || !passwordOk)
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "That email and password do not match.",
      );
    await startUserSession(req, res, user);
    res.json({ ok: true, data: { user: publicUser(user) } });
  },
);

router.post("/logout", (req, res, next) =>
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    res.json({ ok: true, data: { loggedOut: true } });
  }),
);

router.patch(
  "/profile",
  requireDatabase,
  requireAuth,
  validate(profileSchema),
  async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { name: req.body.name },
      { new: true, runValidators: true },
    );
    if (!user)
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        "Your account could not be found.",
      );
    req.session.userName = user.name;
    res.json({ ok: true, data: { user: publicUser(user) } });
  },
);

router.get("/saved", requireDatabase, requireAuth, async (req, res) => {
  const saved = await SavedEvent.find(ownerQuery(req.session.userId))
    .select("eventId")
    .lean();
  res.json({ ok: true, data: saved });
});

router.post(
  "/saved",
  requireDatabase,
  requireAuth,
  validate(savedEventSchema),
  async (req, res) => {
    const filter = ownerQuery(req.session.userId, {
      eventId: req.body.eventId,
    });
    const saved = await SavedEvent.findOneAndUpdate(
      filter,
      { $setOnInsert: filter },
      { upsert: true, new: true },
    );
    res.status(201).json({ ok: true, data: { eventId: saved.eventId } });
  },
);

router.delete(
  "/saved/:eventId",
  requireDatabase,
  requireAuth,
  async (req, res) => {
    await SavedEvent.deleteOne(
      ownerQuery(req.session.userId, { eventId: req.params.eventId }),
    );
    res.json({ ok: true, data: { removed: true } });
  },
);

export default router;
