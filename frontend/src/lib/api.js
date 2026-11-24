function resolveBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (typeof window !== "undefined") {
    // Route local dev requests through Vite's /api proxy so cookies & CSRF stay strictly same-origin
    if (
      window.location.port === "5173" &&
      (raw.includes("localhost:8000") || raw.includes("127.0.0.1:8000"))
    ) {
      return "";
    }
    try {
      const parsed = new URL(raw);
      const browserHost = window.location.hostname;
      if (
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        (browserHost === "localhost" || browserHost === "127.0.0.1") &&
        parsed.hostname !== browserHost
      ) {
        parsed.hostname = browserHost;
        return parsed.origin;
      }
    } catch {
      // ignore URL parse error
    }
  }
  return raw;
}

const BASE_URL = resolveBaseUrl();

let memoryCSRFToken = "";

/**
 * Read the csrftoken cookie directly from document.cookie.
 */
function getCookieCSRFToken() {
  if (typeof document === "undefined" || !document.cookie) return "";
  const parts = document.cookie.split(";");
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (part.startsWith("csrftoken=")) {
      const val = decodeURIComponent(part.substring("csrftoken=".length)).trim();
      if (val) return val;
    }
  }
  return "";
}

/**
 * Store a CSRF token in memory as fallback.
 */
export function setCSRFToken(token) {
  if (token && typeof token === "string") {
    memoryCSRFToken = token;
  }
}

/**
 * Get the current CSRF token, preferring the live browser cookie so it always
 * matches the Cookie header sent to Django even after login/tab rotation.
 */
export function getCSRFToken() {
  const cookieToken = getCookieCSRFToken();
  if (cookieToken) return cookieToken;
  return memoryCSRFToken || "";
}

/**
 * Fetch a CSRF token from the backend and store it.
 */
export async function fetchCSRFToken() {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/csrf/`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.csrfToken) {
        memoryCSRFToken = data.csrfToken;
      }
      return getCookieCSRFToken() || data?.csrfToken || null;
    }
  } catch (err) {
    console.warn("Failed to fetch CSRF token:", err);
  }
  return null;
}

/**
 * Clear client-side session storage and user-scoped reservation/cart drafts on account switch or logout.
 */
export function clearClientAuthState({ clearCookies = false } = {}) {
  try {
    if (clearCookies) {
      memoryCSRFToken = "";
    }

    // 1. Clear all in-browser session storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }

    // 2. Optionally clear client-accessible cookies on explicit logout
    if (clearCookies && typeof document !== "undefined") {
      document.cookie = "csrftoken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;";
    }

    // 3. Remove reservation drafts, user reservation caches, and guest carts from localStorage
    if (typeof localStorage !== "undefined") {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("reservations_") ||
            key.startsWith("bookingDraft_") ||
            key.startsWith("catroom_") ||
            key.startsWith("booking_") ||
            key === "catopia_cart" ||
            key === "cart_guest")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (err) {
    console.warn("Error clearing client auth state:", err);
  }
}

/**
 * API client wrapping fetch with credentials, no-store cache, and CSRF handling.
 */
export async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const rawBody = options.body;
  const headers = {
    ...(options.headers || {}),
  };

  let serializedBody = rawBody;
  // Add Content-Type for JSON bodies
  if (rawBody && typeof rawBody === "object" && !(rawBody instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    serializedBody = JSON.stringify(rawBody);
  }

  // Add CSRF token for mutating requests
  const method = (options.method || "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isMutating) {
    let token = getCSRFToken();
    if (!token) {
      token = await fetchCSRFToken();
    }
    if (token) {
      headers["X-CSRFToken"] = token;
    }
  }

  const executeRequest = async (reqHeaders) => {
    const controller = new AbortController();
    const timeoutMs = options.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    let response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        ...options,
        body: serializedBody,
        headers: reqHeaders,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        const timeoutError = new Error("Request timed out. Please check your connection and try again.");
        timeoutError.status = 408;
        throw timeoutError;
      }
      throw err;
    }
    clearTimeout(timeoutId);
    return response;
  };

  let res = await executeRequest(headers);

  // If a mutating request fails with 403 due to a rotated/stale CSRF token, refresh token and retry once
  if (isMutating && res.status === 403 && !options._csrfRetried) {
    let errData = null;
    try {
      errData = await res.clone().json();
    } catch {
      errData = null;
    }
    const detailStr = String(errData?.detail || "");
    if (detailStr.toLowerCase().includes("csrf")) {
      const freshToken = await fetchCSRFToken();
      if (freshToken) {
        const retryHeaders = {
          ...headers,
          "X-CSRFToken": getCSRFToken() || freshToken,
        };
        res = await executeRequest(retryHeaders);
      }
    }
  }

  if (!res.ok) {
    const error = new Error(`API error: ${res.status}`);
    error.status = res.status;
    try {
      error.data = await res.json();
    } catch {
      error.data = null;
    }

    // Notify AuthContext if a protected endpoint indicates the session is unauthenticated
    const isAuthProbe =
      path.startsWith("/api/auth/me/") ||
      path.startsWith("/api/auth/login/") ||
      path.startsWith("/api/auth/register/") ||
      path.startsWith("/api/auth/logout/") ||
      path.startsWith("/api/auth/csrf/");

    if (
      !isAuthProbe &&
      (res.status === 401 ||
        (res.status === 403 &&
          String(error.data?.detail || "").includes("Authentication credentials were not provided")))
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("catopia:unauthenticated"));
      }
    }

    throw error;
  }

  // Handle 204 No Content
  if (res.status === 204) return null;

  const data = await res.json();
  if (data && typeof data === "object" && data.csrfToken) {
    setCSRFToken(data.csrfToken);
  }
  return data;
}

// Convenience methods
api.get = (path) => api(path);
api.post = (path, body) => api(path, { method: "POST", body });
api.put = (path, body) => api(path, { method: "PUT", body });
api.patch = (path, body) => api(path, { method: "PATCH", body });
api.delete = (path, options) => api(path, { ...options, method: "DELETE" });
api.del = api.delete;
