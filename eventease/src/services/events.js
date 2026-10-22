// import { curatedEvents } from "./seed-events.js";
// import { Event } from "../models/index.js";
// import { databaseReady } from "../config/database.js";

// async function externalEvents(query) {
//   const { EVENTS_API_KEY: key, EVENTS_API_BASE_URL: base } = process.env;
//   if (!key || !base) return [];
//   try {
//     const url = new URL(base);
//     for (const [name, value] of Object.entries(query))
//       if (value) url.searchParams.set(name, value);
//     const response = await fetch(url, {
//       headers: { authorization: `Bearer ${key}`, accept: "application/json" },
//       signal: AbortSignal.timeout(8000),
//     });
//     if (!response.ok) return [];
//     const body = await response.json();
//     return Array.isArray(body.events)
//       ? body.events
//           .filter((item) => item?.title && item?.startsAt && item?.id)
//           .map((item) => {
//             const popularity =
//               typeof item.popularity === "number"
//                 ? item.popularity
//                 : typeof item.popularity === "string" && item.popularity.trim()
//                   ? Number(item.popularity)
//                   : NaN;
//             return {
//               ...item,
//               ...(Number.isFinite(popularity) && popularity >= 0
//                 ? { popularity }
//                 : {}),
//               id: String(item.id),
//               source: "verified-external",
//             };
//           })
//       : [];
//   } catch {
//     return [];
//   }
// }

// export async function searchEvents(query) {
//   const term = (query.q || "").trim().toLowerCase();
//   const place = (query.city || "").trim().toLowerCase();
//   const type = (query.category || "").trim().toLowerCase();
//   const format = query.format || "";
//   const endDate = query.withinDays
//     ? Date.now() + Number(query.withinDays) * 86400000
//     : null;
//   let curated = curatedEvents;
//   let created = [];
//   if (databaseReady()) {
//     const userFilter = {
//       source: { $in: ["user-created", "verified-external"] },
//     };
//     if (query.city)
//       userFilter.city = new RegExp(
//         query.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i",
//       );
//     if (query.category)
//       userFilter.category = new RegExp(
//         query.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i",
//       );
//     created = (
//       await Event.find(userFilter).select("-createdBy -__v").limit(100).lean()
//     ).map((item) => ({
//       ...item,
//       id: String(item._id),
//       source: item.source || "user-created",
//     }));
//   }
//   const external = await externalEvents({
//     q: query.q || "",
//     city: query.city || "",
//     category: query.category || "",
//   });
//   const matches = [...curated, ...created, ...external].filter((item) => {
//     const text =
//       `${item.title || ""} ${item.category || ""} ${item.city || ""} ${item.description || ""}`.toLowerCase();
//     const amount =
//       Number(String(item.price || "").replace(/[^0-9.]/g, "")) ||
//       (String(item.price || "")
//         .toLowerCase()
//         .includes("free")
//         ? 0
//         : null);
//     const priceMatch =
//       !query.price ||
//       (amount !== null &&
//         (query.price === "free"
//           ? amount === 0
//           : query.price === "under500"
//             ? amount < 500
//             : amount < 1000));
//     const date = new Date(item.startsAt).getTime();
//     const itemCity = String(item.city || "").toLowerCase();
//     const itemCategory = String(item.category || "").toLowerCase();
//     return (
//       (!term || text.includes(term)) &&
//       (!place || itemCity.includes(place)) &&
//       (!type || itemCategory === type || itemCategory.includes(type)) &&
//       (!format || item.format === format) &&
//       (!endDate || (date >= Date.now() && date <= endDate)) &&
//       priceMatch
//     );
//   });
//   return matches.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
// }
































































import { curatedEvents } from "./seed-events.js";
import { Event } from "../models/index.js";
import { databaseReady } from "../config/database.js";

const PREDICTHQ_HOST = "api.predicthq.com";

function isPredictHQBaseUrl(value = "") {
  try {
    return new URL(value).hostname.toLowerCase() === PREDICTHQ_HOST;
  } catch {
    return false;
  }
}

function predictHQUrl(base, resource) {
  const url = new URL(base);
  const path = url.pathname.replace(/\/+$/, "");
  if (new RegExp(`/v1/${resource}$`, "i").test(path)) {
    url.pathname = `${path}/`;
  } else if (/\/v1$/i.test(path)) {
    url.pathname = `${path}/${resource}/`;
  } else {
    url.pathname = `${path}/${resource}/`.replace(/^\/\//, "/");
  }
  url.search = "";
  return url;
}

async function predictHQJson(url, key) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return response.json();
}

const predictHQCategoryFilters = {
  Music: ["concerts", "performing-arts"],
  Festival: ["festivals"],
  Workshop: ["conferences", "expos"],
  Community: ["community"],
  Talk: ["conferences"],
};

