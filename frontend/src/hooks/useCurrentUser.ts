import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCurrentUser } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ["currentUser", accessToken],
    queryFn: getCurrentUser,
    enabled: !!accessToken,
    retry: false,
  });

  // No logout on error here: an invalid session is ended by the API client (api/client.ts),
  // while a network error or a server waking up must not log the user out.
  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
