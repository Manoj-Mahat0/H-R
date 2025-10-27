// src/lib/config.js

// Determine the environment
const isProduction = import.meta.env.PROD;
const env = import.meta.env.VITE_ENV || (isProduction ? 'production' : 'staging');

// API host (backend server URL) - configurable for different environments
const API_HOSTS = {
  production: "https://be.haldiram.globalinfosofts.com",
  staging: "http://127.0.0.1:8000"
};

// Export the appropriate API host based on environment
export const API_HOST = API_HOSTS[env] || API_HOSTS.staging;

// Base path for your API
export const API_BASE = "/api";

// Full API root
export const API_URL = `${API_HOST}${API_BASE}`;