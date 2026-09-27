import { apiClient } from "./client";
import type { User } from "../types";

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function register(email: string, password: string, fullName?: string) {
  const { data } = await apiClient.post<User>("/auth/register", {
    email,
    password,
    full_name: fullName || null,
  });
  return data;
}

export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const { data } = await apiClient.post<Token>("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}

export async function getCurrentUser() {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
}
