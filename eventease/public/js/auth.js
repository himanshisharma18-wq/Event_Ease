import { $, $$, toast } from "./utils.js";
import { api } from "./api.js";

let user = null;
let mode = "login";
const dialog = $("#auth-dialog");
const form = $("#auth-form");
function setMode(value) {
  mode = value;
  const registering = mode === "register";
  $$(".auth-tab").forEach((button) => {
    const selected = button.dataset.authMode === mode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  $(".auth-name").hidden = !registering;
  form.elements.name.required = registering;
  form.elements.password.autocomplete = registering
    ? "new-password"
    : "current-password";
  const title = $("#auth-title");
  const emphasis = document.createElement("em");
  emphasis.textContent = registering ? "official." : "together.";
  title.replaceChildren(registering ? "Make it " : "Keep it ", emphasis);
  const label = registering ? "Create my account" : "Sign in";
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  $(".auth-submit").replaceChildren(label, " ", arrow);
}
export function openAuth() {
  $("#auth-error").hidden = true;
  if (!dialog.open) dialog.showModal();
}
export async function refreshAuth() {
  try {
    const previousUser = user;
    const { data } = await api("/api/auth/me");
    user = data.user;
    $("#workspace-profile").hidden = !user;
    $("#auth-setup-note").textContent = data.databaseConfigured
      ? "Your email and password are stored securely for this event workspace."
      : "MongoDB Atlas and a private SESSION_SECRET are required for secure accounts and saved plans. Your form stays here if setup isn’t ready yet.";
    const noticeCopy = data.databaseConfigured
      ? "Sign in or create an account to keep event plans, guest lists and budgets between visits."
      : "Connect MongoDB Atlas and add a private SESSION_SECRET to create an account and keep plans. You can still explore ideas and draft a plan right now.";
    delete $("#workspace-connect").dataset.retry;
    $("#workspace-notice").querySelector("span").textContent = noticeCopy;
    $("#workspace-connect").textContent = data.databaseConfigured
      ? "Sign in"
      : "Account setup ↗";
    $("#workspace-notice").hidden = Boolean(data.databaseConfigured && user);
    $("#account-label").textContent = user
      ? `Planning with ${user.name}`
      : "Your workspace is ready";
    $("#header-login").textContent = user ? "Sign out" : "Sign in";
    $("#workspace-login").textContent = user ? "Sign out" : "Sign in ↗";
    if (user) {
      $("#dashboard-title").textContent = `Good to have you, ${user.name}.`;
      $("#dashboard-description").textContent =
        "Your saved plans and people details are ready when you are.";
    }
    if (previousUser && !user)
      document.dispatchEvent(new CustomEvent("eventease:signed-out"));
    return user;
  } catch (error) {
    toast(
      error.message || "The account service could not be reached.",
      "error",
    );
    return null;
  }
}
export function currentUser() {
  return user;
}

$$(".auth-tab").forEach((button) =>
  button.addEventListener("click", () => setMode(button.dataset.authMode)),
);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = $("#auth-error");
  errorBox.hidden = true;
  const body = Object.fromEntries(new FormData(form));
  const submit = $(".auth-submit");
  submit.disabled = true;
  submit.textContent = "One moment…";
  try {
    const { data } = await api(`/api/auth/${mode}`, { method: "POST", body });
    user = data.user;
    dialog.close();
    await refreshAuth();
    toast(`Good to see you, ${user.name}.`);
    document.dispatchEvent(new CustomEvent("eventease:signed-in"));
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    submit.disabled = false;
    setMode(mode);
  }
});
async function signOut() {
  try {
    await api("/api/auth/logout", { method: "POST" });
    await refreshAuth();
    toast("You’re signed out.");
  } catch (error) {
    toast(error.message, "error");
  }
}
$("#header-login").addEventListener("click", () =>
  user ? signOut() : openAuth(),
);
$("#workspace-login").addEventListener("click", () =>
  user ? signOut() : openAuth(),
);
$("#workspace-connect").addEventListener("click", (event) => {
  if (event.currentTarget.dataset.retry === "true") {
    document.dispatchEvent(new CustomEvent("eventease:retry-plans"));
    return;
  }
  openAuth();
});
$("#workspace-profile").addEventListener("click", async () => {
  if (!user) return openAuth();
  const name = window.prompt("Name shown on your EventEase account", user.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 90) {
    toast("Use a name between 2 and 90 characters.", "error");
    return;
  }
  try {
    const { data } = await api("/api/auth/profile", {
      method: "PATCH",
      body: { name: trimmed },
    });
    user = data.user;
    await refreshAuth();
    toast("Your profile is up to date.");
  } catch (error) {
    toast(error.message, "error");
  }
});
document.addEventListener("eventease:auth-needed", openAuth);
setMode("login");
