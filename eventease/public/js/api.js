export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let csrfToken = "";

export async function api(path, { method = "GET", body, signal } = {}) {
  const verb = method.toUpperCase();
  const headers = body ? { "content-type": "application/json" } : {};
  if (["POST", "PUT", "PATCH", "DELETE"].includes(verb) && csrfToken)
    headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(path, {
    method: verb,
    credentials: "same-origin",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  csrfToken = response.headers.get("X-CSRF-Token") || csrfToken;
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response. Please try again.",
      response.status,
      "BAD_RESPONSE",
    );
  }
  if (!response.ok || result.ok === false)
    throw new ApiError(
      result?.error?.message || "That request could not be completed.",
      response.status,
      result?.error?.code || "REQUEST_FAILED",
    );
  return result;
}
