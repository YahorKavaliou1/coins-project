import { apiClient } from "./client";
import type { User } from "../types";

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MessageResponse {
  message: string;
}

export async function register(email: string, password: string, fullName?: string) {
  const { data } = await apiClient.post<MessageResponse>("/auth/register", {
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

export async function verifyEmail(token: string) {
  const { data } = await apiClient.post<Token>("/auth/verify-email", { token });
  return data;
}

export async function resendVerification(email: string) {
  const { data } = await apiClient.post<MessageResponse>("/auth/resend-verification", { email });
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<MessageResponse>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, password: string) {
  const { data } = await apiClient.post<MessageResponse>("/auth/reset-password", { token, password });
  return data;
}
