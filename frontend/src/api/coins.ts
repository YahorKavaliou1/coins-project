import { apiClient } from "./client";
import type { Coin, CoinCreatePayload, CoinFacets, CoinPage, CoinUpdatePayload } from "../types";

export type CoinSort =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "weight_asc"
  | "weight_desc"
  | "date_asc"
  | "date_desc";

export interface CoinFilters {
  country_id?: number;
  metal_id?: number[];
  grade?: string;
  year_from?: number;
  year_to?: number;
  q?: string;
  for_sale_only?: boolean;
  owner_id?: number;
  sort?: CoinSort;
  page?: number;
  page_size?: number;
}

function buildParams(filters: CoinFilters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.set(key, String(value));
    }
  });
  return params;
}

export async function listCoins(filters: CoinFilters = {}) {
  const { data } = await apiClient.get<CoinPage>(`/coins?${buildParams(filters).toString()}`);
  return data;
}

export async function getCoinFacets(filters: CoinFilters = {}) {
  const { data } = await apiClient.get<CoinFacets>(`/coins/facets?${buildParams(filters).toString()}`);
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
