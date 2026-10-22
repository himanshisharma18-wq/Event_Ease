import { api } from "./api.js";
import { $, $$, node, formatMoney, toast } from "./utils.js";

const dialog = $("#planner-dialog");
const form = $("#planner-form");
const resultBox = $("#plan-result");
let step = 0;
let currentInput = null;
let currentPlan = null;
let currentNote = "";
let currentSource = "fallback";
let savedPlanId = null;
let completed = new Set();
const sections = [
  ["concept", "The idea"],
  ["venue", "Finding the right place"],
  ["food", "At the table"],
  ["entertainment", "A little something extra"],
  ["schedule", "The flow of the day"],
  ["budget", "The budget (estimates)"],
  ["guestChecklist", "Guest notes"],
  ["shoppingList", "The useful list"],
  ["preparationTimeline", "Before the day"],
  ["contingencies", "If the plan changes"],
  ["sustainableAlternatives", "A lighter footprint"],
];
const sectionPaths = {
  concept: ["title", "summary", "mood"],
  venue: ["requirements", "selectionTips"],
  food: ["approach", "ideas", "dietaryNotes"],
  entertainment: [],
  schedule: [],
  budget: [],
  guestChecklist: [],
  shoppingList: [],
  preparationTimeline: [],
  contingencies: [],
  sustainableAlternatives: [],
};
function showStep(index) {
  step = index;
  $$(".wizard-step", form).forEach((panel, i) => {
    const active = i === step;
    panel.hidden = !active;
    panel.classList.toggle("is-current", active);
  });
  $("#wizard-step-label").textContent =
    `${String(step + 1).padStart(2, "0")} / 03 — ${["The basics", "Set the feeling", "The details"][step]}`;
  $("#wizard-progress-fill").style.width = `${((step + 1) / 3) * 100}%`;
  $("#wizard-back").hidden = step === 0;
  $("#wizard-next").hidden = step === 2;
  $("#wizard-generate").hidden = step !== 2;
}
function readForm() {
  const data = new FormData(form);
  const input = Object.fromEntries(data.entries());
  input.guests = Number(input.guests);
  input.budget = Number(input.budget || 0);
  input.durationHours = Number(input.durationHours);
  return input;
}
function setPath(target, path, value) {
  const keys = path.split(".");
  let point = target;
  for (const key of keys.slice(0, -1)) point = point[key];
  point[keys.at(-1)] = value;
}
function lineEntries(section, value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const list = node("ul", "plan-list");
  values.forEach((item, index) => {
    if (item && typeof item === "object") {
      const row = node("li", "plan-object-row");
      const left = node(
        "strong",
        "",
        item.time || item.when || item.category || "",
      );
      const right = node(
        "span",
        "",
        item.activity ||
          item.task ||
          (item.estimated !== undefined
            ? `${formatMoney(item.estimated, currentInput?.currency)} · ${item.note}`
            : ""),
      );
      left.contentEditable = "true";
      right.contentEditable = "true";
      left.dataset.edit = `${section}.${index}.${item.time !== undefined ? "time" : item.when !== undefined ? "when" : item.category !== undefined ? "category" : "text"}`;
      right.dataset.edit = `${section}.${index}.${item.activity !== undefined ? "activity" : item.task !== undefined ? "task" : item.estimated !== undefined ? "note" : "text"}`;
      row.append(left, right);
      if (item.estimated !== undefined) {
        const amount = node("span", "budget-estimate", String(item.estimated));
        amount.contentEditable = "true";
        amount.dataset.edit = `${section}.${index}.estimated`;
        amount.dataset.estimate = `${section}.${index}.estimated`;
        row.append(amount);
      }
      list.append(row);
      return;
    }
    const li = node("li", "plan-editable", item);
    li.contentEditable = "true";
    li.dataset.edit = `${section}.${index}`;
    if (["guestChecklist", "shoppingList"].includes(section)) {
      const label = node("label", "plan-check");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = completed.has(`${section}-${index}`);
      check.dataset.check = `${section}-${index}`;
      label.append(check, li);
      list.append(label);
    } else list.append(li);
  });
  return list;
}
function renderPlan() {
  resultBox.replaceChildren();
  resultBox.hidden = false;
  form.hidden = true;
  const intro = node("div", "plan-result-head");
  intro.append(
    node("p", "eyebrow", "YOUR FIRST DRAFT"),
    node(
      "h3",
      "",
      currentPlan.concept?.title || `${currentInput.eventType} plan`,
    ),
    node("p", "plan-disclaimer", currentNote),
  );
  const toolbar = node("div", "plan-toolbar");
  const editHint = node("span", "edit-hint", "Tap any line to make it yours.");
  const refine = node(
    "button",
    "button button-outline button-small",
    "Refine answers",
  );
  refine.type = "button";
  refine.addEventListener("click", () => {
    form.hidden = false;
    resultBox.hidden = true;
    for (const [key, value] of Object.entries(currentInput)) {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    }
    showStep(0);
  });
  const print = node(
    "button",
    "button button-outline button-small",
    "Print plan",
  );
  print.type = "button";
  print.addEventListener("click", () => window.print());
  const save = node(
    "button",
    "button button-coral button-small",
    savedPlanId ? "Save changes" : "Save plan",
  );
  save.type = "button";
  save.addEventListener("click", savePlan);
  toolbar.append(editHint, refine, print, save);
  resultBox.append(intro, toolbar);
  for (const [key, label] of sections) {
    const panel = node("section", "plan-section");
    const heading = node("div", "plan-section-heading");
    const h = node("h4", "", label);
    const regen = node("button", "regenerate-button", "Refresh this section ↻");
    regen.type = "button";
    regen.dataset.regenerate = key;
    regen.addEventListener("click", () => regenerateSection(key));
    heading.append(h, regen);
    panel.append(heading);
    const value = currentPlan[key];
    if (key === "concept") {
      const summary = node("p", "plan-concept-summary", value.summary);
      summary.contentEditable = "true";
      summary.dataset.edit = "concept.summary";
      panel.append(summary);
      const mood = node("p", "plan-mood", value.mood);
      mood.contentEditable = "true";
      mood.dataset.edit = "concept.mood";
      panel.append(mood);
      const palette = node("div", "palette-row");
      value.palette.forEach((color, index) => {
        const swatch = node("span", "palette-chip", color);
        swatch.contentEditable = "true";
        swatch.dataset.edit = `concept.palette.${index}`;
        palette.append(swatch);
      });
      panel.append(palette);
    } else if (key === "venue") {
      panel.append(node("h5", "plan-mini-heading", "Worth checking"));
      panel.append(lineEntries("venue.requirements", value.requirements));
      panel.append(node("h5", "plan-mini-heading", "Choosing well"));
      const arr = node("ul", "plan-list");
      value.selectionTips.forEach((text, index) => {
        const li = node("li", "plan-editable", text);
        li.contentEditable = "true";
        li.dataset.edit = `venue.selectionTips.${index}`;
        arr.append(li);
      });
      panel.append(arr);
    } else if (key === "food") {
      const approach = node("p", "plan-concept-summary", value.approach);
      approach.contentEditable = "true";
      approach.dataset.edit = "food.approach";
      panel.append(
        approach,
        node("h5", "plan-mini-heading", "Menu notes"),
        lineEntries("food.ideas", value.ideas),
        node("h5", "plan-mini-heading", "Dietary considerations"),
      );
      const dietary = node("ul", "plan-list");
      value.dietaryNotes.forEach((text, index) => {
        const li = node("li", "plan-editable", text);
        li.contentEditable = "true";
        li.dataset.edit = `food.dietaryNotes.${index}`;
        dietary.append(li);
      });
      panel.append(dietary);
    } else panel.append(lineEntries(key, value));
    resultBox.append(panel);
  }
  const footer = node(
    "p",
    "plan-estimates-footnote",
    "Every figure is a planning estimate, not a quote. Confirm dates, costs, dietary requirements and local customs with the people involved.",
  );
  resultBox.append(footer);
}
function readEdits() {
  const updated = structuredClone(currentPlan);
  $$("[data-edit]", resultBox).forEach((element) => {
    const path = element.dataset.edit;
    const currentValue = path
      .split(".")
      .reduce((obj, key) => obj?.[key], updated);
    if (typeof currentValue === "string")
      setPath(updated, path, element.textContent.trim());
    else if (typeof currentValue === "number")
      setPath(
        updated,
        path,
        Math.max(0, Number(element.textContent.trim()) || 0),
      );
    else if (/\.\d+$/.test(path))
      setPath(updated, path, element.textContent.trim());
  });
  $$("[data-estimate]", resultBox).forEach((element) => {
    const p = element.dataset.estimate;
    const val = p.split(".").reduce((obj, key) => obj?.[key], updated);
    if (Number.isFinite(val)) setPath(updated, p, val);
  });
  return updated;
}
async function generate(event) {
  event?.preventDefault();
  const data = readForm();
  const error = $("#planner-error");
  error.hidden = true;
  if (!data.eventType || !Number.isFinite(data.guests) || data.guests < 1) {
    error.textContent = "Add an occasion and a guest count to make a plan.";
    error.hidden = false;
    return;
  }
  if (
    data.date &&
    new Date(`${data.date}T00:00:00`) < new Date(new Date().toDateString())
  ) {
    error.textContent =
      "Choose a date today or later, or leave it open for now.";
    error.hidden = false;
    return;
  }
  currentInput = data;
  if (!savedPlanId) completed = new Set();
  const button = $("#wizard-generate");
  button.disabled = true;
  button.textContent = "Putting the pieces together…";
  try {
    const response = await api("/api/plans/generate", {
      method: "POST",
      body: data,
    });
    currentPlan = response.data.plan;
    currentSource = response.data.source;
    currentNote = response.data.note;
    renderPlan();
  } catch (err) {
    error.textContent = `${err.message} Your answers are still here—please try again.`;
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Try again <span aria-hidden="true">↗</span>';
    window.lucide?.createIcons();
  }
}
async function regenerateSection(section) {
  currentPlan = readEdits();
  const button = $(`[data-regenerate="${section}"]`, resultBox);
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    const { data } = await api("/api/plans/generate/section", {
      method: "POST",
      body: { input: currentInput, section },
    });
    currentPlan[section] = data.value;
    currentNote = data.note;
    currentSource = data.source;
    renderPlan();
    toast(`${section.replaceAll(/([A-Z])/g, " $1").toLowerCase()} refreshed.`);
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
    button.textContent = "Refresh this section ↻";
  }
}
async function savePlan() {
  currentPlan = readEdits();
  try {
    const updating = Boolean(savedPlanId);
    const payload = {
      title: currentPlan.concept?.title || `${currentInput.eventType} plan`,
      eventType: currentInput.eventType,
      city: currentInput.city,
      startsAt: currentInput.date
        ? new Date(`${currentInput.date}T12:00:00`).toISOString()
        : "",
      guests: currentInput.guests,
      budget: currentInput.budget,
      currency: currentInput.currency,
      plan: currentPlan,
      input: currentInput,
      completed: [...completed],
    };
    const { data } = await api(
      savedPlanId
        ? `/api/plans/${encodeURIComponent(savedPlanId)}`
        : "/api/plans",
      {
        method: savedPlanId ? "PATCH" : "POST",
        body: payload,
      },
    );
    savedPlanId = data._id || savedPlanId;
    toast(
      updating
        ? "Plan changes saved to your account."
        : "Plan saved to your account.",
    );
    document.dispatchEvent(
      new CustomEvent("eventease:plan-saved", { detail: data }),
    );
  } catch (error) {
    toast(error.message, "error");
    if (error.status === 401 || error.status === 503)
      document.dispatchEvent(new CustomEvent("eventease:auth-needed"));
  }
}

