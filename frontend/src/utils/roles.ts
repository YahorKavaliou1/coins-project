import type { User, UserRole } from "../types";

export const USER_ROLES: UserRole[] = ["user", "seller", "admin"];

export function canSell(user: User | null): boolean {
  return user?.role === "seller" || user?.role === "admin";
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}
