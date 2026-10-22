import { api } from "./api.js";
import { $, $$, node, formatMoney, downloadCSV, toast } from "./utils.js";
import { openSavedPlan } from "./planner.js";

let guests = [];
let expenses = [];
let tasks = [];
let savedPlans = [];
let currency = "INR";
let activePlanId = null;
let signedIn = false;
let recoveryPlanId = null;
const apiPath = (type, id = "") =>
  `/api/plans/${encodeURIComponent(activePlanId)}/${type}${id ? `/${encodeURIComponent(id)}` : ""}`;
function updateCurrencyControlLock() {
  const locked = savedPlans.some((plan) => plan._id === activePlanId);
  const control = $("#budget-currency");
  control.disabled = locked;
  control.title = locked
    ? "Reopen and regenerate the plan to change its currency safely."
    : "Choose a currency before adding session-only costs.";
  $("#budget-currency-help").textContent = locked
    ? "Open and regenerate the plan to change currency without relabeling estimates."
    : "Choose your currency before adding costs. No conversion is performed.";
}
export const getActivePlanId = () => activePlanId;
export const isDashboardSignedIn = () => signedIn;
function updateSummary() {
  $("#guest-tab-count").textContent = String(guests.length);
  $("#dash-guests").textContent = String(guests.length);
  $("#dash-confirmed").textContent = String(
    guests.filter((guest) => guest.status === "confirmed").length,
  );
  const spent = expenses.reduce(
    (sum, item) => sum + (Number(item.actual) || 0),
    0,
  );
  $("#dash-spent").textContent = formatMoney(spent, currency);
  $("#dash-tasks").textContent = String(
    tasks.filter((task) => !task.done).length,
  );
  const budget = Number($("#budget-total").value) || 0;
  const remaining = budget - spent;
  $("#budget-remaining").textContent =
    `${formatMoney(Math.max(0, remaining), currency)} remaining`;
  $("#budget-spent-label").textContent =
    `${formatMoney(spent, currency)} spent`;
  const fill = $("#budget-meter-fill");
  fill.style.width = `${budget ? Math.min(100, (spent / budget) * 100) : 0}%`;
  fill.classList.toggle("over-budget", remaining < 0);
  $("#task-count-badge").textContent =
    `${tasks.filter((task) => !task.done).length} open`;
  if (remaining < 0) $("#budget-remaining").classList.add("over-budget-text");
  else $("#budget-remaining").classList.remove("over-budget-text");
  $("#budget-planned-label").textContent = `${formatMoney(
    expenses.reduce((sum, item) => sum + (Number(item.estimated) || 0), 0),
    currency,
  )} planned`;
}
function renderBudgetBreakdown() {
  const root = $("#budget-breakdown");
  if (!root) return;
  root.replaceChildren();
  const groups = new Map();
  for (const item of expenses) {
    const key = item.category || "miscellaneous";
    const row = groups.get(key) || { estimated: 0, actual: 0 };
    row.estimated += Number(item.estimated) || 0;
    row.actual += Number(item.actual) || 0;
    groups.set(key, row);
  }
  if (!groups.size) {
    root.append(
      node(
        "p",
        "chart-empty",
        "Add a categorized cost to compare estimated and actual spending.",
      ),
    );
    return;
  }
  root.append(
    node(
      "h4",
      "breakdown-heading",
      "By category · estimates alongside actuals",
    ),
  );
  for (const [category, amounts] of groups) {
    const row = node("div", "breakdown-row");
    const label = node("span", "breakdown-category", category);
    const max = Math.max(amounts.estimated, amounts.actual, 1);
    const bars = node("div", "breakdown-bars");
    for (const [kind, amount] of [
      ["Estimate", amounts.estimated],
      ["Actual", amounts.actual],
    ]) {
      const track = node(
        "div",
        `breakdown-track breakdown-${kind.toLowerCase()}`,
      );
      track.setAttribute("role", "img");
      track.setAttribute(
        "aria-label",
        `${category} ${kind.toLowerCase()}: ${formatMoney(amount, currency)}`,
      );
      const fill = node("span");
      fill.style.width = `${Math.min(100, (amount / max) * 100)}%`;
      track.append(fill);
      bars.append(track);
    }
    const values = node(
      "span",
      "breakdown-values",
      `${formatMoney(amounts.estimated, currency)} / ${formatMoney(amounts.actual, currency)}`,
    );
    row.append(label, bars, values);
    root.append(row);
  }
  const legend = node("p", "chart-legend", "● Estimated     ● Actual");
  root.append(legend);
}