export function openPlanner(prefill = {}) {
  savedPlanId = null;
  form.reset();
  resultBox.hidden = true;
  resultBox.replaceChildren();
  form.hidden = false;
  $("#planner-error").hidden = true;
  showStep(0);
  for (const [key, value] of Object.entries(prefill)) {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  }
  if (!dialog.open) dialog.showModal();
}

export function openSavedPlan(record) {
  if (!record?.plan || !record?._id)
    return toast("This saved plan could not be opened.", "error");
  const date = record.startsAt
    ? new Date(record.startsAt).toISOString().slice(0, 10)
    : "";
  const defaults = {
    eventType: record.eventType || "Gathering",
    city: record.city || "",
    country: "",
    format: "in-person",
    date,
    durationHours: 4,
    guests: record.guests || 1,
    budget: record.budget || 0,
    currency: record.currency || "INR",
    style: "",
    atmosphere: "",
    setting: "either",
    food: "",
    dietary: "",
    decor: "",
    entertainment: "",
    accessibility: "",
    notes: "",
  };
  currentInput = {
    ...defaults,
    ...(record.input || {}),
    eventType: record.eventType || defaults.eventType,
    city: record.city ?? record.input?.city ?? defaults.city,
    date: record.startsAt
      ? new Date(record.startsAt).toISOString().slice(0, 10)
      : (record.input?.date ?? defaults.date),
    guests: record.guests ?? record.input?.guests ?? defaults.guests,
    budget: record.budget ?? record.input?.budget ?? defaults.budget,
    currency: record.currency ?? record.input?.currency ?? defaults.currency,
  };
  currentPlan = structuredClone(record.plan);
  completed = new Set(record.completed || []);
  currentNote =
    "Saved draft. Make it yours; all amounts remain planning estimates.";
  currentSource = "saved";
  savedPlanId = String(record._id);
  form.reset();
  for (const [key, value] of Object.entries(currentInput)) {
    const field = form.elements.namedItem(key);
    if (field && value !== undefined && value !== null) field.value = value;
  }
  form.hidden = true;
  resultBox.hidden = false;
  renderPlan();
  if (!dialog.open) dialog.showModal();
}
$("#wizard-next").addEventListener("click", () => {
  const active = $$(".wizard-step", form)[step];
  const required = $$("[required]", active);
  const invalid = required.find((field) => !field.reportValidity());
  if (!invalid) showStep(Math.min(step + 1, 2));
});
$("#wizard-back").addEventListener("click", () =>
  showStep(Math.max(0, step - 1)),
);
form.addEventListener("submit", generate);
resultBox.addEventListener("input", (event) => {
  if (event.target.matches("[data-check]")) {
    event.target.checked
      ? completed.add(event.target.dataset.check)
      : completed.delete(event.target.dataset.check);
  }
});
resultBox.addEventListener("click", (event) => {
  if (event.target.closest("[data-regenerate]")) return;
});
document.addEventListener("eventease:festival", (event) =>
  openPlanner({ eventType: event.detail.name, notes: event.detail.idea }),
);
