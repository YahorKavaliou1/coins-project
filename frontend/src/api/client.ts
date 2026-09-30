import axios, { type AxiosError } from "axios";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";

/** Error thrown by apiClient; FastAPI puts the message into `detail`. */
export type ApiError = AxiosError<{ detail?: string | { msg: string }[] }>;

/** Human-readable message from an API error (plain `detail` or a 422 validation list). */
export function getErrorMessage(err: ApiError): string {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  return "Unknown error";
}

/** Must match BLOCKED_USER_DETAIL in app/api/deps.py. */
export const BLOCKED_USER_DETAIL = "Your account is blocked. Please contact the administrator.";

/** Must match EMAIL_NOT_VERIFIED_DETAIL in app/api/deps.py. */
export const EMAIL_NOT_VERIFIED_DETAIL =
  "Please confirm your email address. We've sent a confirmation link to your inbox.";

export function isBlockedError(err: ApiError): boolean {
  return err.response?.status === 403 && err.response.data?.detail === BLOCKED_USER_DETAIL;
}

export function isEmailNotVerifiedError(err: ApiError): boolean {
  return err.response?.status === 403 && err.response.data?.detail === EMAIL_NOT_VERIFIED_DETAIL;
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
    const { accessToken, logout } = useAuthStore.getState();
    if (error.response?.status === 401) {
      logout();
    } else if (isBlockedError(error) && accessToken) {
      // The account was blocked while logged in: end the session once.
      logout();
      toast.error(BLOCKED_USER_DETAIL);
    } else if (isEmailNotVerifiedError(error) && accessToken) {
      // A session from before email confirmation became mandatory.
      logout();
      toast.error("Please log in again and confirm your email address.");
    }
    return Promise.reject(error);
  }
);
