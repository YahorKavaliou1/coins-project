import type { OrderStatus } from "../types";
import { ORDER_STATUS_LABELS } from "../utils/orderStatus";

const STYLES: Record<OrderStatus, string> = {
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-green-100 text-green-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5 ${STYLES[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
