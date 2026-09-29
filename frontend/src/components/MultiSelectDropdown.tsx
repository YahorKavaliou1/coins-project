import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface MultiSelectOption {
  id: number;
  label: string;
  group?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
}

export function MultiSelectDropdown({ options, selectedIds, onChange, placeholder }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  const groups = [...new Set(filtered.map((o) => o.group ?? ""))].sort((a, b) => {
    if (a === "Historical / defunct") return 1;
    if (b === "Historical / defunct") return -1;
    return a.localeCompare(b);
  });

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const selectedLabels = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.label);
  const triggerText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-sm px-2 py-2 text-sm text-left focus:outline-none focus:border-accent"
      >
        <span className={selectedLabels.length === 0 ? "text-gray-500" : "text-gray-900"}>{triggerText}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 max-h-80 flex flex-col">
          <div className="relative p-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full border border-gray-200 rounded-sm pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-gray-400 px-3 py-2">No matches</p>}
            {groups.map((group) => (
              <div key={group}>
                {group && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {group}
                  </div>
                )}
                {filtered
                  .filter((o) => (o.group ?? "") === group)
                  .map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={() => toggle(o.id)}
                        className="accent-accent"
                      />
                      {o.label}
                    </label>
                  ))}
              </div>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-gray-500 hover:text-accent px-3 py-2 border-t border-gray-100 text-left"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
