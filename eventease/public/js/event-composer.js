import { api } from "./api.js";
import { $, toast } from "./utils.js";

const dialog = $("#event-create-dialog");
const form = $("#event-create-form");
const errorBox = $("#event-create-error");
const submit = form.querySelector('[type="submit"]');

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function openEventComposer() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const field = form.elements.startsAt;
  field.min = localDateTimeValue(new Date());
  if (!field.value) field.value = localDateTimeValue(start);
  errorBox.hidden = true;
  if (!dialog.open) dialog.showModal();
}

$("#make-your-own").addEventListener("click", openEventComposer);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const input = Object.fromEntries(new FormData(form));
  const startsAt = new Date(input.startsAt);
  if (
    Number.isNaN(startsAt.valueOf()) ||
    startsAt.getTime() < Date.now() - 60_000
  ) {
    errorBox.textContent = "Choose a date and time in the future.";
    errorBox.hidden = false;
    form.elements.startsAt.focus();
    return;
  }
  let link = input.link.trim();
  if (link) {
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      errorBox.textContent =
        "The event page link must begin with http:// or https://.";
      errorBox.hidden = false;
      form.elements.link.focus();
      return;
    }
  }
  input.startsAt = startsAt.toISOString();
  submit.disabled = true;
  submit.textContent = "Saving the listing…";
  try {
    const { data } = await api("/api/events", { method: "POST", body: input });
    dialog.close();
    form.reset();
    toast("Your listing is now part of the community calendar.");
    document.dispatchEvent(
      new CustomEvent("eventease:refresh-events", { detail: data }),
    );
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    if (error.status === 401 || error.status === 503) {
      toast(
        error.status === 503
          ? "Account setup is required to publish; your form stays open."
          : "Sign in to publish this listing; your form stays open.",
      );
      document.dispatchEvent(new CustomEvent("eventease:auth-needed"));
    }
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Publish listing <span aria-hidden="true">↗</span>';
  }
});
