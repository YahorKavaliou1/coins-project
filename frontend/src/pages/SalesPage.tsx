import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Truck } from "lucide-react";
import { listMySales, markOrderShipped } from "../api/orders";
import { getErrorMessage, type ApiError } from "../api/client";
import { inputClass } from "../components/formStyles";
import { OrderItems } from "../components/OrderItems";
import { PaymentDetailsNotice } from "../components/PaymentDetailsNotice";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { ORDER_STATUS_LABELS } from "../utils/orderStatus";
import { toast } from "../store/toastStore";
import type { Order, OrderStatus } from "../types";
import { formatUtcDate, formatUtcDateTime } from "../utils/dates";

const FILTERS: (OrderStatus | "all")[] = ["all", "awaiting_payment", "paid", "shipped"];

export function SalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("status");
  const filter = FILTERS.find((f) => f === param) ?? "all";

  // All orders once; the tabs filter in the browser so their counts are always right.
  const { data: orders } = useQuery({ queryKey: ["sales"], queryFn: () => listMySales() });
  const shown = orders?.filter((o) => filter === "all" || o.status === filter) ?? [];
  const count = (f: OrderStatus | "all") => orders?.filter((o) => f === "all" || o.status === f).length ?? 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-4">My sales</h1>

      <PaymentDetailsNotice />

      <div className="flex flex-wrap gap-x-5 border-b border-gray-200 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setSearchParams(f === "all" ? {} : { status: f })}
            className={`-mb-px pb-2.5 text-sm font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-colors ${
              filter === f ? "text-gray-900 border-accent" : "text-gray-400 border-transparent hover:text-gray-700"
            }`}
          >
            {f === "all" ? "All" : ORDER_STATUS_LABELS[f]}
            {orders && <span className="ml-1.5 text-xs font-semibold text-gray-400">{count(f)}</span>}
          </button>
        ))}
      </div>

      {orders && shown.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-10 text-center text-gray-500">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          No orders here.
        </div>
      )}
      <div className="flex flex-col gap-4">
        {shown.map((order) => (
          <SaleCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}

function SaleCard({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  // Open for shipping, or for correcting the tracking code of a shipped order.
  const [editing, setEditing] = useState(false);
  const [tracking, setTracking] = useState(order.tracking_code ?? "");

  const mutation = useMutation({
    mutationFn: () => markOrderShipped(order.id, tracking.trim() || null),
    onSuccess: () => {
      setEditing(false);
      for (const key of ["sales", "my-lots"]) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(order.status === "shipped" ? "Tracking code updated. The buyer was notified." : "Marked as shipped. The buyer was notified.");
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  return (
    <article className="bg-white border border-gray-200 rounded-md">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-gray-200 max-sm:px-4">
        <h2 className="font-bold">Order #{order.id}</h2>
        <OrderStatusBadge status={order.status} />
        <span className="text-xs text-gray-400 ml-auto">{formatUtcDateTime(order.created_at)}</span>
      </header>

      <div className="px-5 py-4 flex flex-col gap-4 max-sm:px-4">
        <p className="text-sm text-gray-600">
          {order.status === "awaiting_payment" &&
            "The buyer received your payment details. Ship once the money is on your account."}
          {order.status === "paid" &&
            `The buyer marked the order as paid on ${formatUtcDate(order.paid_at!)}. Check your account, then ship.`}
          {order.status === "shipped" && (
            <>
              Shipped on {formatUtcDate(order.shipped_at!)}
              {order.tracking_code ? (
                <>
                  {" "}— tracking code <span className="font-mono font-semibold text-gray-900">{order.tracking_code}</span>
                </>
              ) : (
                ", without a tracking code"
              )}
              .
            </>
          )}
        </p>

        <OrderItems order={order} />

        <div className="text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Ship to</div>
          <div className="text-gray-700 whitespace-pre-line">{order.shipping_address}</div>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="flex gap-2 items-center max-sm:flex-col max-sm:items-stretch"
          >
            <input
              autoFocus
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={100}
              placeholder="Tracking code (optional), e.g. RR123456789LV"
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-sm px-4 py-2.5 disabled:opacity-50"
            >
              {order.status === "shipped" ? "Save" : "Mark as shipped"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2">
              Cancel
            </button>
          </form>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={
                order.status === "shipped"
                  ? "text-xs font-semibold text-accent hover:text-accent-dark"
                  : "flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-sm px-4 py-2.5"
              }
            >
              {order.status !== "shipped" && <Truck className="w-4 h-4" />}
              {order.status === "shipped" ? (order.tracking_code ? "Change tracking code" : "Add tracking code") : "Mark as shipped"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
