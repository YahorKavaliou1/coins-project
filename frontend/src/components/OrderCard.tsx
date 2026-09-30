import type { Order } from "../types";

export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
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
  );
}
