import mongoose from "mongoose";

const { Schema, model, models } = mongoose;
const options = { timestamps: true };
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 90 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  options,
);
const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, index: true },
    city: { type: String, index: true },
    country: String,
    startsAt: { type: Date, index: true },
    venue: String,
    price: String,
    format: {
      type: String,
      enum: ["in-person", "online"],
      default: "in-person",
    },
    description: String,
    image: String,
    popularity: { type: Number, min: 0 },
    source: {
      type: String,
      enum: ["curated", "user-created", "verified-external"],
      default: "user-created",
    },
    organizer: String,
    link: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  options,
);
eventSchema.index({
  title: "text",
  city: "text",
  category: "text",
  description: "text",
});
const planSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    eventType: { type: String, required: true },
    city: String,
    startsAt: Date,
    guests: { type: Number, min: 1, max: 50000 },
    budget: { type: Number, min: 0 },
    currency: { type: String, default: "INR" },
    plan: { type: Schema.Types.Mixed, required: true },
    input: { type: Schema.Types.Mixed, required: true },
    completed: { type: [String], default: [] },
  },
  options,
);
const savedEventSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: { type: String, required: true },
  },
  options,
);
savedEventSchema.index({ userId: 1, eventId: 1 }, { unique: true });
const guestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "EventPlan",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "declined"],
      default: "pending",
    },
    dietaryNotes: { type: String, maxlength: 500 },
    specialRequirements: { type: String, maxlength: 500 },
  },
  options,
);
const expenseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "EventPlan",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: [
        "venue",
        "food",
        "decoration",
        "entertainment",
        "travel",
        "gifts",
        "miscellaneous",
      ],
      default: "miscellaneous",
    },
    estimated: { type: Number, min: 0, default: 0 },
    actual: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
  },
  options,
);
const taskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "EventPlan",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    dueAt: Date,
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    category: { type: String, default: "General", maxlength: 60 },
    done: { type: Boolean, default: false },
    startsAt: Date,
    endsAt: Date,
  },
  options,
);
export const User = models.User || model("User", userSchema);
export const Event = models.Event || model("Event", eventSchema);
export const EventPlan = models.EventPlan || model("EventPlan", planSchema);
export const SavedEvent =
  models.SavedEvent || model("SavedEvent", savedEventSchema);
export const Guest = models.Guest || model("Guest", guestSchema);
export const Expense = models.Expense || model("Expense", expenseSchema);
export const Task = models.Task || model("Task", taskSchema);
export { VenueOption } from "./venue-option.js";
