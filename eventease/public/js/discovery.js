import { api } from "./api.js";
import { $, $$, node, formatDate, safeHttpUrl, toast } from "./utils.js";
import { renderFestivalCalendar } from "./festival-calendar.js";

let events = [];
let onNeedAuth = () => {};
const savedEventIds = new Set();
const categoryIcons = {
  Festival: "sparkles",
  Workshop: "lightbulb",
  Wedding: "heart",
  Music: "music-2",
  Seasonal: "sun",
  Talk: "messages-square",
  Community: "users-round",
};

function provenance(source) {
  if (source === "verified-external")
    return ["Verified external listing", "source-verified"];
  if (source === "user-created")
    return ["Created by a member", "source-member"];
  return ["Curated sample", "source-curated"];
}

async function shareEvent(event) {
  const url = new URL(window.location.href);
  url.searchParams.set("event", event.id);
  const shareData = {
    title: event.title,
    text: event.description || "Take a look at this event on EventEase.",
    url: url.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareData.url);
      toast("Event link copied.");
      return;
    }
  } catch {
    // Clipboard access may be blocked in embedded previews or by browser policy.
  }

  window.prompt("Copy this event link:", shareData.url);
}


















function safeExternalEventUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.origin === window.location.origin) return "";
    return url.href;
  } catch {
    return "";
  }
}
























function renderCard(event) {
  const card = node("article", "event-card");
  const body = node("div", "event-card-body");
  const meta = node("div", "event-meta");
  const icon = node("i");
  icon.setAttribute(
    "data-lucide",
    categoryIcons[event.category] || "calendar-heart",
  );
  meta.append(
    icon,
    node(
      "span",
      event.category?.toLowerCase().replaceAll(" ", "-") || "",
      event.category || "Gathering",
    ),
    node("span", "meta-dot", "·"),
    node(
      "span",
      "",
      event.format === "online"
        ? "Online"
        : event.city || "Location to be confirmed",
    ),
  );
  const [tag, sourceClass] = provenance(event.source);
  const badge = node("span", `source-badge ${sourceClass}`, tag);
  const heading = node("h3", "", event.title);
  const date = node("p", "event-card-date", formatDate(event.startsAt));
  const description = node(
    "p",
    "event-card-description",
    event.description || "A curated idea to get you started.",
  );
  const footer = node("div", "event-card-footer");
  const price = node(
    "span",
    "event-price",
    event.price || "Details to confirm",
  );
  const actions = node("div", "event-actions");
  const seeMore = node("button", "event-see-more", "See more");
  seeMore.type = "button";
  seeMore.setAttribute("aria-label", `See more about ${event.title}`);
  seeMore.addEventListener("click", () => openDetails(event));

  const save = node("button", "icon-button-card");
  save.type = "button";
  save.dataset.bookmarkId = event.id;
  const heart = node("i");
  heart.setAttribute("data-lucide", "bookmark");
  save.append(heart);
  updateBookmarkButton(save, event);
  save.addEventListener("click", async () => {
    try {
      if (savedEventIds.has(event.id)) {
        await api(`/api/auth/saved/${encodeURIComponent(event.id)}`, {
          method: "DELETE",
        });
        savedEventIds.delete(event.id);
        toast("Removed from your saved events.");
      } else {
        await api("/api/auth/saved", {
          method: "POST",
          body: { eventId: event.id },
        });
        savedEventIds.add(event.id);
        toast("Saved to your planning desk.");
      }
      updateBookmarkButton(save, event);
      document.dispatchEvent(new CustomEvent("eventease:saved-changed"));
    } catch (error) {
      if (error.status === 401 || error.status === 503) onNeedAuth();
      else toast(error.message, "error");
    }
  });

  const share = node("button", "icon-button-card");
  share.type = "button";
  share.setAttribute("aria-label", `Share ${event.title}`);
  const shareIcon = node("i");
  shareIcon.setAttribute("data-lucide", "share-2");
  share.append(shareIcon);
  share.addEventListener("click", () => void shareEvent(event));

  actions.append(seeMore, save, share);
  footer.append(price, actions);
  body.append(meta, badge, heading, date, description, footer);
  card.append(body);
  heading.addEventListener("click", () => openDetails(event));
  if (window.lucide) window.lucide.createIcons({ nodes: [card] });
  return card;
}

function updateBookmarkButton(button, event) {
  const saved = savedEventIds.has(event.id);
  button.classList.toggle("is-saved", saved);
  button.setAttribute(
    "aria-label",
    saved ? `Remove ${event.title} from saved events` : `Save ${event.title}`,
  );
  button.title = saved ? "Remove saved event" : "Save event";
}

async function syncBookmarks() {
  try {
    const { data } = await api("/api/auth/saved");
    savedEventIds.clear();
    data.forEach((item) => savedEventIds.add(item.eventId));
  } catch {
    savedEventIds.clear();
  }
  $$("[data-bookmark-id]").forEach((button) => {
    const event = events.find((item) => item.id === button.dataset.bookmarkId);
    if (event) updateBookmarkButton(button, event);
  });
  document.dispatchEvent(new CustomEvent("eventease:saved-changed"));
}
export const refreshBookmarks = syncBookmarks;

document.addEventListener("eventease:signed-in", syncBookmarks);
document.addEventListener("eventease:signed-out", () => {
  savedEventIds.clear();
  $$("[data-bookmark-id]").forEach((button) => {
    const event = events.find((item) => item.id === button.dataset.bookmarkId);
    if (event) updateBookmarkButton(button, event);
  });
  document.dispatchEvent(new CustomEvent("eventease:saved-changed"));
});

