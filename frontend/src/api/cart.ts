import { isAxiosError } from "axios";
import { apiClient } from "./client";
import { useAuthStore } from "../store/authStore";
import type { Cart } from "../types";

// A guest's cart lives in the browser as coin ids; the server prices it (/cart/preview) like
// a user's cart, so the rest of the site sees one kind of cart. On login it moves into the
// account's cart (getCart).
const GUEST_CART_KEY = "guest_cart";
/** Must match MAX_CART_ITEMS in app/api/cart.py. */
const MAX_CART_ITEMS = 100;

function loggedIn(): boolean {
  return useAuthStore.getState().accessToken !== null;
}

export function guestCartIds(): number[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function setGuestCartIds(ids: number[]) {
  if (ids.length > 0) localStorage.setItem(GUEST_CART_KEY, JSON.stringify(ids));
  else localStorage.removeItem(GUEST_CART_KEY);
}

/** Empties the guest's cart, e.g. after a guest checkout. */
export function clearGuestCart() {
  setGuestCartIds([]);
}

async function previewGuestCart(ids: number[]): Promise<Cart> {
  if (ids.length === 0) return { items: [], total_price: 0, sellers: [] };
  const { data } = await apiClient.post<Cart>("/cart/preview", { coin_ids: ids });
  return data;
}

// One merge at a time: several cart queries can start together right after login.
let merging: Promise<void> | null = null;

/** Moves the coins a visitor collected before logging in into the account's cart. */
function mergeGuestCart(): Promise<void> {
  merging ??= doMergeGuestCart().finally(() => {
    merging = null;
  });
  return merging;
}

async function doMergeGuestCart() {
  const ids = guestCartIds();
  if (ids.length === 0) return;
  const retry: number[] = [];
  // One by one, so the server's cart size limit holds.
  for (const id of ids) {
    try {
      await apiClient.post("/cart/items", { coin_id: id });
    } catch (err) {
      // Refused (already in the cart, sold, the user's own...): dropped. Not answered
      // (offline, server error, session ended): kept for the next try.
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === undefined || status >= 500 || status === 401) retry.push(id);
    }
  }
  setGuestCartIds(retry);
}

/**
 * A query function for the key ["cart", accessToken]: the guest's or the account's cart as the
 * key says, so one is never cached under the other's key (e.g. while the session is being
 * restored after hydration, or after logout).
 */
export async function getCart({ queryKey }: { queryKey: readonly unknown[] }) {
  if (!queryKey[1]) return previewGuestCart(guestCartIds());
  await mergeGuestCart();
  const { data } = await apiClient.get<Cart>("/cart");
  return data;
}

export async function addToCart(coinId: number) {
  if (!loggedIn()) {
    const ids = guestCartIds();
    if (ids.includes(coinId)) throw new Error("Coin is already in your cart");
    if (ids.length >= MAX_CART_ITEMS) throw new Error(`A cart can hold at most ${MAX_CART_ITEMS} coins`);
    setGuestCartIds([...ids, coinId]);
    return previewGuestCart([...ids, coinId]);
  }
  const { data } = await apiClient.post<Cart>("/cart/items", { coin_id: coinId });
  return data;
}

export async function removeFromCart(coinId: number) {
  if (!loggedIn()) {
    const ids = guestCartIds().filter((id) => id !== coinId);
    setGuestCartIds(ids);
    return previewGuestCart(ids);
  }
  const { data } = await apiClient.delete<Cart>(`/cart/items/${coinId}`);
  return data;
}
