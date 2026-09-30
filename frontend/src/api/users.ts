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
