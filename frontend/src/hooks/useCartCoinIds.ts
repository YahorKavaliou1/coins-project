import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/cart";
import { useAuthStore } from "../store/authStore";

/** Ids of the coins in the cart (a user's or a guest's). Shares the header's query. */
export function useCartCoinIds(): Set<number> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data } = useQuery({ queryKey: ["cart", accessToken], queryFn: getCart });
  return new Set(data?.items.map((item) => item.coin.id) ?? []);
}
