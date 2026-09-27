import { apiClient } from "./client";
import type { Coin, CoinCreatePayload, CoinPage, CoinUpdatePayload } from "../types";

export interface CoinFilters {
  country_id?: number;
  metal_id?: number;
  year_from?: number;
  year_to?: number;
  q?: string;
  for_sale_only?: boolean;
  owner_id?: number;
  page?: number;
  page_size?: number;
}

export async function listCoins(filters: CoinFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const { data } = await apiClient.get<CoinPage>(`/coins?${params.toString()}`);
  return data;
}

export async function getCoin(id: number) {
  const { data } = await apiClient.get<Coin>(`/coins/${id}`);
  return data;
}

export async function createCoin(payload: CoinCreatePayload) {
  const { data } = await apiClient.post<Coin>("/coins", payload);
  return data;
}

export async function updateCoin(id: number, payload: CoinUpdatePayload) {
  const { data } = await apiClient.patch<Coin>(`/coins/${id}`, payload);
  return data;
}

export async function deleteCoin(id: number) {
  await apiClient.delete(`/coins/${id}`);
}

export async function uploadCoinImage(coinId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/coins/${coinId}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteCoinImage(coinId: number, imageId: number) {
  await apiClient.delete(`/coins/${coinId}/images/${imageId}`);
}