function editorField({
  name,
  label,
  value = "",
  type = "text",
  max = 160,
  options,
}) {
  const wrapper = node("label", "mini-edit-field", label);
  let input;
  if (options) {
    input = document.createElement("select");
    for (const [optionValue, optionLabel] of options) {
      const option = node("option", "", optionLabel);
      option.value = optionValue;
      option.selected = String(value) === optionValue;
      input.append(option);
    }
  } else {
    input = document.createElement(type === "textarea" ? "textarea" : "input");
    input.type = type === "textarea" ? undefined : type;
    if (type === "textarea") input.rows = 2;
    input.maxLength = max;
    if (type === "number") input.min = "0";
  }
  input.name = name;
  input.value = value || "";
  if (name === "name" || name === "title") input.required = true;
  wrapper.append(input);
  return wrapper;
}

function editorActions(form, onCancel) {
  const actions = node("div", "mini-edit-actions");
  const save = node("button", "button button-ink button-small", "Save");
  save.type = "submit";
  const cancel = node("button", "button button-quiet button-small", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", onCancel);
  actions.append(save, cancel);
  form.append(actions);
}
async function mutateOrKeep(resource, data) {
  if (!signedIn || !activePlanId) return null;
  try {
    return (await api(apiPath(resource), { method: "POST", body: data })).data;
  } catch (error) {
    toast(error.message, "error");
    throw error;
  }
}
function renderGuests() {
  const list = $("#guest-list");
  list.replaceChildren();
  $("#guest-invited").textContent = String(guests.length);
  $("#guest-confirmed").textContent = String(
    guests.filter((guest) => guest.status === "confirmed").length,
  );
  $("#guest-declined").textContent = String(
    guests.filter((guest) => guest.status === "declined").length,
  );
  $("#guest-pending").textContent = String(
    guests.filter((guest) => guest.status === "pending").length,
  );
  const filter = $("#guest-status-filter")?.value || "all";
  guests
    .filter((guest) => filter === "all" || guest.status === filter)
    .forEach((guest) => {
      const row = node("div", "mini-row");
      const name = node("strong", "", guest.name);
      const contactText =
        [
          guest.email,
          guest.phone,
          guest.dietaryNotes,
          guest.specialRequirements,
        ]
          .filter(Boolean)
          .join(" · ") || "No notes";
      const note = node("span", "mini-note", contactText);
      const status = document.createElement("select");
      status.setAttribute("aria-label", `RSVP status for ${guest.name}`);
      [
        ["pending", "Awaiting"],
        ["confirmed", "Confirmed"],
        ["declined", "Declined"],
      ].forEach(([value, label]) => {
        const option = node("option", "", label);
        option.value = value;
        option.selected = guest.status === value;
        status.append(option);
      });
      status.addEventListener("change", async () => {
        const previous = guest.status;
        guest.status = status.value;
        updateSummary();
        if (guest._id && signedIn) {
          try {
            await api(apiPath("guests", guest._id), {
              method: "PATCH",
              body: { status: guest.status },
            });
          } catch (error) {
            guest.status = previous;
            status.value = previous;
            toast(error.message, "error");
          }
        }
        renderGuests();
      });
      const actions = node("div", "mini-actions");
      const edit = node("button", "text-link", "Edit");
      edit.type = "button";
      edit.setAttribute("aria-label", `Edit details for ${guest.name}`);
      edit.addEventListener("click", () => {
        const editor = node("form", "mini-edit-form guest-edit-form");
        editor.append(
          editorField({
            name: "name",
            label: "Name",
            value: guest.name,
            max: 100,
          }),
          editorField({
            name: "email",
            label: "Email",
            value: guest.email,
            type: "email",
            max: 254,
          }),
          editorField({
            name: "phone",
            label: "Phone",
            value: guest.phone,
            type: "tel",
            max: 40,
          }),
          editorField({
            name: "dietaryNotes",
            label: "Dietary notes",
            value: guest.dietaryNotes,
            type: "textarea",
            max: 500,
          }),
          editorField({
            name: "specialRequirements",
            label: "Access or other needs",
            value: guest.specialRequirements,
            type: "textarea",
            max: 500,
          }),
        );
        editorActions(editor, renderGuests);
        editor.addEventListener("submit", async (editEvent) => {
          editEvent.preventDefault();
          const updates = Object.fromEntries(new FormData(editor));
          updates.name = updates.name.trim();
          try {
            if (guest._id && signedIn)
              await api(apiPath("guests", guest._id), {
                method: "PATCH",
                body: updates,
              });
            Object.assign(guest, updates);
            renderGuests();
            toast("Guest details updated.");
          } catch (error) {
            toast(error.message, "error");
          }
        });
        row.replaceChildren(editor);
        editor.elements.namedItem("name").focus();
      });
      const remove = node("button", "icon-button-card", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${guest.name}`);
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Remove ${guest.name} from the guest list?`))
          return;
        if (guest._id && signedIn) {
          try {
            await api(apiPath("guests", guest._id), { method: "DELETE" });
          } catch (error) {
            return toast(error.message, "error");
          }
        }
        const index = guests.indexOf(guest);
        if (index !== -1) guests.splice(index, 1);
        renderGuests();
        updateSummary();
      });
      actions.append(edit, remove);
      row.append(name, note, status, actions);
      list.append(row);
    });
}
function renderExpenses() {
  const list = $("#expense-list");
  list.replaceChildren();
  expenses.forEach((expense, index) => {
    const row = node("div", "expense-row");
    row.append(
      node("span", "expense-title", expense.title),
      node("span", "expense-category", expense.category),
      node(
        "span",
        "expense-estimate",
        `Est. ${formatMoney(expense.estimated, expense.currency || currency)}`,
      ),
    );
    const actual = document.createElement("input");
    actual.className = "expense-actual";
    actual.type = "number";
    actual.min = "0";
    actual.value = Number(expense.actual) || 0;
    actual.setAttribute("aria-label", `Actual cost for ${expense.title}`);
    actual.addEventListener("change", async () => {
      const previous = expense.actual;
      expense.actual = Math.max(0, Number(actual.value) || 0);
      updateSummary();
      renderBudgetBreakdown();
      if (expense._id && signedIn) {
        try {
          await api(apiPath("expenses", expense._id), {
            method: "PATCH",
            body: { actual: expense.actual },
          });
        } catch (error) {
          expense.actual = previous;
          actual.value = previous;
          updateSummary();
          renderBudgetBreakdown();
          toast(error.message, "error");
        }
      }
    });
    const actions = node("div", "mini-actions expense-row-actions");
    const edit = node("button", "text-link", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit ${expense.title}`);
    edit.addEventListener("click", () => {
      const editor = node("form", "mini-edit-form expense-edit-form");
      editor.append(
        editorField({
          name: "title",
          label: "Expense",
          value: expense.title,
          max: 120,
        }),
        editorField({
          name: "category",
          label: "Category",
          value: expense.category,
          options: [
            ["venue", "Venue"],
            ["food", "Food"],
            ["decoration", "Decoration"],
            ["entertainment", "Entertainment"],
            ["travel", "Travel"],
            ["gifts", "Gifts"],
            ["miscellaneous", "Miscellaneous"],
          ],
        }),
        editorField({
          name: "estimated",
          label: "Estimate",
          value: expense.estimated,
          type: "number",
          max: 100000000,
        }),
      );
      editorActions(editor, renderExpenses);
      editor.addEventListener("submit", async (editEvent) => {
        editEvent.preventDefault();
        const updates = Object.fromEntries(new FormData(editor));
        updates.title = updates.title.trim();
        updates.estimated = Number(updates.estimated);
        try {
          if (expense._id && signedIn)
            await api(apiPath("expenses", expense._id), {
              method: "PATCH",
              body: updates,
            });
          Object.assign(expense, updates);
          renderExpenses();
          updateSummary();
          toast("Budget item updated.");
        } catch (error) {
          toast(error.message, "error");
        }
      });
      row.replaceChildren(editor);
      editor.elements.namedItem("title").focus();
    });
    const remove = node("button", "icon-button-card", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${expense.title}`);
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Remove “${expense.title}” from this budget?`))
        return;
      if (expense._id && signedIn) {
        try {
          await api(apiPath("expenses", expense._id), { method: "DELETE" });
        } catch (error) {
          return toast(error.message, "error");
        }
      }
      expenses.splice(index, 1);
      renderExpenses();
      renderBudgetBreakdown();
      updateSummary();
    });
    actions.append(edit, remove);
    row.append(actual, actions);
    list.append(row);
  });
  renderBudgetBreakdown();
}
function renderTasks() {
  const list = $("#task-list");
  list.replaceChildren();
  tasks.forEach((task, index) => {
    const row = node("div", `mini-row task-row${task.done ? " is-done" : ""}`);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Mark ${task.title} complete`);
    checkbox.addEventListener("change", async () => {
      task.done = checkbox.checked;
      row.classList.toggle("is-done", task.done);
      updateSummary();
      if (task._id && signedIn) {
        try {
          await api(apiPath("tasks", task._id), {
            method: "PATCH",
            body: { done: task.done },
          });
        } catch (error) {
          toast(error.message, "error");
        }
      }
    });
    const name = node("span", "task-title", task.title);
    const dueDate = task.dueAt ? new Date(task.dueAt) : null;
    const time = (value) =>
      value
        ? new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(value))
        : "";
    const dueLabel =
      dueDate && !Number.isNaN(dueDate.valueOf())
        ? `Due ${dueDate.toLocaleDateString()}${task.startsAt ? ` · ${time(task.startsAt)}${task.endsAt ? `–${time(task.endsAt)}` : ""}` : ""}`
        : "No deadline";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = !task.done && dueDate && dueDate < today;
    const upcoming = !task.done && dueDate && dueDate >= today;
    const timing = node(
      "small",
      `task-timing${overdue ? " is-overdue" : ""}`,
      overdue
        ? `Overdue · ${dueLabel}`
        : upcoming
          ? `Upcoming · ${dueLabel}`
          : dueLabel,
    );
    const priority = node(
      "span",
      `priority priority-${task.priority}`,
      task.category === "Event-day agenda" ? "Agenda" : task.priority,
    );
    const remove = node("button", "icon-button-card", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove task ${task.title}`);
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Remove “${task.title}” from the to-do list?`))
        return;
      if (task._id && signedIn) {
        try {
          await api(apiPath("tasks", task._id), { method: "DELETE" });
        } catch (error) {
          return toast(error.message, "error");
        }
      }
      tasks.splice(index, 1);
      renderTasks();
      updateSummary();
    });
    row.append(checkbox, name, timing, priority, remove);
    list.append(row);
  });
}
async function loadPlanResources() {
  guests = [];
  expenses = [];
  tasks = [];
  if (signedIn && activePlanId) {
    try {
      const results = await Promise.all(
        ["guests", "expenses", "tasks"].map((name) => api(apiPath(name))),
      );
      [guests, expenses, tasks] = results.map((result) => result.data);
      renderGuests();
      renderExpenses();
      renderTasks();
      updateSummary();
      return;
    } catch (error) {
      if ([401, 503].includes(error.status)) throw error;
      toast(error.message, "error");
    }
  }
  renderGuests();
  renderExpenses();
  renderTasks();
  updateSummary();
}
export async function loadSavedPlans(preferredId = null) {
  try {
    const { data } = await api("/api/plans");
    savedPlans = data;
    signedIn = true;
    const control = $("#saved-plans-control");
    const select = $("#saved-plan-select");
    select.replaceChildren();
    savedPlans.forEach((plan) => {
      const option = node("option", "", plan.title);
      option.value = plan._id;
      select.append(option);
    });
    control.hidden = !savedPlans.length;
    if (savedPlans.length) {
      activePlanId =
        preferredId && savedPlans.some((plan) => plan._id === preferredId)
          ? preferredId
          : savedPlans[0]._id;
      select.value = activePlanId;
      const chosen = savedPlans.find((plan) => plan._id === activePlanId);
      $("#budget-total").value = Number(chosen.budget) || 0;
      currency = chosen.currency || "INR";
      $("#budget-currency").value = currency;
      $("#dashboard-title").textContent = chosen.title;
      $("#dashboard-description").textContent =
        `${chosen.guests} guests · ${chosen.city || "Location to decide"} · ${chosen.eventType}`;
    } else {
      activePlanId = null;
      $("#dashboard-title").textContent = "No plans saved here yet.";
      $("#dashboard-description").textContent =
        "Start a draft and save it to connect your guest list, expenses and tasks.";
    }
    recoveryPlanId = activePlanId;
    updateCurrencyControlLock();
    delete $("#workspace-connect").dataset.retry;
    $("#workspace-notice").hidden = true;
    $(".workspace-empty").hidden = savedPlans.length > 0;
    await loadPlanResources();
    await loadSavedEvents();
    document.dispatchEvent(
      new CustomEvent("eventease:plan-changed", {
        detail: { planId: activePlanId },
      }),
    );
  } catch (error) {
    if (error.status === 401) signedIn = false;
    savedPlans = [];
    activePlanId = null;
    updateCurrencyControlLock();
    $("#saved-plans-control").hidden = true;
    $(".workspace-empty").hidden = false;
    $("#workspace-notice").hidden = false;
    $("#workspace-notice").querySelector("span").textContent =
      error.status === 401
        ? "Your sign-in session expired. Sign in again to reconnect this workspace."
        : "Your account session is still active, but saved plans could not be loaded. Nothing has been deleted. Check MongoDB and retry when it is reachable.";
    $("#workspace-connect").textContent =
      error.status === 401 ? "Sign in again ↗" : "Retry saved plans ↻";
    if (error.status === 401) delete $("#workspace-connect").dataset.retry;
    else $("#workspace-connect").dataset.retry = "true";
    $("#dashboard-title").textContent = "Saved workspace unavailable";
    $("#dashboard-description").textContent =
      "Your saved information has not been replaced. Reconnect when the account service is available.";
    guests = [];
    expenses = [];
    tasks = [];
    renderGuests();
    renderExpenses();
    renderTasks();
    updateSummary();
    toast(error.message, "error");
  }
}

