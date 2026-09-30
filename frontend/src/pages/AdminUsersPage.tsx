import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listUsers, updateUserRole } from "../api/users";
import { useAuthStore } from "../store/authStore";
import { USER_ROLES } from "../utils/roles";
import { formatUtcDateTime } from "../utils/dates";
import type { UserRole } from "../types";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { BlockToggleButton, UserStatusBadge } from "../components/UserBlockControls";

const roleBadgeClass: Record<UserRole, string> = {
  user: "bg-gray-100 text-gray-700",
  seller: "bg-blue-100 text-blue-800",
  admin: "bg-amber-100 text-amber-800",
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Users</h1>
      <p className="text-sm text-gray-500 mb-6">Manage roles and access. Click a user to see their purchases.</p>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Registered (UTC)</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  className={`border-t border-gray-200 cursor-pointer hover:bg-gray-50 ${
                    user.is_blocked ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-gray-500">{user.id}</td>
                  <td className="px-4 py-3">
                    {user.email}
                    {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">{user.full_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatUtcDateTime(user.created_at)}
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
                        onClick={(e) => e.stopPropagation()}
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
                  <td className="px-4 py-3">
                    <UserStatusBadge user={user} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && <BlockToggleButton user={user} />}
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
