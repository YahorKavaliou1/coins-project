import { apiClient } from "./client";
import type { Country, Metal } from "../types";

export async function listCountries() {
  const { data } = await apiClient.get<Country[]>("/countries");
  return data;
}

export async function listMetals() {
  const { data } = await apiClient.get<Metal[]>("/metals");
  return data;
}
