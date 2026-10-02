import type { Country, MetalFacet } from "../types";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

interface BrowseSidebarProps {
  className?: string;

  countries: Country[];
  selectedCountryIds: number[];
  onCountryChange: (ids: number[]) => void;

  availableMetals: MetalFacet[];
  selectedMetalIds: number[];
  onToggleMetal: (metalId: number) => void;

  availableGrades: string[];
  grade: string;
  onGradeChange: (value: string) => void;

  availableCategories: string[];
  category: string;
  onCategoryChange: (value: string) => void;
}

const selectClass =
  "w-full border border-gray-300 rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-accent";

export function BrowseSidebar({
  className = "",
  countries,
  selectedCountryIds,
  onCountryChange,
  availableMetals,
  selectedMetalIds,
  onToggleMetal,
  availableGrades,
  grade,
  onGradeChange,
  availableCategories,
  category,
  onCategoryChange,
}: BrowseSidebarProps) {
  const countryOptions = countries
    .map((c) => ({
      id: c.id,
      label: c.name,
      group: c.is_historical ? "Historical / defunct" : c.region ?? "Other",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <aside className={`w-56 shrink-0 flex flex-col gap-6 max-md:w-full max-md:bg-white max-md:border max-md:border-gray-200 max-md:rounded-md max-md:p-4 max-md:gap-4 ${className}`}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Country / Issuer</h3>
        <MultiSelectDropdown
          options={countryOptions}
          selectedIds={selectedCountryIds}
          onChange={onCountryChange}
          placeholder="All Countries"
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Material</h3>
        {availableMetals.length === 0 && <p className="text-sm text-gray-400">No metals available</p>}
        <div className="flex flex-col gap-1.5">
          {availableMetals.map((metal) => (
            <label key={metal.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMetalIds.includes(metal.id)}
                onChange={() => onToggleMetal(metal.id)}
                className="accent-accent"
              />
              {metal.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Grade / Conservation</h3>
        <select value={grade} onChange={(e) => onGradeChange(e.target.value)} className={selectClass}>
          <option value="">All Grades</option>
          {availableGrades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Category</h3>
        <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className={selectClass}>
          <option value="">All Categories</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
