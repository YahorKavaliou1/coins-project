import type { Order } from "../types";
import { formatUtcDateTime } from "../utils/dates";
import { OrderItems } from "./OrderItems";
import { OrderStatusBadge } from "./OrderStatusBadge";

/** A compact order view (admin pages). */
export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <h3 className="font-semibold">Order #{order.id}</h3>
        <OrderStatusBadge status={order.status} />
        <span className="text-xs text-gray-400 ml-auto">{formatUtcDateTime(order.created_at)}</span>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Seller: {order.seller_name || `#${order.seller_id}`}
        {order.tracking_code && <> · Tracking: <span className="font-mono">{order.tracking_code}</span></>}
      </div>
      <OrderItems order={order} />
      <div className="text-xs text-gray-500 mt-2 whitespace-pre-line">Shipping to: {order.shipping_address}</div>
    </div>
  );
}
