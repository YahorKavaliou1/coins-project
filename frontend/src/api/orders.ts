import { apiClient } from "./client";
import type { Order } from "../types";

export async function checkout(shippingAddress: string) {
  const { data } = await apiClient.post<Order>("/orders/checkout", {
    shipping_address: shippingAddress,
  });
  return data;
}

export async function listMyOrders() {
  const { data } = await apiClient.get<Order[]>("/orders/me");
  return data;
}
