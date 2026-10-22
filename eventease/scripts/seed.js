import "dotenv/config";
import mongoose from "mongoose";
import { Event } from "../src/models/index.js";
import { curatedEvents } from "../src/services/seed-events.js";

if (!process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI in .env before seeding.");
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const event of curatedEvents) {
      await Event.updateOne(
        { title: event.title, source: "curated" },
        { $set: { ...event, source: "curated" } },
        { upsert: true },
      );
    }
    console.log(
      `Seeded ${curatedEvents.length} clearly labeled curated sample events.`,
    );
  } catch (error) {
    console.error("Seed failed:", error.name || "database error");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
