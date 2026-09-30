import { apiClient } from "./client";
import type { Order, User, UserRole } from "../types";

export async function listUsers() {
  const { data } = await apiClient.get<User[]>("/users");
  return data;
}

export async function updateUserRole(userId: number, role: UserRole) {
  const { data } = await apiClient.patch<User>(`/users/${userId}/role`, { role });
  return data;
}

export async function getUser(userId: number) {
  const { data } = await apiClient.get<User>(`/users/${userId}`);
  return data;
}

export async function listUserOrders(userId: number) {
  const { data } = await apiClient.get<Order[]>(`/users/${userId}/orders`);
  return data;
}

export async function blockUser(userId: number) {
  const { data } = await apiClient.post<User>(`/users/${userId}/block`);
  return data;
}

export async function unblockUser(userId: number) {
  const { data } = await apiClient.post<User>(`/users/${userId}/unblock`);
  return data;
}

export async function verifyUserManually(userId: number) {
  const { data } = await apiClient.post<User>(`/users/${userId}/verify`);
  return data;
}

export async function resendUserVerification(userId: number) {
  const { data } = await apiClient.post<{ message: string }>(`/users/${userId}/resend-verification`);
  return data;
}
