import mongoose from "mongoose";

const { Schema, model, models } = mongoose;
const schema = new Schema(
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
    name: { type: String, required: true, trim: true, maxlength: 140 },
    category: {
      type: String,
      enum: [
        "venue",
        "catering",
        "photography",
        "decoration",
        "entertainment",
        "other",
      ],
      default: "venue",
    },
    city: { type: String, trim: true, maxlength: 100 },
    capacity: { type: Number, min: 1, max: 50000 },
    estimatedCost: { type: Number, min: 0, max: 100000000 },
    currency: { type: String, match: /^[A-Z]{3}$/ },
    contact: { type: String, trim: true, maxlength: 200 },
    link: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, maxlength: 1000 },
    source: {
      type: String,
      enum: ["manual", "verified-provider"],
      default: "manual",
    },
  },
  { timestamps: true },
);
schema.index({ userId: 1, planId: 1, createdAt: -1 });
export const VenueOption = models.VenueOption || model("VenueOption", schema);
