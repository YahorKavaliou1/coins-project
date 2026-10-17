import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/cart";
import { useAuthStore } from "../store/authStore";

/** Ids of the coins in the current user's cart (empty for guests). Shares the header's query. */
export function useCartCoinIds(): Set<number> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data } = useQuery({ queryKey: ["cart", accessToken], queryFn: getCart, enabled: !!accessToken });
  return new Set(data?.items.map((item) => item.coin.id) ?? []);
}
