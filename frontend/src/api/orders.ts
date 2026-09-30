import { apiClient } from "./client";
import type { Order } from "../types";

/**
 * `expectedTotal` is the cart total shown to the buyer: the server refuses the order (409)
 * if prices changed in the meantime.
 */
export async function checkout(shippingAddress: string, expectedTotal: number) {
  const { data } = await apiClient.post<Order>("/orders/checkout", {
    shipping_address: shippingAddress,
    expected_total: expectedTotal,
  });
  return data;
}

export async function listMyOrders() {
  const { data } = await apiClient.get<Order[]>("/orders/me");
  return data;
}
