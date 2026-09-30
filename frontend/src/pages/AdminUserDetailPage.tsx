import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { getUser, listAdminActions, listUserOrders } from "../api/users";
import { OrderCard } from "../components/OrderCard";
import { formatUtcDateTime } from "../utils/dates";
import { useAuthStore } from "../store/authStore";
import { BlockToggleButton, UserStatusBadge } from "../components/UserBlockControls";
import { blockReasonLabel, isLocked } from "../utils/roles";
import { EmailStatusBadge, EmailVerificationActions } from "../components/UserEmailControls";
import type { AdminActionType } from "../types";

const ADMIN_ACTION_LABELS: Record<AdminActionType, string> = {
  role_changed: "Changed role",
  blocked: "Blocked",
  unblocked: "Unblocked",
  email_verified: "Confirmed email manually",
  verification_resent: "Resent confirmation email",
};

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  const { data: user, isError: userError } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    enabled: Number.isFinite(userId),
  });

  const { data: orders } = useQuery({
    queryKey: ["userOrders", userId],
    queryFn: () => listUserOrders(userId),
    enabled: Number.isFinite(userId),
  });

  // Under ["user", id], so the block/unblock/email controls refresh it when they refresh the user.
  const { data: adminActions } = useQuery({
    queryKey: ["user", userId, "admin-actions"],
    queryFn: () => listAdminActions(userId),
    enabled: Number.isFinite(userId),
  });

  if (userError) return <p>User not found.</p>;
  if (!user) return <p>Loading...</p>;

  const totalSpent = (orders ?? []).reduce((sum, order) => sum + order.total_price, 0);

  const details: [string, string][] = [
    ["Email", user.email],
    ["Name", user.full_name || "—"],
    ["Role", user.role],
    ["Registered (UTC)", formatUtcDateTime(user.created_at)],
    ["Orders", orders ? String(orders.length) : "…"],
    ["Total spent", orders ? `$${totalSpent.toFixed(2)}` : "…"],
    ["Failed login attempts", String(user.failed_login_attempts)],
  ];
  if (isLocked(user)) details.push(["Locked until (UTC)", formatUtcDateTime(user.locked_until!)]);
  if (user.is_blocked) {
    details.push(["Blocked", blockReasonLabel(user.blocked_reason)]);
    if (user.blocked_at) details.push(["Blocked at (UTC)", formatUtcDateTime(user.blocked_at)]);
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <button onClick={() => navigate("/admin/users")} className="flex items-center gap-1 hover:text-accent">
          <ChevronLeft className="w-3 h-3" />
          Users
        </button>
        <span>/</span>
        <span className="text-gray-700">{user.email}</span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">User #{user.id}</h1>
          <UserStatusBadge user={user} />
          <EmailStatusBadge user={user} />
        </div>
        {user.id !== currentUser?.id && <BlockToggleButton user={user} size="md" />}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <div className="text-accent text-xs font-semibold uppercase">{label}</div>
            <div className="text-sm text-gray-900 mt-0.5 break-all">{value}</div>
          </div>
        ))}
      </div>

      {!user.is_verified && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-900">
            <div className="font-bold">Email not confirmed</div>
            {user.verification_deadline
              ? `The account will be deleted on ${formatUtcDateTime(user.verification_deadline)} if not confirmed.`
              : "Existing account: the user is asked to confirm on the next login."}
          </div>
          <EmailVerificationActions user={user} />
        </div>
      )}

      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Admin actions</h2>
      {!adminActions ? (
        <p className="mb-6">Loading...</p>
      ) : adminActions.length === 0 ? (
        <p className="text-sm text-gray-500 mb-6">No admin actions yet.</p>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100 mb-6">
          {adminActions.map((entry) => (
            <li key={entry.id} className="px-4 py-2 text-sm flex flex-wrap gap-x-3">
              <span className="text-gray-500">{formatUtcDateTime(entry.created_at)}</span>
              <span className="font-semibold">{ADMIN_ACTION_LABELS[entry.action] ?? entry.action}</span>
              {entry.details && <span>{entry.details}</span>}
              <span className="text-gray-500">by {entry.admin_email}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Purchases</h2>
      {!orders ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500">No purchases yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
