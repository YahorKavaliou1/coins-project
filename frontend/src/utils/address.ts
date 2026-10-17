import type { AddressFields } from "../types";

export const EMPTY_ADDRESS: AddressFields = {
  recipient_name: "",
  phone: "",
  country: "",
  city: "",
  postal_code: "",
  address_line: "",
};

/** Empty optional fields as null, like the API stores them. */
export function cleanAddress(address: AddressFields): AddressFields {
  return { ...address, phone: address.phone?.trim() || null };
}

/** One line for lists and pickers. */
export function addressSummary(address: AddressFields): string {
  return [address.recipient_name, address.address_line, `${address.postal_code} ${address.city}`, address.country]
    .filter(Boolean)
    .join(", ");
}
