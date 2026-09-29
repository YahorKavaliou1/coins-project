import type { CoinSort } from "../api/coins";

interface SortOption {
  value: CoinSort;
  label: string;
}

const options: SortOption[] = [
  { value: "recent", label: "RECENT" },
  { value: "price_asc", label: "PRICE ↑" },
  { value: "price_desc", label: "PRICE ↓" },
  { value: "weight_asc", label: "WEIGHT ↑" },
  { value: "weight_desc", label: "WEIGHT ↓" },
  { value: "date_asc", label: "DATE ↑" },
  { value: "date_desc", label: "DATE ↓" },
];

interface SortBarProps {
  value: CoinSort;
  onChange: (value: CoinSort) => void;
}

export function SortBar({ value, onChange }: SortBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1">Sort</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-sm border transition-colors ${
            value === opt.value
              ? "bg-brand text-white border-brand"
              : "bg-white text-gray-700 border-gray-300 hover:border-accent hover:text-accent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
