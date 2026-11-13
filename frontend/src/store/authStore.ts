import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  accessToken: string | null;
  /** Long-lived; exchanged for a new access token when that expires (api/client.ts). */
  refreshToken: string | null;
  currentUser: User | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  /** Reads the saved session; called once, right after the page is hydrated (root.tsx). */
  restoreSession: () => void;
}

// Tokens live in localStorage, which the server can't read: pages are rendered on the server
// (and hydrated) as for a visitor, then the saved session is restored. Reading it earlier would
// make the first client render differ from the server's HTML.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  currentUser: null,
  restoreSession: () =>
    set({
      accessToken: localStorage.getItem("access_token"),
      refreshToken: localStorage.getItem("refresh_token"),
    }),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, refreshToken });
  },
  setUser: (user: User | null) => set({ currentUser: user }),
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, refreshToken: null, currentUser: null });
  },
}));
