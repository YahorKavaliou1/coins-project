import { Heart } from "lucide-react";
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
  showFavouritesOnly: boolean;
  onToggleFavouritesOnly: () => void;
}

export function SortBar({ value, onChange, showFavouritesOnly, onToggleFavouritesOnly }: SortBarProps) {
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

      <button
        onClick={onToggleFavouritesOnly}
        className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-sm border transition-colors ml-auto ${
          showFavouritesOnly
            ? "bg-red-600 text-white border-red-600"
            : "bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:text-red-500"
        }`}
      >
        <Heart className="w-3.5 h-3.5" fill={showFavouritesOnly ? "currentColor" : "none"} />
        Favourites
      </button>
    </div>
  );
}
