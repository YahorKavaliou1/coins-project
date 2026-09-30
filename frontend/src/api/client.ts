import axios, { type AxiosError } from "axios";
import { useAuthStore } from "../store/authStore";

/** Error thrown by apiClient; FastAPI puts the message into `detail`. */
export type ApiError = AxiosError<{ detail?: string | { msg: string }[] }>;

/** Human-readable message from an API error (plain `detail` or a 422 validation list). */
export function getErrorMessage(err: ApiError): string {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  return "Unknown error";
}

export const apiClient = axios.create({
  baseURL: "",
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
