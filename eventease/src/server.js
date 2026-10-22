import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);


import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";

const database = await connectDatabase();
if (!database.connected) {
  console.warn(
    database.reason === "missing_configuration"
      ? "MongoDB is not configured. Public curated discovery and fallback planning are available; sign-in and durable saves require MONGODB_URI."
      : "MongoDB is unavailable. Public discovery and fallback planning remain available; account routes will explain the current configuration issue.",
  );
}
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET)
  console.error(
    "SESSION_SECRET is missing. The site can load, but account actions remain unavailable until configured.",
  );
const app = createApp();
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`EventEase listening on port ${port}`),
);

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      const { default: mongoose } = await import("mongoose");
      if (mongoose.connection.readyState) await mongoose.disconnect();
      process.exit(0);
    }),
  );
