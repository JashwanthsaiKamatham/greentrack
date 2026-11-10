// All requests go to OUR backend. No third-party keys ever live in the frontend.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'gt_token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}
let onUnauthorized = null;

export const getToken = () => token;
export function setToken(t) {
  token = t || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) - session lasts until the tab closes */
  }
}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const sentToken = token;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // An expired/invalid session on a protected route signs the user out cleanly.
    if (res.status === 401 && sentToken && sentToken === token && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) {
      onUnauthorized?.();
    }
    const fallback = res.status >= 500 ? 'The server is waking up or had a problem. Please try again in a moment.' : `Request failed (${res.status}).`;
    throw new ApiError(data?.error || fallback, res.status);
  }
  return data;
}
