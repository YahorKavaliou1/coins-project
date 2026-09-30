import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import type { UserRole } from "../types";

interface RequireRoleProps {
  roles: UserRole[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!accessToken) return <p>Please log in to view this page.</p>;
  if (!currentUser) return <p>Loading...</p>;
  if (!roles.includes(currentUser.role)) {
    return <p>You don't have permission to view this page.</p>;
  }

  return <>{children}</>;
}
