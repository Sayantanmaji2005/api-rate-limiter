import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const API = axios.create({
  // In local dev, empty baseURL keeps requests relative so Vite proxy handles routing.
  baseURL: configuredBaseUrl || undefined,
  timeout: 10000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
