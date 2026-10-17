import { apiClient } from "./client";
import type { AddressFields, AdminOrderPage, BuyerOrder, Order, OrderStatus } from "../types";

export interface CheckoutPayload {
  /** A saved address, or a new one. */
  address_id?: number;
  address?: AddressFields;
  save_address?: boolean;
  /** The chosen option of each seller that has shipping options. */
  shipping: { seller_id: number; option_name: string | null }[];
  /**
   * The total shown to the buyer (coins plus shipping): the server refuses the order (409)
   * if a price or a shipping cost changed in the meantime.
   */
  expected_total: number;
}

/** One order per seller. */
export async function checkout(payload: CheckoutPayload) {
  const { data } = await apiClient.post<BuyerOrder[]>("/orders/checkout", payload);
  return data;
}

export async function listMyOrders() {
  const { data } = await apiClient.get<BuyerOrder[]>("/orders/me");
  return data;
}

export async function markOrderPaid(orderId: number) {
  const { data } = await apiClient.post<BuyerOrder>(`/orders/${orderId}/mark-paid`);
  return data;
}

export async function listMySales(status?: OrderStatus) {
  const { data } = await apiClient.get<Order[]>(`/orders/sales${status ? `?status=${status}` : ""}`);
  return data;
}

/** Also corrects the tracking code of an order already shipped. */
export async function markOrderShipped(orderId: number, trackingCode: string | null) {
  const { data } = await apiClient.post<Order>(`/orders/${orderId}/mark-shipped`, {
    tracking_code: trackingCode,
  });
  return data;
}

export async function listAllOrders(status: OrderStatus | undefined, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (status) params.set("status", status);
  const { data } = await apiClient.get<AdminOrderPage>(`/orders?${params.toString()}`);
  return data;
}
