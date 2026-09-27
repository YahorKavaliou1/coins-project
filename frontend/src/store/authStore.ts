import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  accessToken: string | null;
  currentUser: User | null;
  setToken: (token: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("access_token"),
  currentUser: null,
  setToken: (token: string) => {
    localStorage.setItem("access_token", token);
    set({ accessToken: token });
  },
  setUser: (user: User | null) => set({ currentUser: user }),
  logout: () => {
    localStorage.removeItem("access_token");
    set({ accessToken: null, currentUser: null });
  },
}));
