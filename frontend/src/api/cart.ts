import { apiClient } from "./client";
import type { Cart } from "../types";

export async function getCart() {
  const { data } = await apiClient.get<Cart>("/cart");
  return data;
}

export async function addToCart(coinId: number) {
  const { data } = await apiClient.post<Cart>("/cart/items", { coin_id: coinId });
  return data;
}

export async function removeFromCart(coinId: number) {
  const { data } = await apiClient.delete<Cart>(`/cart/items/${coinId}`);
  return data;
}
