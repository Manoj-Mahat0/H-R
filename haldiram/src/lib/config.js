// src/lib/config.js

// API host (backend server URL)
// You can override this in .env file using: VITE_API_HOST
// export const API_HOST = "http://127.0.0.1:8000";
export const API_HOST = "http://127.0.0.1:8000";

// Base path for your API
export const API_BASE = "/api";

// Full API root
export const API_URL = `${API_HOST}${API_BASE}`;
