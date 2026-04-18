/// <reference types="vite/client" />

export const API_ORIGIN = import.meta.env.DEV ? "" : "http://127.0.0.1:3001";
export const API_BASE = `${API_ORIGIN}/api`;
export const HEALTH_URL = `${API_ORIGIN}/health`;
