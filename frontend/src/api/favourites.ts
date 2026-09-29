import { apiClient } from "./client";
import type { CoinPage } from "../types";

export async function listFavourites(page = 1, pageSize = 20) {
  const { data } = await apiClient.get<CoinPage>(`/favourites?page=${page}&page_size=${pageSize}`);
  return data;
}

export async function addFavourite(coinId: number) {
  await apiClient.post("/favourites", { coin_id: coinId });
}

export async function removeFavourite(coinId: number) {
  await apiClient.delete(`/favourites/${coinId}`);
}
