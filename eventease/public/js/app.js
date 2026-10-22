import { $, $$, toast } from "./utils.js";
import {
  loadEvents,
  loadFestivalGuides,
  refreshBookmarks,
  setAuthHandler,
  openSharedEvent,
} from "./discovery.js";
import { openPlanner } from "./planner.js";
import { openAuth, refreshAuth } from "./auth.js";
import { loadSavedPlans } from "./dashboard.js";
import "./event-composer.js";
import "./venues.js";

let activeCategory = "";
let sort = "date";
let popularityAvailable = false;
const searchForm = $("#search-form");
const sortLabels = {
  date: "Soonest first",
  relevance: "Most relevant",
  popularity: "Most popular",
};
function updateSortLabel() {
  const button = $("#sort-events");
  button.firstChild.textContent = `${sortLabels[sort]} `;
  button.setAttribute(
    "aria-label",
    `Event sort: ${sortLabels[sort]}. Activate to change.`,
  );
}
function currentFilters() {
  const query = Object.fromEntries(new FormData(searchForm));
  return {
    q: query.q,
    city: query.city,
    category: activeCategory,
    format: $("#format-filter").value,
    withinDays: query.when === "any" ? "" : query.when,
    price: $("#price-filter").value,
    sort,
  };
}
function refreshEvents() {
  loadEvents(currentFilters());
}
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshEvents();
  $("#explore").scrollIntoView({ behavior: "smooth" });
});
$$(".category-chip").forEach((button) =>
  button.addEventListener("click", () => {
    $$(".category-chip").forEach((chip) =>
      chip.classList.toggle("is-active", chip === button),
    );
    activeCategory = button.dataset.category;
    refreshEvents();
  }),
);
$("#format-filter").addEventListener("change", refreshEvents);
$("#price-filter").addEventListener("change", refreshEvents);
$("#search-when").addEventListener("change", refreshEvents);
$("#sort-events").addEventListener("click", () => {
  const options = popularityAvailable
    ? ["date", "relevance", "popularity"]
    : ["date", "relevance"];
  sort = options[(options.indexOf(sort) + 1) % options.length];
  updateSortLabel();
  refreshEvents();
});
document.addEventListener("eventease:popularity-availability", (event) => {
  const available = event.detail.available === true;
  if (!available && sort === "popularity") {
    sort = "date";
    updateSortLabel();
    refreshEvents();
  }
  popularityAvailable = available;
});
$("#see-all-events").addEventListener("click", (event) => {
  event.preventDefault();
  activeCategory = "";
  $$(".category-chip").forEach((chip) =>
    chip.classList.toggle("is-active", !chip.dataset.category),
  );
  $("#search-query").value = "";
  $("#search-city").value = "";
  $("#search-when").value = "any";
  $("#format-filter").value = "";
  $("#price-filter").value = "";
  refreshEvents();
});
$("#clear-search").addEventListener("click", () => {
  searchForm.reset();
  $("#format-filter").value = "";
  $("#price-filter").value = "";
  activeCategory = "";
  $$(".category-chip").forEach((chip) =>
    chip.classList.toggle("is-active", !chip.dataset.category),
  );
  refreshEvents();
});
$("#sort-events").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
  }
});
setAuthHandler(openAuth);
$("#header-start").addEventListener("click", () => openPlanner());
$("#hero-planner").addEventListener("click", () => openPlanner());
$("#planner-open").addEventListener("click", () => openPlanner());
$("#dashboard-start").addEventListener("click", () => openPlanner());
$("#back-top").addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);
$("#menu-toggle").addEventListener("click", () => {
  const nav = $(".primary-nav");
  const expanded = $("#menu-toggle").getAttribute("aria-expanded") === "true";
  $("#menu-toggle").setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("is-open", !expanded);
});
$$(".primary-nav a").forEach((link) =>
  link.addEventListener("click", () => {
    $(".primary-nav").classList.remove("is-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
  }),
);
$$(".close-dialog").forEach((button) =>
  button.addEventListener("click", () => button.closest("dialog").close()),
);
$$("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }),
);
document.addEventListener("eventease:refresh-events", refreshEvents);
document.addEventListener("eventease:open-saved-event", (event) =>
  openSharedEvent(event.detail.id),
);
window.addEventListener("online", () => toast("You’re back online."));
window.addEventListener("offline", () =>
  toast("You’re offline. Draft actions will be limited.", "error"),
);

async function start() {
  if (window.lucide) window.lucide.createIcons();
  const [, , user] = await Promise.all([
    loadEvents(),
    loadFestivalGuides(),
    refreshAuth(),
  ]);
  if (user) {
    await loadSavedPlans();
    await refreshBookmarks();
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  const eventId = new URLSearchParams(location.search).get("event");
  if (eventId) openSharedEvent(eventId);
}
start();
