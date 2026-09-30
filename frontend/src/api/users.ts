import { apiClient } from "./client";
import type { User, UserRole } from "../types";

export async function listUsers() {
  const { data } = await apiClient.get<User[]>("/users");
  return data;
}

export async function updateUserRole(userId: number, role: UserRole) {
  const { data } = await apiClient.patch<User>(`/users/${userId}/role`, { role });
  return data;
}
