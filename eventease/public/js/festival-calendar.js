import { $, node } from "./utils.js";

let guides = [];
let view = new Date();
let selected = null;
const monthNames = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
function render() {
  const root = $("#festival-calendar");
  if (!root) return;
  root.replaceChildren();
  const head = node("div", "calendar-head");
  const title = node("h3", "", monthNames.format(view));
  const controls = node("div", "calendar-controls");
  for (const [step, label] of [
    [-1, "Previous month"],
    [1, "Next month"],
  ]) {
    const button = node("button", "calendar-nav", step < 0 ? "←" : "→");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() + step, 1);
      render();
    });
    controls.append(button);
  }
  head.append(node("p", "eyebrow", "A NOTE ON THE SEASON"), title, controls);
  root.append(head);
  const scope = guides[0];
  const note = node(
    "p",
    "calendar-note",
    "Highlights show dates returned by the selected country or region calendar. An unhighlighted lunar festival has no confirmed date in this feed yet; city-level programs and moon sightings can differ.",
  );
  if (scope)
    note.setAttribute(
      "aria-label",
      `Selected calendar: ${scope.region || scope.countryCode || "all locations"}`,
    );
  root.append(note);
  const grid = node("div", "calendar-grid");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", monthNames.format(view));
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day) => {
    const label = node("span", "calendar-day-label", day);
    label.setAttribute("role", "columnheader");
    grid.append(label);
  });
  const offset =
    (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(
    view.getFullYear(),
    view.getMonth() + 1,
    0,
  ).getDate();
  for (let i = 0; i < offset; i += 1) {
    const blank = node("span", "calendar-blank");
    blank.setAttribute("role", "gridcell");
    grid.append(blank);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateString = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const matching = guides.filter((guide) => guide.nextDate === dateString);
    const button = node(
      "button",
      `calendar-day${matching.length ? " has-event" : ""}${dateString === selected ? " is-selected" : ""}`,
      day,
    );
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute(
      "aria-label",
      matching.length
        ? `${dateString}: ${matching.map((item) => `${item.name}, ${item.confidence}`).join("; ")}`
        : dateString,
    );
    if (matching.length) {
      const mark = node("span", "calendar-mark", "•");
      mark.setAttribute("aria-hidden", "true");
      button.append(mark);
    }
    button.addEventListener("click", () => {
      selected = dateString;
      render();
      showDay(matching, dateString);
    });
    grid.append(button);
  }
  root.append(grid);
  const legend = node("p", "calendar-legend");
  legend.append(
    node("span", "calendar-key", "•"),
    node("span", "", "Published local-calendar date"),
  );
  root.append(legend);
}
function showDay(items, dateString) {
  const detail = $("#festival-calendar-detail");
  if (!detail) return;
  detail.replaceChildren();
  const title = node(
    "strong",
    "",
    new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${dateString}T12:00:00`)),
  );
  detail.append(title);
  if (!items.length)
    detail.append(
      node("p", "", "No festival date in this guide falls on this day."),
    );
  else
    items.forEach((item) => {
      detail.append(
        node("h4", "", item.name),
        node("p", "", `${item.confidence}. ${item.idea}`),
      );
    });
}
export function renderFestivalCalendar(data) {
  guides = data;
  view = new Date();
  selected = null;
  let root = $("#festival-calendar");
  if (!root) {
    root = node("section", "festival-calendar-panel");
    root.id = "festival-calendar";
    root.setAttribute("aria-label", "Festival calendar");
    $("#festival-list").after(root);
  }
  let detail = $("#festival-calendar-detail");
  if (!detail) {
    detail = node("div", "festival-calendar-detail");
    detail.id = "festival-calendar-detail";
    root.after(detail);
  }
  render();
}
