import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listAllOrders } from "../api/orders";
import { OrderItems } from "../components/OrderItems";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { ORDER_STATUS_LABELS } from "../utils/orderStatus";
import { Pagination } from "../components/Pagination";
import type { OrderStatus } from "../types";
import { formatUtcDateTime } from "../utils/dates";
import { formatPrice } from "../utils/money";

const PAGE_SIZE = 50;
const FILTERS: (OrderStatus | "all")[] = ["all", "awaiting_payment", "paid", "shipped"];

/** Every order on the site, for admins: who bought from whom, and where each one stands. */
export function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("status");
  const filter = FILTERS.find((f) => f === param) ?? "all";
  const [page, setPage] = useState({ filter, number: 1 });
  const pageNumber = page.filter === filter ? page.number : 1;
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-orders", filter, pageNumber],
    queryFn: () => listAllOrders(filter === "all" ? undefined : filter, pageNumber, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Orders</h1>
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
          </button>
        ))}
        {data && <span className="ml-auto pb-2.5 text-sm text-gray-400 whitespace-nowrap">{data.total} orders</span>}
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 w-6"></th>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Buyer</th>
              <th className="text-left px-3 py-2">Seller</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  No orders.
                </td>
              </tr>
            )}
            {data?.items.map((order) => (
              <Fragment key={order.id}>
                <tr
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 text-gray-400">
                    {expanded === order.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold">#{order.id}</div>
                    <div className="text-xs text-gray-400">{formatUtcDateTime(order.created_at)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/users/${order.buyer_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent">
                      {order.buyer_email}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/users/${order.seller_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent">
                      {order.seller_email}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatPrice(order.total_price)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{order.tracking_code ?? "—"}</td>
                </tr>
                {expanded === order.id && (
                  <tr className="bg-gray-50">
                    <td></td>
                    <td colSpan={6} className="px-3 py-3">
                      <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
                        <div className="col-span-2 max-md:col-span-1">
                          <OrderItems order={order} />
                        </div>
                        <div className="text-sm">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Ship to</div>
                          <div className="whitespace-pre-line text-gray-700">{order.shipping_address}</div>
                          {order.paid_at && <div className="text-xs text-gray-500 mt-2">Paid: {formatUtcDateTime(order.paid_at)}</div>}
                          {order.shipped_at && <div className="text-xs text-gray-500">Shipped: {formatUtcDateTime(order.shipped_at)}</div>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={pageNumber}
        pageCount={data ? Math.ceil(data.total / PAGE_SIZE) : 0}
        onChange={(number) => setPage({ filter, number })}
      />
    </div>
  );
}