function openDetails(event) {
  const dialog = $("#event-dialog");
  const content = $("#event-detail-content");
  content.replaceChildren();
  const imageUrl = safeHttpUrl(event.image);
  let photo = null;
  if (imageUrl) {
    photo = document.createElement("img");
    photo.className = "detail-photo";
    photo.src = imageUrl;
    photo.alt = event.title ? `Photo for ${event.title}` : "Event photo";
    photo.onerror = () => photo.remove();
  }
  const [label, style] = provenance(event.source);
  const badge = node("span", `source-badge ${style}`, label);
  const title = node("h2", "detail-title", event.title);
  title.id = "event-dialog-title";
  const date = node(
    "p",
    "detail-date",
    `${formatDate(event.startsAt, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${event.city || "Location to be confirmed"}`,
  );
  const description = node(
    "p",
    "detail-description",
    event.description || "No description provided.",
  );
  const venue = node(
    "p",
    "detail-description",
    `Venue: ${event.venue || "details to confirm"} · Price: ${event.price || "pricing to confirm"}`,
  );
  const organizer = node(
    "p",
    "detail-description",
    `Organizer: ${event.organizer || "not supplied"}`,
  );
  const disclaimer = node(
    "p",
    "detail-disclaimer",
    event.source === "curated"
      ? "This is a curated sample or planning inspiration, not a verified live listing. Please confirm dates, venue and prices locally."
      : event.source === "verified-external"
        ? "Details were returned by the configured external event provider."
        : "This event was created by a community member. Confirm details with the organizer.",
  );
  const buttons = node("div", "detail-actions");
  const share = node("button", "button button-outline", "Share event ↗");
  share.type = "button";
  share.addEventListener("click", () => void shareEvent(event));
  buttons.append(share);
  const link = safeExternalEventUrl(event.link);
  if (link) {
    const anchor = node("a", "button button-ink", "Visit event page ↗");
    anchor.href = link;
    anchor.target = "_self";
    anchor.rel = "noopener noreferrer";
    buttons.append(anchor);
  }

  if (photo) content.append(photo);
  content.append(
    badge,
    title,
    date,
    description,
    venue,
    organizer,
    disclaimer,
    buttons,
  );
  dialog.showModal();
}

export async function loadEvents(filters = {}) {
  const grid = $("#event-grid");
  const empty = $("#event-empty");
  grid.classList.add("is-loading");
  grid.replaceChildren();
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  );
  try {
    const result = await api(`/api/events?${query}`);
    events = result.data;
    document.dispatchEvent(
      new CustomEvent("eventease:popularity-availability", {
        detail: { available: result.meta?.popularityAvailable === true },
      }),
    );
    const term =
      filters.q || filters.city || filters.category
        ? "Filtered event ideas"
        : "A handful of good ideas, hand picked.";
    $("#event-results-label").textContent =
      `${term} · ${events.length} ${events.length === 1 ? "idea" : "ideas"}`;
    for (const event of events) grid.append(renderCard(event));
    empty.hidden = events.length > 0;
  } catch (error) {
    empty.hidden = false;
    $("#event-results-label").textContent = "We could not load event ideas.";
    toast(error.message, "error");
  } finally {
    grid.classList.remove("is-loading");
  }
}

export async function loadFestivalGuides() {
  try {
    const country = $("#festival-country")?.value || "IN";
    const region = $("#festival-region")?.value.trim().toUpperCase() || "";
    const params = new URLSearchParams({ country });
    if (region) params.set("region", region);
    const { data } = await api(`/api/events/festivals?${params}`);
    const list = $("#festival-list");
    list.replaceChildren();
    $("#festival-count").textContent = String(data.length).padStart(2, "0");
    const next = data.find((item) => item.nextDate && item.daysUntil >= 0);
    $("#next-festival-note").textContent = next
      ? `${next.name} · ${formatDate(next.nextDate, { month: "short", day: "numeric" })} · ${Math.max(0, next.daysUntil)} days · ${next.confidence}`
      : `No upcoming exact date was published for ${region || country}. These seasonal notes are guides, not event listings.`;
    for (const item of data) {
      const row = node("article", "festival-row");
      const name = node("strong", "", item.name);
      const date = node(
        "span",
        "festival-date",
        item.nextDate
          ? formatDate(item.nextDate, { month: "short", day: "numeric" })
          : item.season || "Date varies",
      );
      const info = node("p", "", item.context);
      const note = node("small", "", item.confidence);
      const idea = node("span", "festival-idea", item.idea);
      const action = node("button", "festival-plan-link", "Plan around it ↗");
      action.type = "button";
      action.dataset.festival = item.name;
      action.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("eventease:festival", {
            detail: { name: item.name, idea: item.idea },
          }),
        );
      });
      const top = node("div", "festival-row-top");
      top.append(name, date);
      row.append(top, info, note, idea, action);
      list.append(row);
    }
    renderFestivalCalendar(data);
  } catch (error) {
    $("#festival-list").append(node("p", "form-error", error.message));
  }
}

$("#festival-location-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadFestivalGuides();
});

export function setAuthHandler(handler) {
  onNeedAuth = handler;
}
export function matchingEvents() {
  return events;
}
export async function openSharedEvent(id) {
  try {
    const { data } = await api(`/api/events/${encodeURIComponent(id)}`);
    openDetails(data);
  } catch {
    toast(
      "That event link is no longer available. Browse current ideas instead.",
      "error",
    );
  }
}
