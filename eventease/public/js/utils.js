export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

export function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

export function toast(message, tone = "default") {
  const region = $("#toast-region");
  const item = node("div", `toast toast-${tone}`, message);
  region.append(item);
  requestAnimationFrame(() => item.classList.add("is-visible"));
  window.setTimeout(() => {
    item.classList.remove("is-visible");
    window.setTimeout(() => item.remove(), 250);
  }, 3800);
}

export function formatDate(
  date,
  options = { month: "short", day: "numeric", year: "numeric" },
) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) return "Date to be confirmed";
  return new Intl.DateTimeFormat(undefined, options).format(parsed);
}

export function formatMoney(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${Math.round(Number(amount) || 0).toLocaleString()}`;
  }
}

export function downloadCSV(filename, rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const contents = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${contents}`], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function safeHttpUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
