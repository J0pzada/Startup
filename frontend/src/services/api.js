import axios from "axios";

const envApiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = envApiBase || (import.meta.env.DEV ? "http://localhost:8000" : "");

console.debug("[MapaSeller API] baseURL =", API_BASE || "(relative/prod env missing)");

export const api = axios.create({
  baseURL: API_BASE,
});

export function getApiBaseURL() {
  return API_BASE || window.location.origin;
}

export function formatApiError(error, fallbackMessage) {
  const baseURL = error?.config?.baseURL || API_BASE || window.location.origin;
  const endpoint = error?.config?.url || "";
  const detail = error?.response?.data?.detail;
  const message = detail || fallbackMessage || error?.message || "Falha na chamada de API.";
  return `${message} Base API chamada: ${baseURL}${endpoint}`;
}

api.interceptors.request.use((config) => {
  if (config.url === "/products" && Number(config.params?.limit) > 500) {
    config.params = { ...config.params, limit: 500 };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const baseURL = error?.config?.baseURL || API_BASE || window.location.origin;
    error.message = `${error.message || "Erro de API"} (baseURL: ${baseURL})`;
    error.mapasellerBaseURL = baseURL;
    return Promise.reject(error);
  },
);
