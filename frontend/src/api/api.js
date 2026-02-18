import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const requestTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 30000);

const API = axios.create({
  // In local dev, empty baseURL keeps requests relative so Vite proxy handles routing.
  baseURL: configuredBaseUrl || undefined,
  timeout: requestTimeoutMs,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    if (!config) {
      throw error;
    }

    const isTransient = error.code === "ECONNABORTED" || error.code === "ERR_NETWORK";
    if (isTransient && !config.__retried) {
      config.__retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return API(config);
    }

    throw error;
  }
);

export default API;
