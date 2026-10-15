import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";

/** Error thrown by apiClient; FastAPI puts the message into `detail`. */
export type ApiError = AxiosError<{ detail?: string | { msg: string }[] }>;

/** Human-readable message from an API error (plain `detail` or a 422 validation list). */
export function getErrorMessage(err: ApiError): string {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  // Pydantic prefixes custom validator messages with "Value error, ".
  if (Array.isArray(detail)) return detail.map((d) => d.msg.replace(/^Value error, /, "")).join("; ");
  // No API answer at all: e.g. offline, or the server restarting (its proxy answers instead).
  if (!err.response) return "Network error: the server could not be reached";
  if (err.response.status >= 500) return `Server error (${err.response.status}), please try again`;
  return "Unknown error";
}

/** Must match BLOCKED_USER_DETAIL in app/api/deps.py. */
export const BLOCKED_USER_DETAIL = "Your account is blocked. Please contact the administrator.";

/** Must match INVALID_LINK_DETAIL in app/api/auth.py. */
export const INVALID_LINK_DETAIL = "This link is invalid or has expired.";

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
  // Empty in development: the Vite dev server proxies API paths to the backend (vite.config.ts).
  // In production the API has its own domain, set at build time (see .env.example).
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shared by all requests that fail at once, so the refresh token is used only once.
let refreshing: Promise<string | null> | null = null;

/** Exchanges the refresh token for new tokens; null if the session can't be renewed. */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
      // Plain axios: this request must not go through the interceptors below.
      const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken }
      );
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch (err) {
      // Only a rejected token ends the session; a network error leaves it for the next try.
      const status = (err as AxiosError).response?.status;
      return status === 401 || status === 403 ? null : useAuthStore.getState().accessToken;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { accessToken, logout } = useAuthStore.getState();
    const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && accessToken && request && !request._retried) {
      // The access token expired (it lives 30 minutes): renew it and repeat the request once.
      const newToken = await refreshAccessToken();
      if (newToken && newToken !== accessToken) {
        request._retried = true;
        request.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(request);
      }
      if (newToken === null) logout();
    } else if (error.response?.status === 401 && accessToken) {
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
