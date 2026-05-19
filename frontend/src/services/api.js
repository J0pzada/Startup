import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  if (config.url === "/products" && Number(config.params?.limit) > 500) {
    config.params = { ...config.params, limit: 500 };
  }
  return config;
});
