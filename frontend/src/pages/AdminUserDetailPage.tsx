import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { getUser, listUserOrders } from "../api/users";
import { OrderCard } from "../components/OrderCard";
import { formatUtcDateTime } from "../utils/dates";

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const navigate = useNavigate();

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
  ];

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

      <h1 className="text-xl font-bold mb-4">User #{user.id}</h1>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <div className="text-accent text-xs font-semibold uppercase">{label}</div>
            <div className="text-sm text-gray-900 mt-0.5 break-all">{value}</div>
          </div>
        ))}
      </div>

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