export async function loadSavedEvents() {
  const root = $("#saved-event-list");
  const empty = $("#saved-event-empty");
  root.replaceChildren();
  if (!signedIn) {
    empty.hidden = false;
    empty.textContent = "Sign in to keep a list of events you like.";
    return;
  }
  empty.hidden = false;
  empty.textContent = "Loading the events you saved…";
  try {
    const { data: saved } = await api("/api/auth/saved");
    const results = await Promise.all(
      saved.slice(0, 24).map(async (item) => {
        try {
          return (await api(`/api/events/${encodeURIComponent(item.eventId)}`))
            .data;
        } catch {
          return null;
        }
      }),
    );
    const events = results.filter(Boolean);
    for (const event of events) {
      const row = node("article", "saved-event-item");
      const summary = node("div", "saved-event-summary");
      summary.append(
        node("strong", "", event.title),
        node(
          "span",
          "",
          `${event.category || "Gathering"} · ${event.city || "Location to be confirmed"}`,
        ),
        node(
          "small",
          "",
          `${new Date(event.startsAt).toLocaleDateString()} · ${event.source === "curated" ? "Curated sample" : event.source === "verified-external" ? "Verified external listing" : "Created by a member"}`,
        ),
      );
      const actions = node("div", "saved-event-actions");
      const open = node("button", "text-link", "Details ↗");
      open.type = "button";
      open.addEventListener("click", () =>
        document.dispatchEvent(
          new CustomEvent("eventease:open-saved-event", {
            detail: { id: event.id },
          }),
        ),
      );
      const remove = node("button", "icon-button-card", "×");
      remove.type = "button";
      remove.setAttribute(
        "aria-label",
        `Remove ${event.title} from saved events`,
      );
      remove.addEventListener("click", async () => {
        try {
          await api(`/api/auth/saved/${encodeURIComponent(event.id)}`, {
            method: "DELETE",
          });
          toast("Removed from your saved events.");
          await loadSavedEvents();
          document.dispatchEvent(new CustomEvent("eventease:saved-changed"));
        } catch (error) {
          toast(error.message, "error");
        }
      });
      actions.append(open, remove);
      row.append(summary, actions);
      root.append(row);
    }
    empty.hidden = events.length > 0;
    empty.textContent = events.length
      ? ""
      : "Nothing saved yet. Bookmark an event to keep it close.";
  } catch (error) {
    empty.hidden = false;
    empty.textContent =
      error.status === 401
        ? "Your session has ended. Sign in again to view saved events."
        : error.message;
  }
}
$("#saved-plan-select").addEventListener("change", async (event) => {
  activePlanId = event.target.value || null;
  const chosen = savedPlans.find((plan) => plan._id === activePlanId);
  if (chosen) {
    $("#budget-total").value = Number(chosen.budget) || 0;
    currency = chosen.currency || "INR";
    $("#budget-currency").value = currency;
  }
  updateCurrencyControlLock();
  await loadPlanResources();
  document.dispatchEvent(
    new CustomEvent("eventease:plan-changed", {
      detail: { planId: activePlanId },
    }),
  );
});
$("#edit-saved-plan").addEventListener("click", () => {
  const chosen = savedPlans.find((plan) => plan._id === activePlanId);
  if (chosen) openSavedPlan(chosen);
});
$("#guest-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const saved = await mutateOrKeep("guests", data);
    guests.push(saved || data);
    event.currentTarget.reset();
    renderGuests();
    updateSummary();
    toast(
      saved
        ? "Guest saved to this plan."
        : "Guest added for this page session.",
    );
  } catch {
    /* the API error is already shown */
  }
});
$("#export-guests").addEventListener("click", () => {
  if (!guests.length) return toast("Add a guest before exporting.", "error");
  downloadCSV("eventease-guests.csv", [
    ["Name", "Email", "Phone", "RSVP", "Dietary notes", "Special requirements"],
    ...guests.map(
      ({ name, email, phone, status, dietaryNotes, specialRequirements }) => [
        name,
        email,
        phone,
        status,
        dietaryNotes,
        specialRequirements,
      ],
    ),
  ]);
});
$("#guest-status-filter").addEventListener("change", renderGuests);
$("#copy-invitation").addEventListener("click", async () => {
  const plan = savedPlans.find((item) => item._id === activePlanId);
  const eventName = plan?.title || "our get-together";
  const date = plan?.startsAt
    ? ` on ${new Date(plan.startsAt).toLocaleDateString()}`
    : "";
  const place = plan?.city ? ` in ${plan.city}` : "";
  const message = `I’d love you to join us for ${eventName}${date}${place}. More details to come — hope you can make it!`;
  try {
    await navigator.clipboard.writeText(message);
    toast("Invitation text copied. Nothing was sent.");
  } catch {
    const input = document.createElement("textarea");
    input.value = message;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    toast(
      copied ? "Invitation text copied. Nothing was sent." : message,
      copied ? "default" : "error",
    );
  }
});
$("#expense-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const payload = {
    title: data.title,
    category: data.category.toLowerCase(),
    estimated: Number(data.estimated) || 0,
    actual: Number(data.actual) || 0,
    currency,
  };
  try {
    const saved = await mutateOrKeep("expenses", payload);
    expenses.push(saved || payload);
    event.currentTarget.reset();
    renderExpenses();
    updateSummary();
    toast(
      saved
        ? "Expense saved to this plan."
        : "Cost added to this page session.",
    );
  } catch {
    /* the API error is already shown */
  }
});
$("#export-expenses").addEventListener("click", () => {
  if (!expenses.length)
    return toast("Add an expense before exporting.", "error");
  downloadCSV("eventease-expenses.csv", [
    ["Expense", "Category", "Estimated", "Actual", "Currency"],
    ...expenses.map(
      ({ title, category, estimated, actual, currency: rowCurrency }) => [
        title,
        category,
        estimated,
        actual,
        rowCurrency || currency,
      ],
    ),
  ]);
});
$("#task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (
    (data.startsAt || data.endsAt) &&
    (!data.dueAt || !data.startsAt || !data.endsAt)
  )
    return toast("Add a date and both times for an agenda item.", "error");
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt)
    return toast(
      "The agenda end time must be later than its start time.",
      "error",
    );
  const isoTime = (date, time) =>
    date && time ? new Date(`${date}T${time}`).toISOString() : undefined;
  const payload = {
    title: data.title.trim(),
    ...(data.dueAt
      ? { dueAt: new Date(`${data.dueAt}T12:00:00`).toISOString() }
      : {}),
    ...(data.startsAt ? { startsAt: isoTime(data.dueAt, data.startsAt) } : {}),
    ...(data.endsAt ? { endsAt: isoTime(data.dueAt, data.endsAt) } : {}),
    priority: data.priority,
    category: data.category || "General",
    done: false,
  };
  try {
    const saved = await mutateOrKeep("tasks", payload);
    tasks.push(saved || payload);
    event.currentTarget.reset();
    renderTasks();
    updateSummary();
    toast(
      saved
        ? "To-do saved to this plan."
        : "To-do added for this page session.",
    );
  } catch {
    /* the API error is already shown */
  }
});
$("#budget-total").addEventListener("input", updateSummary);
async function persistSelectedBudget() {
  const plan = savedPlans.find((item) => item._id === activePlanId);
  if (!signedIn || !plan) return;
  try {
    const budget = Number($("#budget-total").value) || 0;
    const existing =
      plan.input && typeof plan.input === "object" ? plan.input : {};
    const input = {
      country: "",
      format: "in-person",
      date: plan.startsAt
        ? new Date(plan.startsAt).toISOString().slice(0, 10)
        : existing.date || "",
      durationHours: 4,
      style: "",
      atmosphere: "",
      setting: "either",
      food: "",
      dietary: "",
      decor: "",
      entertainment: "",
      accessibility: "",
      notes: "",
      ...existing,
      eventType: plan.eventType || existing.eventType || "Gathering",
      city: plan.city ?? existing.city ?? "",
      guests: Number(plan.guests) || Number(existing.guests) || 1,
      budget,
      currency,
    };
    await api(`/api/plans/${encodeURIComponent(activePlanId)}`, {
      method: "PATCH",
      body: { budget, currency, input },
    });
    plan.budget = budget;
    plan.currency = currency;
    plan.input = input;
  } catch (error) {
    $("#budget-total").value = Number(plan.budget) || 0;
    currency = plan.currency || "INR";
    $("#budget-currency").value = currency;
    updateSummary();
    toast(error.message, "error");
  }
}
$("#budget-total").addEventListener("change", persistSelectedBudget);
$("#budget-currency").addEventListener("change", async (event) => {
  if (activePlanId && savedPlans.some((plan) => plan._id === activePlanId)) {
    event.target.value = currency;
    toast(
      "Reopen this plan and regenerate its estimates to change currency safely.",
      "error",
    );
    return;
  }
  currency = event.target.value;
  updateSummary();
  renderExpenses();
  await persistSelectedBudget();
});
$$(".workspace-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    $$(".workspace-tab").forEach((button) => {
      const selected = button === tab;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    $$(".workspace-panel").forEach((panel) => {
      const active = panel.dataset.panel === tab.dataset.tab;
      panel.hidden = !active;
      panel.classList.toggle("is-visible", active);
    });
  }),
);
document.addEventListener("eventease:signed-in", () => loadSavedPlans());
document.addEventListener("eventease:retry-plans", () =>
  loadSavedPlans(recoveryPlanId),
);
document.addEventListener("eventease:signed-out", () => {
  signedIn = false;
  activePlanId = null;
  savedPlans = [];
  guests = [];
  expenses = [];
  tasks = [];
  $("#saved-plans-control").hidden = true;
  $(".workspace-empty").hidden = false;
  $("#saved-event-list").replaceChildren();
  $("#saved-event-empty").hidden = false;
  $("#saved-event-empty").textContent =
    "Sign in to keep a list of events you like.";
  renderGuests();
  renderExpenses();
  renderTasks();
  updateSummary();
});
document.addEventListener("eventease:saved-changed", loadSavedEvents);
document.addEventListener("eventease:plan-saved", (event) =>
  loadSavedPlans(String(event.detail._id)),
);
updateSummary();
