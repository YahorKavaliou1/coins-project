import type { Country, MetalFacet } from "../types";

interface BrowseSidebarProps {
  countries: Country[];
  countryId: string;
  onCountryChange: (value: string) => void;

  availableMetals: MetalFacet[];
  selectedMetalIds: number[];
  onToggleMetal: (metalId: number) => void;

  availableGrades: string[];
  grade: string;
  onGradeChange: (value: string) => void;
}

export function BrowseSidebar({
  countries,
  countryId,
  onCountryChange,
  availableMetals,
  selectedMetalIds,
  onToggleMetal,
  availableGrades,
  grade,
  onGradeChange,
}: BrowseSidebarProps) {
  const currentCountries = countries.filter((c) => !c.is_historical).sort((a, b) => a.name.localeCompare(b.name));
  const historicalCountries = countries.filter((c) => c.is_historical).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Country / Issuer</h3>
        <select
          value={countryId}
          onChange={(e) => onCountryChange(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Countries</option>
          {currentCountries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {historicalCountries.length > 0 && (
            <optgroup label="Historical / defunct">
              {historicalCountries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
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
        <select
          value={grade}
          onChange={(e) => onGradeChange(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Grades</option>
          {availableGrades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
