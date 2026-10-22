import { api } from "./api.js";
import { $, $$, node, formatMoney, toast, safeHttpUrl } from "./utils.js";
import { getActivePlanId, isDashboardSignedIn } from "./dashboard.js";

const tabs = $(".workspace-tabs");
const tab = node("button", "workspace-tab", "Venue options");
tab.type = "button";
tab.dataset.tab = "venues";
tab.setAttribute("role", "tab");
tab.setAttribute("aria-selected", "false");
tabs.append(tab);
const panel = node("div", "workspace-panel");
panel.dataset.panel = "venues";
panel.setAttribute("role", "tabpanel");
panel.hidden = true;
tabs.after(panel);
const heading = node("div", "panel-toolbar");
const title = node("div");
title.append(
  node("h3", "", "Compare the possibilities"),
  node(
    "p",
    "",
    "No provider is configured. Add places you find, or check for provider listings below.",
  ),
);
const providerSearch = node(
  "button",
  "button button-outline button-small",
  "Search configured providers",
);
providerSearch.type = "button";
heading.append(title, providerSearch);
const status = node(
  "p",
  "venue-status",
  "Manual options are ideas you enter yourself—not endorsements or availability claims.",
);
status.setAttribute("aria-live", "polite");
const searchForm = node("form", "venue-search-form");
searchForm.setAttribute("aria-label", "Search configured venue providers");
function control(parent, labelText, name, type = "text", options = {}) {
  const label = node("label", "venue-label", labelText);
  let input;
  if (options.values) {
    input = document.createElement("select");
    for (const [value, text] of options.values) {
      const option = node("option", "", text);
      option.value = value;
      input.append(option);
    }
  } else {
    input = document.createElement("input");
    input.type = type;
    if (options.min !== undefined) input.min = options.min;
    if (options.max !== undefined) input.max = options.max;
  }
  input.name = name;
  if (options.required) input.required = true;
  if (options.placeholder) input.placeholder = options.placeholder;
  label.append(input);
  parent.append(label);
  return input;
}
const searchCity = control(searchForm, "City", "city", "text", {
  placeholder: "e.g. Pune",
});
control(searchForm, "Category", "category", "select", {
  values: [
    ["", "Any category"],
    ["venue", "Venue"],
    ["catering", "Catering"],
    ["photography", "Photography"],
    ["decoration", "Decoration"],
    ["entertainment", "Entertainment"],
    ["other", "Other"],
  ],
});
control(searchForm, "Capacity", "capacity", "number", {
  min: "1",
  placeholder: "Guests",
});
control(searchForm, "Max price", "maxPrice", "number", {
  min: "0",
  placeholder: "Budget ceiling",
});
const searchButton = node("button", "button button-ink button-small", "Search");
searchButton.type = "submit";
searchForm.append(searchButton);
const providerResults = node("div", "venue-results");
providerResults.setAttribute("aria-live", "polite");
const divider = node("div", "venue-divider");
divider.append(node("span", "", "OR ADD YOUR OWN COMPARISON"));
const manualForm = node("form", "venue-manual-form");
control(manualForm, "Name", "name", "text", {
  required: true,
  maxLength: 140,
  placeholder: "Place or provider name",
});
control(manualForm, "Category", "category", "select", {
  required: true,
  values: [
    ["venue", "Venue"],
    ["catering", "Catering"],
    ["photography", "Photography"],
    ["decoration", "Decoration"],
    ["entertainment", "Entertainment"],
    ["other", "Other"],
  ],
});
control(manualForm, "City", "city", "text", {
  maxLength: 100,
  placeholder: "City",
});
control(manualForm, "Capacity", "capacity", "number", {
  min: "1",
  max: "50000",
  placeholder: "Guest capacity",
});
control(manualForm, "Estimated price", "estimatedCost", "number", {
  min: "0",
  max: "100000000",
  placeholder: "Optional estimate",
});
control(manualForm, "Currency", "currency", "select", {
  values: [
    ["INR", "INR ₹"],
    ["USD", "USD $"],
    ["EUR", "EUR €"],
    ["GBP", "GBP £"],
  ],
});
control(manualForm, "Contact details (optional)", "contact", "text", {
  maxLength: 200,
  placeholder: "Entered by you—not verified",
});
control(manualForm, "Website (optional)", "link", "url", {
  maxLength: 500,
  placeholder: "https://…",
});
const noteLabel = node("label", "venue-label venue-wide", "Notes");
const noteField = document.createElement("textarea");
noteField.name = "notes";
noteField.maxLength = 1000;
noteField.rows = 2;
noteField.placeholder = "Capacity checks, price details, what to ask…";
noteLabel.append(noteField);
manualForm.append(noteLabel);
const addButton = node(
  "button",
  "button button-coral button-small",
  "Add option",
);
addButton.type = "submit";
manualForm.append(addButton);
const optionsHeading = node("div", "venue-list-heading");
optionsHeading.append(
  node("h4", "", "Your comparison list"),
  node("span", "venue-count", "0 options"),
);
const optionsList = node("div", "venue-options-list");
optionsList.setAttribute("aria-live", "polite");
const empty = node(
  "p",
  "venue-empty",
  "Nothing here yet. Add a venue or provider you are considering, then compare capacity and estimates.",
);
panel.append(
  heading,
  status,
  searchForm,
  providerResults,
  divider,
  manualForm,
  optionsHeading,
  optionsList,
  empty,
);
let entries = [];
let providerConfigured = false;
function renderEntry(item, fromProvider = false) {
  const card = node("article", "venue-option");
  const top = node("div", "venue-option-top");
  top.append(
    node("h5", "", item.name),
    node(
      "span",
      `source-badge ${fromProvider || item.source === "verified-provider" ? "source-verified" : "source-member"}`,
      fromProvider || item.source === "verified-provider"
        ? "Provider listing"
        : "Manual entry",
    ),
  );
  const meta = node(
    "p",
    "venue-option-meta",
    `${item.category || "Other"} · ${item.city || "City not entered"}${item.capacity ? ` · up to ${Number(item.capacity).toLocaleString()} guests` : ""}`,
  );
  const price =
    item.estimatedCost == null
      ? "Estimate not supplied"
      : `Estimate: ${formatMoney(item.estimatedCost, item.currency || "INR")}`;
  const detail = node("p", "venue-option-price", price);
  card.append(top, meta, detail);
  if (item.notes) card.append(node("p", "venue-option-notes", item.notes));
  if (item.contact && !fromProvider)
    card.append(
      node("p", "venue-option-notes", `Your contact note: ${item.contact}`),
    );
  const link = safeHttpUrl(item.link);
  if (link) {
    const a = node("a", "venue-link", "Visit provider ↗");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    card.append(a);
  }
  if (!fromProvider) {
    const del = node("button", "icon-button-card venue-remove", "×");
    del.type = "button";
    del.setAttribute("aria-label", `Remove comparison option ${item.name}`);
    del.addEventListener("click", async () => {
      if (!window.confirm(`Remove “${item.name}” from this comparison?`))
        return;
      try {
        if (item._id && getActivePlanId() && isDashboardSignedIn())
          await api(
            `/api/plans/${encodeURIComponent(getActivePlanId())}/venues/${encodeURIComponent(item._id)}`,
            { method: "DELETE" },
          );
        entries = entries.filter((row) => row !== item);
        renderEntries();
      } catch (error) {
        toast(error.message, "error");
      }
    });
    card.append(del);
  }
  return card;
}
function renderEntries() {
  optionsList.replaceChildren(...entries.map((entry) => renderEntry(entry)));
  empty.hidden = entries.length > 0;
  $(".venue-count").textContent =
    `${entries.length} ${entries.length === 1 ? "option" : "options"}`;
}
async function loadManualEntries() {
  const planId = getActivePlanId();
  if (!planId || !isDashboardSignedIn()) {
    if (isDashboardSignedIn()) entries = [];
    status.textContent =
      "Add an option for this page session. To keep comparisons, sign in and choose a saved plan.";
    renderEntries();
    return;
  }
  try {
    entries = (await api(`/api/plans/${encodeURIComponent(planId)}/venues`))
      .data;
    status.textContent = providerConfigured
      ? "Compare your entries with returned provider listings. Confirm prices and availability directly."
      : "No venue provider is configured. Your list is private to this saved plan; nothing here claims real-time availability.";
  } catch (error) {
    status.textContent = error.message;
    entries = [];
  }
  renderEntries();
}
async function searchProvider(event) {
  event?.preventDefault();
  providerSearch.disabled = true;
  searchButton.disabled = true;
  providerResults.replaceChildren(
    node("p", "venue-status", "Checking the configured provider…"),
  );
  const query = Object.fromEntries(new FormData(searchForm));
  try {
    const { data, meta } = await api(
      `/api/venues/search?${new URLSearchParams(Object.entries(query).filter(([, value]) => value))}`,
    );
    providerConfigured = meta.configured;
    status.textContent = meta.message;
    providerResults.replaceChildren();
    if (!data.length)
      providerResults.append(node("p", "venue-empty", meta.message));
    else
      data.forEach((item) => providerResults.append(renderEntry(item, true)));
    await loadManualEntries();
  } catch (error) {
    providerResults.replaceChildren(node("p", "form-error", error.message));
  } finally {
    providerSearch.disabled = false;
    searchButton.disabled = false;
  }
}
searchForm.addEventListener("submit", searchProvider);
providerSearch.addEventListener("click", searchProvider);
manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(manualForm));
  const payload = {
    name: raw.name,
    category: raw.category,
    city: raw.city,
    ...(raw.capacity ? { capacity: Number(raw.capacity) } : {}),
    ...(raw.estimatedCost !== ""
      ? { estimatedCost: Number(raw.estimatedCost) }
      : {}),
    currency: raw.currency,
    contact: raw.contact,
    link: raw.link,
    notes: raw.notes,
  };
  try {
    let saved = null;
    if (getActivePlanId() && isDashboardSignedIn())
      saved = (
        await api(
          `/api/plans/${encodeURIComponent(getActivePlanId())}/venues`,
          { method: "POST", body: payload },
        )
      ).data;
    entries.push(saved || { ...payload, source: "manual" });
    manualForm.reset();
    renderEntries();
    toast(
      saved
        ? "Comparison option saved to your plan."
        : "Added for this page session.",
    );
  } catch (error) {
    toast(error.message, "error");
  }
});
tab.addEventListener("click", () => {
  $$(".workspace-tab").forEach((button) => {
    const selected = button === tab;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  $$(".workspace-panel").forEach((item) => {
    item.hidden = item !== panel;
    item.classList.toggle("is-visible", item === panel);
  });
  loadManualEntries();
});
document.addEventListener("eventease:plan-changed", loadManualEntries);
document.addEventListener("eventease:signed-in", () => {
  if (!getActivePlanId()) entries = [];
  loadManualEntries();
});
document.addEventListener("eventease:signed-out", () => {
  entries = [];
  renderEntries();
});
renderEntries();
