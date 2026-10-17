import type { AddressFields } from "../types";
import { inputClass, labelClass } from "./formStyles";

interface AddressFormProps {
  value: AddressFields;
  onChange: (value: AddressFields) => void;
}

/** Delivery address fields; limits match app/schemas/account.py. */
export function AddressForm({ value, onChange }: AddressFormProps) {
  const field = (key: keyof AddressFields, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className={props.className}>
      <label className={labelClass}>{label}</label>
      <input
        {...props}
        className={inputClass}
        value={value[key] ?? ""}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      {field("recipient_name", "Recipient name", { required: true, maxLength: 100, autoComplete: "name", className: "col-span-2 max-sm:col-span-1" })}
      {field("address_line", "Street, house, apartment", { required: true, maxLength: 255, autoComplete: "street-address", className: "col-span-2 max-sm:col-span-1" })}
      {field("postal_code", "Postal code", { required: true, maxLength: 20, autoComplete: "postal-code" })}
      {field("city", "City", { required: true, maxLength: 100, autoComplete: "address-level2" })}
      {field("country", "Country", { required: true, maxLength: 100, autoComplete: "country-name" })}
      {field("phone", "Phone (for the courier)", { type: "tel", maxLength: 40, autoComplete: "tel", pattern: "[0-9+()\\-. ]*" })}
    </div>
  );
}
