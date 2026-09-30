import type { BlockReason, User, UserRole } from "../types";

export const USER_ROLES: UserRole[] = ["user", "seller", "admin"];

export function canSell(user: User | null): boolean {
  return user?.role === "seller" || user?.role === "admin";
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}

const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  admin: "by admin",
  too_many_failed_logins: "too many failed logins",
};

export function blockReasonLabel(reason: BlockReason | null): string {
  return reason ? BLOCK_REASON_LABELS[reason] : "";
}
