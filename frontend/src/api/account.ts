import { apiClient } from "./client";
import type { Address, AddressFields, SellerSettings } from "../types";

export async function getSellerSettings() {
  const { data } = await apiClient.get<SellerSettings>("/account/seller-settings");
  return data;
}

/** `buyers_notified`: buyers emailed the changed payment details (orders awaiting payment). */
export async function updateSellerSettings(settings: SellerSettings) {
  const { data } = await apiClient.put<SellerSettings & { buyers_notified: number }>(
    "/account/seller-settings",
    settings
  );
  return data;
}

export async function listAddresses() {
  const { data } = await apiClient.get<Address[]>("/account/addresses");
  return data;
}

export async function createAddress(address: AddressFields & { is_default?: boolean }) {
  const { data } = await apiClient.post<Address>("/account/addresses", address);
  return data;
}

export async function updateAddress(id: number, address: AddressFields & { is_default?: boolean }) {
  const { data } = await apiClient.put<Address>(`/account/addresses/${id}`, address);
  return data;
}

export async function deleteAddress(id: number) {
  await apiClient.delete(`/account/addresses/${id}`);
}
