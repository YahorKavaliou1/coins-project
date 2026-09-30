import { apiClient } from "./client";
import type { CoinBatchItem, ImportTable } from "../types";

export async function parseImportTable(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ImportTable>("/coins/import/parse", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createCoinsBatch(items: CoinBatchItem[]) {
  const { data } = await apiClient.post<{ ids: number[] }>("/coins/batch", { items });
  return data;
}