function eventEaseCategory(value = "") {
  const category = String(value).toLowerCase();
  if (["concerts", "performing-arts"].includes(category)) return "Music";
  if (["festivals", "public-holidays", "observances"].includes(category))
    return "Festival";
  if (["conferences", "expos", "academic"].includes(category))
    return "Workshop";
  if (category === "community") return "Community";
  return value ? String(value) : "Event";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function mapPredictHQEvent(event, requestedCity = "") {
  const startsAt = event?.start || event?.start_local;
  if (!event?.id || !event?.title || !startsAt) return null;
  const venue = Array.isArray(event.entities)
    ? event.entities.find((entity) => entity?.type === "venue")
    : null;

  return {
    id: String(event.id),
    title: String(event.title),
    startsAt,
    category: eventEaseCategory(event.category),
    city: requestedCity || event.city || "Location to confirm",
    format: "in-person",
    description: String(
      event.description || "Event details provided by PredictHQ.",
    ),
    venue: venue?.name || "",
    link: safeHttpUrl(event.url),
    price: "Details to confirm",
    source: "verified-external",
  };
}

async function searchPredictHQEvents({ base, key, query }) {
  const eventsUrl = predictHQUrl(base, "events");
  if (query.q) eventsUrl.searchParams.set("q", query.q);
  eventsUrl.searchParams.set("active.gte", new Date().toISOString().slice(0, 10));
  eventsUrl.searchParams.set("limit", "100");

  if (query.city) {
    const placesUrl = predictHQUrl(base, "places");
    placesUrl.searchParams.set("q", query.city);
    placesUrl.searchParams.set("type", "locality");
    placesUrl.searchParams.set("limit", "10");
    const places = await predictHQJson(placesUrl, key);
    const results = Array.isArray(places?.results) ? places.results : [];
    const place =
      results.find(
        (item) => item.name?.toLowerCase() === query.city.toLowerCase(),
      ) || results[0];
    if (!place?.id) return [];
    eventsUrl.searchParams.set("place.scope", String(place.id));
  }

  const categories = predictHQCategoryFilters[query.category];
  if (categories)
    eventsUrl.searchParams.set("category", categories.join(","));

  const body = await predictHQJson(eventsUrl, key);
  const results = Array.isArray(body?.results) ? body.results : [];
  return results
    .map((event) => mapPredictHQEvent(event, query.city || ""))
    .filter(Boolean);
}

async function externalEvents(query) {
  const { EVENTS_API_KEY: key, EVENTS_API_BASE_URL: base } = process.env;
  if (!key || !base) return [];
  try {
    if (isPredictHQBaseUrl(base))
      return await searchPredictHQEvents({ base, key, query });

    const url = new URL(base);
    for (const [name, value] of Object.entries(query))
      if (value) url.searchParams.set(name, value);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.events)
      ? body.events
          .filter((item) => item?.title && item?.startsAt && item?.id)
          .map((item) => {
            const popularity =
              typeof item.popularity === "number"
                ? item.popularity
                : typeof item.popularity === "string" && item.popularity.trim()
                  ? Number(item.popularity)
                  : NaN;
            return {
              ...item,
              ...(Number.isFinite(popularity) && popularity >= 0
                ? { popularity }
                : {}),
              id: String(item.id),
              source: "verified-external",
            };
          })
      : [];
  } catch {
    return [];
  }
}

export async function searchEvents(query) {
  const term = (query.q || "").trim().toLowerCase();
  const place = (query.city || "").trim().toLowerCase();
  const type = (query.category || "").trim().toLowerCase();
  const format = query.format || "";
  const endDate = query.withinDays
    ? Date.now() + Number(query.withinDays) * 86400000
    : null;
  let curated = curatedEvents;
  let created = [];
  if (databaseReady()) {
    const userFilter = {
      source: { $in: ["user-created", "verified-external"] },
    };
    if (query.city)
      userFilter.city = new RegExp(
        query.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
    if (query.category)
      userFilter.category = new RegExp(
        query.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
    created = (
      await Event.find(userFilter).select("-createdBy -__v").limit(100).lean()
    ).map((item) => ({
      ...item,
      id: String(item._id),
      source: item.source || "user-created",
    }));
  }
  const external = await externalEvents({
    q: query.q || "",
    city: query.city || "",
    category: query.category || "",
  });
  const matches = [...curated, ...created, ...external].filter((item) => {
    const text =
      `${item.title || ""} ${item.category || ""} ${item.city || ""} ${item.description || ""}`.toLowerCase();
    const amount =
      Number(String(item.price || "").replace(/[^0-9.]/g, "")) ||
      (String(item.price || "")
        .toLowerCase()
        .includes("free")
        ? 0
        : null);
    const priceMatch =
      !query.price ||
      (amount !== null &&
        (query.price === "free"
          ? amount === 0
          : query.price === "under500"
            ? amount < 500
            : amount < 1000));
    const date = new Date(item.startsAt).getTime();
    const itemCity = String(item.city || "").toLowerCase();
    const itemCategory = String(item.category || "").toLowerCase();
    return (
      (!term || text.includes(term)) &&
      (!place || itemCity.includes(place)) &&
      (!type || itemCategory === type || itemCategory.includes(type)) &&
      (!format || item.format === format) &&
      (!endDate || (date >= Date.now() && date <= endDate)) &&
      priceMatch
    );
  });
  return matches.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

