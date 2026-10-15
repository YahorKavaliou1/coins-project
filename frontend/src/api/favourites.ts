import { apiClient } from "./client";
import type { CoinPage } from "../types";

export async function listFavourites({ page = 1, pageSize = 20, forSaleOnly = false } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (forSaleOnly) params.set("for_sale_only", "true");
  const { data } = await apiClient.get<CoinPage>(`/favourites?${params.toString()}`);
  return data;
}

export async function addFavourite(coinId: number) {
  await apiClient.post("/favourites", { coin_id: coinId });
}

export async function removeFavourite(coinId: number) {
  await apiClient.delete(`/favourites/${coinId}`);
}
