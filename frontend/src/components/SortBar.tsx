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
  // Below md the options scroll sideways in one row instead of taking three rows above the coins.
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:pb-1 max-md:mb-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1 max-md:shrink-0">Sort</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-sm border transition-colors max-md:shrink-0 max-md:whitespace-nowrap ${
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
        className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-sm border transition-colors ml-auto max-md:shrink-0 ${
          showFavouritesOnly
            ? "bg-accent text-white border-accent"
            : "bg-white text-gray-700 border-gray-300 hover:border-accent hover:text-accent"
        }`}
      >
        <Heart className="w-3.5 h-3.5" fill={showFavouritesOnly ? "currentColor" : "none"} />
        Favourites
      </button>
    </div>
  );
}
