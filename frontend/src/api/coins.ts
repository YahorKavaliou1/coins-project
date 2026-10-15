import { apiClient } from "./client";
import type {
  Coin,
  CoinCreatePayload,
  CoinFacets,
  CoinPage,
  CoinStatus,
  CoinUpdatePayload,
  MyLotsPage,
} from "../types";
import { fitImage } from "../utils/fitImage";

export type CoinSort =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "date_asc"
  | "date_desc";

export interface CoinFilters {
  country_id?: number[];
  metal_id?: number[];
  grade?: string;
  category?: string;
  /** Coins with at least one of these labels. */
  label?: string[];
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

/** The current seller's own lots in one state, with sale details for sold ones. */
export async function listMyLots(status: CoinStatus, page = 1, pageSize = 20) {
  const params = new URLSearchParams({ status, page: String(page), page_size: String(pageSize) });
  const { data } = await apiClient.get<MyLotsPage>(`/coins/mine?${params.toString()}`);
  return data;
}

/** Takes lots off sale; returns the ids actually changed (others were sold meanwhile, etc.). */
export async function withdrawCoins(coinIds: number[]) {
  const { data } = await apiClient.post<{ coin_ids: number[] }>("/coins/withdraw", { coin_ids: coinIds });
  return data.coin_ids;
}

/** Puts withdrawn lots back on sale; returns the ids actually changed. */
export async function relistCoins(coinIds: number[]) {
  const { data } = await apiClient.post<{ coin_ids: number[] }>("/coins/relist", { coin_ids: coinIds });
  return data.coin_ids;
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
  formData.append("file", await fitImage(file));
  const { data } = await apiClient.post(`/coins/${coinId}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteCoinImage(coinId: number, imageId: number) {
  await apiClient.delete(`/coins/${coinId}/images/${imageId}`);
}
