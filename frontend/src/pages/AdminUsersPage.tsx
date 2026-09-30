import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, updateUserRole } from "../api/users";
import { useAuthStore } from "../store/authStore";
import { USER_ROLES } from "../utils/roles";
import type { UserRole } from "../types";
import type { ApiError } from "../api/client";

const roleBadgeClass: Record<UserRole, string> = {
  user: "bg-gray-100 text-gray-700",
  seller: "bg-blue-100 text-blue-800",
  admin: "bg-amber-100 text-amber-800",
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);

  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: ApiError) => alert(`Error: ${err.response?.data?.detail || "unknown error"}`),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Users</h1>
      <p className="text-sm text-gray-500 mb-6">Manage user roles.</p>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Registered</th>
              <th className="text-left px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <tr key={user.id} className="border-t border-gray-200">
                  <td className="px-4 py-3 text-gray-500">{user.id}</td>
                  <td className="px-4 py-3">
                    {user.email}
                    {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">{user.full_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold uppercase ${roleBadgeClass[user.role]}`}
                      >
                        {user.role}
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={roleMutation.isPending}
                        onChange={(e) =>
                          roleMutation.mutate({ userId: user.id, role: e.target.value as UserRole })
                        }
                        className="border border-gray-300 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent"
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
