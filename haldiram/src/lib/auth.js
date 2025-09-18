// src/lib/auth.js
const API_BASE = "https://be.haldiram.globalinfosoft.co/api";

export function getToken() {
  return localStorage.getItem("access_token");
}
export function setToken(token) {
  if (token) localStorage.setItem("access_token", token);
  else localStorage.removeItem("access_token");
}
export function clearAuth() {
  localStorage.removeItem("access_token");
}

// wrapper for fetch that sets Authorization header if token available
export async function authFetch(path, opts = {}) {
  const token = getToken();
  const headers = opts.headers ? { ...opts.headers } : {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["Content-Type"] = headers["Content-Type"] || "application/json";

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.detail || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// login: returns { access_token, token_type } on success
export async function loginRequest(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = txt; }
    const err = new Error(data?.detail || `Login failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return await res.json();
}

// get current user using token
export async function meRequest() {
  return await authFetch("/auth/me", { method: "GET" });
}
