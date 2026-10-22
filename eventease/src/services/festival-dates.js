import { festivalGuides } from "./seed-events.js";

const cache = new Map();
const cacheTtl = 6 * 60 * 60 * 1000;
const calendarUrl = "https://nagerholidays.com/api/v4/Holidays";
const rules = [
  { name: "Diwali", match: /diwali|deepavali/i },
  { name: "Christmas", match: /christmas/i },
  { name: "Holi", match: /holi/i },
  { name: "Eid al-Fitr", match: /eid\s*(?:al[- ]?)?fitr|ramzan|ramadan/i },
  { name: "Navratri", match: /navratri/i },
  { name: "Durga Puja", match: /durga\s*puja/i },
  { name: "Pongal", match: /pongal/i },
  { name: "Baisakhi", match: /baisakhi|vaisakhi/i },
  { name: "Onam", match: /onam/i },
  { name: "Ganesh Chaturthi", match: /ganesh\s*chaturthi/i },
];

async function holidaysFor(countryCode, year) {
  const key = `${countryCode}:${year}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  try {
    const response = await fetch(
      `${calendarUrl}/${encodeURIComponent(countryCode)}/${year}`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2800),
      },
    );
    if (response.status === 204) {
      cache.set(key, { items: [], expiresAt: Date.now() + cacheTtl });
      return [];
    }
    if (!response.ok) return [];
    const body = await response.json();
    const items = Array.isArray(body) ? body : [];
    cache.set(key, { items, expiresAt: Date.now() + cacheTtl });
    return items;
  } catch {
    return [];
  }
}

const isoDay = (date) => date.toISOString().slice(0, 10);

export async function getFestivalGuides({
  countryCode = "IN",
  region = "",
} = {}) {
  const today = isoDay(new Date());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const holidaySets = await Promise.all(
    years.map((year) => holidaysFor(countryCode, year)),
  );
  const records = holidaySets.flat();

  return festivalGuides
    .map((guide) => {
      const rule = rules.find((item) => item.name === guide.name);
      const holiday = rule
        ? records
            .filter((item) => {
              const local = `${item.name || ""} ${item.localName || ""}`;
              if (
                !rule.match.test(local) ||
                !/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")
              )
                return false;
              if (item.date < today) return false;
              if (!region) return true;
              const subdivisions = item.subdivisionCodes || item.counties;
              return (
                !Array.isArray(subdivisions) ||
                subdivisions.length === 0 ||
                subdivisions.includes(region)
              );
            })
            .sort((a, b) => a.date.localeCompare(b.date))[0]
        : null;

      let nextDate = holiday?.date || null;
      let dateSource = holiday ? "Nager.Date country/region calendar" : null;
      let confidence;
      if (holiday) {
        confidence = holiday.nationalHoliday
          ? "Listed on the selected country's public-holiday calendar; local programs can vary."
          : "Listed on the selected country/region calendar; confirm local observance details. ";
      } else if (guide.name === "Christmas") {
        const date = new Date(`${currentYear}-12-25T00:00:00.000Z`);
        if (isoDay(date) < today) date.setUTCFullYear(currentYear + 1);
        nextDate = isoDay(date);
        dateSource = "Common Gregorian calendar date";
        confidence =
          "Common calendar date; local programs and observance vary.";
      } else if (guide.name === "Eid al-Fitr") {
        confidence =
          "The exact date depends on local moon sighting. Check a local community announcement.";
      } else {
        confidence = `No upcoming date was published for ${region || countryCode} in the available public calendar. This seasonal guide is not a confirmed listing.`;
      }

      const daysUntil = nextDate
        ? Math.ceil(
            (new Date(`${nextDate}T00:00:00.000Z`) -
              new Date(`${today}T00:00:00.000Z`)) /
              86400000,
          )
        : null;
      return {
        ...guide,
        nextDate,
        daysUntil,
        countryCode,
        region,
        dateSource,
        confidence,
      };
    })
    .sort((a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity));
}

export function clearFestivalDateCache() {
  cache.clear();
}
