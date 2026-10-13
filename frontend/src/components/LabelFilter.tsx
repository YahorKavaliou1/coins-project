import { useState } from "react";
import { Search } from "lucide-react";
import type { LabelFacet } from "../types";

/** Labels shown before "Show all"; the facet comes sorted by use, so these are the most popular. */
const COLLAPSED_COUNT = 8;
/** Above this many labels the expanded list gets a search field. */
const SEARCH_THRESHOLD = 15;

interface LabelFilterProps {
  available: LabelFacet[];
  selected: string[];
  onChange: (labels: string[]) => void;
}

/**
 * Toggleable label chips: a coin matches if it has any of the selected labels.
 *
 * Only the most used labels are shown until the visitor expands the list; selected labels
 * always stay visible so they can be turned off.
 */
export function LabelFilter({ available, selected, onChange }: LabelFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  // A selected label may be missing from the facet when other filters exclude all its coins.
  const missing = selected
    .filter((name) => !available.some((l) => l.name === name))
    .map((name) => ({ name, count: 0 }));
  const all = [...available, ...missing];

  if (all.length === 0) return null;

  const query = search.trim().toLowerCase();
  const visible = expanded
    ? all.filter((l) => !query || l.name.toLowerCase().includes(query))
    : all.filter((l, i) => i < COLLAPSED_COUNT || selected.includes(l.name));
  const hiddenCount = all.length - visible.length;

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Labels</h3>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-accent">
            Clear ({selected.length})
          </button>
        )}
      </div>

      {expanded && all.length > SEARCH_THRESHOLD && (
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a label..."
            className="w-full border border-gray-300 rounded-sm pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      )}

      <div className={`flex flex-wrap gap-1.5 ${expanded ? "max-h-64 overflow-y-auto" : ""}`}>
        {visible.map((label) => {
          const active = selected.includes(label.name);
          return (
            <button
              key={label.name}
              type="button"
              onClick={() => toggle(label.name)}
              aria-pressed={active}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "bg-accent border-accent text-white"
                  : "bg-white border-gray-300 text-gray-700 hover:border-accent hover:text-accent"
              }`}
            >
              {label.name}
              <span className={active ? "text-white/70" : "text-gray-400"}>{label.count}</span>
            </button>
          );
        })}
        {expanded && visible.length === 0 && <p className="text-sm text-gray-400">No matches</p>}
      </div>

      {(expanded || hiddenCount > 0) && (
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setSearch("");
          }}
          className="mt-2 text-xs font-semibold text-accent hover:text-accent-dark"
        >
          {expanded ? "Show less" : `Show all (+${hiddenCount})`}
        </button>
      )}
    </div>
  );
}
