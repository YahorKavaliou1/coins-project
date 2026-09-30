import type { MultiSelectOption } from "../components/MultiSelectDropdown";
import type { Country, Metal } from "../types";

const byLabel = (a: MultiSelectOption, b: MultiSelectOption) => a.label.localeCompare(b.label);

/** Country options for MultiSelectDropdown, grouped by region. */
export function toCountryOptions(countries: Country[] | undefined): MultiSelectOption[] {
  return (countries ?? [])
    .map((c) => ({
      id: c.id,
      label: c.name,
      group: c.is_historical ? "Historical / defunct" : c.region ?? "Other",
    }))
    .sort(byLabel);
}

export function toMetalOptions(metals: Metal[] | undefined): MultiSelectOption[] {
  return (metals ?? []).map((m) => ({ id: m.id, label: m.name })).sort(byLabel);
}
