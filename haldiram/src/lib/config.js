// src/lib/config.js

// Use production API endpoint directly
export const API_HOST = "https://be.haldiram.knocknockindia.com";

console.log('API Configuration:', { API_HOST });

// Base path for your API
export const API_BASE = "/api";

// Full API root
export const API_URL = `${API_HOST}${API_BASE}`;

console.log('Full API URL:', API_URL);