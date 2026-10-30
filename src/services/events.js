import { curatedEvents } from "./seed-events.js";
import { Event } from "../models/index.js";
import { databaseReady } from "../config/database.js";
import { eventsProviderConfigured } from "../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8000;
const COMMUNITY_SOURCES = ["user-created", "verified-external"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsIgnoreCase = (value) => new RegExp(escapeRegex(value), "i");

function parsePopularity(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

function normalizeExternalEvent(item) {
  const popularity = parsePopularity(item.popularity);
  return {
    ...item,
    ...(Number.isFinite(popularity) && popularity >= 0 ? { popularity } : {}),
    id: String(item.id),
    source: "verified-external",
  };
}

async function externalEvents(query) {
  if (!eventsProviderConfigured()) return [];
  const { EVENTS_API_KEY: key, EVENTS_API_BASE_URL: base } = process.env;
  try {
    const url = new URL(base);
    for (const [name, value] of Object.entries(query))
      if (value) url.searchParams.set(name, value);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = await response.json();
    if (!Array.isArray(body.events)) return [];
    return body.events
      .filter((item) => item?.title && item?.startsAt && item?.id)
      .map(normalizeExternalEvent);
  } catch {
    return [];
  }
}

async function communityEvents({ city, category }) {
  if (!databaseReady()) return [];
  const filter = { source: { $in: COMMUNITY_SOURCES } };
  if (city) filter.city = containsIgnoreCase(city);
  if (category) filter.category = containsIgnoreCase(category);
  const rows = await Event.find(filter)
    .select("-createdBy -__v")
    .limit(100)
    .lean();
  return rows.map((item) => ({
    ...item,
    id: String(item._id),
    source: item.source || "user-created",
  }));
}

// Mirrors the original rules: "free" matches a zero or "free" price; an
// unparseable price never matches a price filter.
function priceAmount(price) {
  const text = String(price || "");
  return (
    Number(text.replace(/[^0-9.]/g, "")) ||
    (text.toLowerCase().includes("free") ? 0 : null)
  );
}

function matchesPrice(item, bucket) {
  if (!bucket) return true;
  const amount = priceAmount(item.price);
  if (amount === null) return false;
  if (bucket === "free") return amount === 0;
  return amount < (bucket === "under500" ? 500 : 1000);
}

function buildMatcher(query) {
  const term = (query.q || "").trim().toLowerCase();
  const place = (query.city || "").trim().toLowerCase();
  const type = (query.category || "").trim().toLowerCase();
  const endDate = query.withinDays
    ? Date.now() + Number(query.withinDays) * DAY_MS
    : null;

  return (item) => {
    const searchable =
      `${item.title || ""} ${item.category || ""} ${item.city || ""} ${item.description || ""}`.toLowerCase();
    const itemCity = String(item.city || "").toLowerCase();
    const itemCategory = String(item.category || "").toLowerCase();
    const startsAt = new Date(item.startsAt).getTime();
    return (
      (!term || searchable.includes(term)) &&
      (!place || itemCity.includes(place)) &&
      (!type || itemCategory.includes(type)) &&
      (!query.format || item.format === query.format) &&
      (!endDate || (startsAt >= Date.now() && startsAt <= endDate)) &&
      matchesPrice(item, query.price)
    );
  };
}

export async function searchEvents(query) {
  const [created, external] = await Promise.all([
    communityEvents(query),
    externalEvents({
      q: query.q || "",
      city: query.city || "",
      category: query.category || "",
    }),
  ]);
  return [...curatedEvents, ...created, ...external]
    .filter(buildMatcher(query))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}
