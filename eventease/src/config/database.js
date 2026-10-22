import mongoose from "mongoose";

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) return { connected: false, reason: "missing_configuration" };
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: process.env.NODE_ENV !== "production",
    });
    return { connected: true };
  } catch (error) {
    console.error(
      "MongoDB connection unavailable:",
      error.name || "connection error",
    );
    return { connected: false, reason: "connection_failed" };
  }
}

export function databaseReady() {
  return mongoose.connection.readyState === 1;
}
