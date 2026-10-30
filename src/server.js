import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { isProduction } from "./config/env.js";

const DEFAULT_PORT = 5000; // matches .env.example and the Dockerfile

const database = await connectDatabase();
if (!database.connected) {
  console.warn(
    database.reason === "missing_configuration"
      ? "MongoDB is not configured. Public curated discovery and fallback planning are available; sign-in and durable saves require MONGODB_URI."
      : "MongoDB is unavailable. Public discovery and fallback planning remain available; account routes will explain the current configuration issue.",
  );
}
if (isProduction() && !process.env.SESSION_SECRET)
  console.error(
    "SESSION_SECRET is missing. The site can load, but account actions remain unavailable until configured.",
  );

const port = Number(process.env.PORT) || DEFAULT_PORT;
const server = createApp().listen(port, "0.0.0.0", () =>
  console.log(`EventEase listening on port ${port}`),
);

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      if (mongoose.connection.readyState) await mongoose.disconnect();
      process.exit(0);
    }),
  );
