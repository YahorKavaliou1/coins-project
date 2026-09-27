import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "../api/orders";
import { useAuthStore } from "../store/authStore";

export function PurchasesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: listMyOrders,
    enabled: !!accessToken,
  });

  if (!accessToken) return <p>Please log in to view your purchases.</p>;
  if (orders && orders.length === 0) return <p>No purchases yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {orders?.map((order) => (
        <div key={order.id} className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold">Order #{order.id}</h3>
          <div className="text-xs text-gray-500 mb-1">
            {new Date(order.created_at).toLocaleString()} · {order.status} · Total: ${order.total_price.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mb-2">Shipping to: {order.shipping_address}</div>
          {order.items.map((item) => (
            <div key={item.id} className="text-sm border-t pt-1 mt-1">
              {item.coin_name_snapshot} — ${item.price_paid.toFixed(2)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
