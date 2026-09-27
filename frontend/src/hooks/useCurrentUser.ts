import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCurrentUser } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const query = useQuery({
    queryKey: ["currentUser", accessToken],
    queryFn: getCurrentUser,
    enabled: !!accessToken,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
    if (query.isError) logout();
  }, [query.data, query.isError, setUser, logout]);

  return query;
}
