// const safeUrl = (value) => {
//   try {
//     const parsed = new URL(value);
//     return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
//   } catch {
//     return "";
//   }
// };

// export async function searchVenueProvider(filters = {}) {
//   const key = process.env.VENUES_API_KEY;
//   const base = process.env.VENUES_API_BASE_URL;
//   if (!key || !base)
//     return {
//       configured: false,
//       data: [],
//       message:
//         "No venue provider is configured. Add your own options below; no businesses or availability are invented.",
//     };
//   try {
//     const url = new URL(base);
//     for (const field of ["city", "category", "capacity", "maxPrice"])
//       if (filters[field]) url.searchParams.set(field, filters[field]);
//     const response = await fetch(url, {
//       headers: { authorization: `Bearer ${key}`, accept: "application/json" },
//       signal: AbortSignal.timeout(8000),
//     });
//     if (!response.ok)
//       return {
//         configured: true,
//         data: [],
//         message:
//           "The configured provider could not return results just now. Try again or add a manual option.",
//       };
//     const body = await response.json();
//     const data = (Array.isArray(body.options) ? body.options : [])
//       .filter((item) => item?.name && item?.category && item?.city)
//       .map((item) => ({
//         id: String(item.id || ""),
//         name: String(item.name).slice(0, 140),
//         category: String(item.category).slice(0, 40),
//         city: String(item.city).slice(0, 100),
//         capacity: Number(item.capacity) || null,
//         estimatedCost: Number(item.estimatedCost) || null,
//         currency: /^[A-Z]{3}$/.test(item.currency || "")
//           ? item.currency
//           : "INR",
//         link: safeUrl(item.link),
//         source: "verified-provider",
//       }));
//     return {
//       configured: true,
//       data,
//       message: data.length
//         ? "Provider listings returned. Confirm current prices and availability with the provider."
//         : "No matching provider listings were returned.",
//     };
//   } catch {
//     return {
//       configured: true,
//       data: [],
//       message:
//         "Venue search is unavailable at the moment. Add a manual option or try again later.",
//     };
//   }
// }

















































const PREDICTHQ_HOST = "api.predicthq.com";

function isPredictHQBaseUrl(value = "") {
  try {
    return new URL(value).hostname.toLowerCase() === PREDICTHQ_HOST;
  } catch {
    return false;
  }
}

const safeUrl = (value) => {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

export async function searchVenueProvider(filters = {}) {
  const key = process.env.VENUES_API_KEY;
  const base = process.env.VENUES_API_BASE_URL;
  if (!key || !base)
    return {
      configured: false,
      data: [],
      message:
        "No venue provider is configured. Add your own options below; no businesses or availability are invented.",
    };

  if (isPredictHQBaseUrl(base))
    return {
      configured: false,
      data: [],
      message:
        "PredictHQ provides events and geographic places such as cities, not a searchable venue-business directory. It cannot return venue capacity, prices, or availability here. Keep PredictHQ under EVENTS_API_BASE_URL for events. Leave VENUES_API_KEY and VENUES_API_BASE_URL blank unless you have a separate venue directory API; you can add venue options manually below.",
    };

  try {
    const url = new URL(base);
    for (const field of ["city", "category", "capacity", "maxPrice"])
      if (filters[field]) url.searchParams.set(field, filters[field]);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        configured: true,
        data: [],
        message:
          "The configured provider could not return results just now. Try again or add a manual option.",
      };
    const body = await response.json();
    const data = (Array.isArray(body.options) ? body.options : [])
      .filter((item) => item?.name && item?.category && item?.city)
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name).slice(0, 140),
        category: String(item.category).slice(0, 40),
        city: String(item.city).slice(0, 100),
        capacity: Number(item.capacity) || null,
        estimatedCost: Number(item.estimatedCost) || null,
        currency: /^[A-Z]{3}$/.test(item.currency || "")
          ? item.currency
          : "INR",
        link: safeUrl(item.link),
        source: "verified-provider",
      }));
    return {
      configured: true,
      data,
      message: data.length
        ? "Provider listings returned. Confirm current prices and availability with the provider."
        : "No matching provider listings were returned.",
    };
  } catch {
    return {
      configured: true,
      data: [],
      message:
        "Venue search is unavailable at the moment. Add a manual option or try again later.",
    };
  }
}
