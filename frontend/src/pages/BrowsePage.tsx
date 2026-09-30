import { useState } from "react";
import { Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCoins, getCoinFacets } from "../api/coins";
import { listFavourites } from "../api/favourites";
import { listCountries } from "../api/reference";
import { addToCart } from "../api/cart";
import { CoinCard } from "../components/CoinCard";
import { EditCoinModal } from "../components/EditCoinModal";
import { BrowseSidebar } from "../components/BrowseSidebar";
import { SortBar } from "../components/SortBar";
import type { CoinSort } from "../api/coins";
import type { Coin } from "../types";
import { useAuthStore } from "../store/authStore";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";

export function BrowsePage() {
  const queryClient = useQueryClient();
  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [selectedCountryIds, setSelectedCountryIds] = useState<number[]>([]);
  const [selectedMetalIds, setSelectedMetalIds] = useState<number[]>([]);
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<CoinSort>("recent");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [editingCoin, setEditingCoin] = useState<Coin | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });

  const commonFilters = {
    country_id: selectedCountryIds.length > 0 ? selectedCountryIds : undefined,
    grade: grade || undefined,
    category: category || undefined,
    q: appliedQ || undefined,
    for_sale_only: forSaleOnly || undefined,
  };

  const { data: facets } = useQuery({
    queryKey: ["coin-facets", selectedCountryIds, grade, category, appliedQ, forSaleOnly, selectedMetalIds],
    queryFn: () => getCoinFacets({ ...commonFilters, metal_id: selectedMetalIds }),
  });

  const { data: page, refetch } = useQuery({
    queryKey: ["coins", selectedCountryIds, grade, category, appliedQ, forSaleOnly, selectedMetalIds, sort, favouritesOnly],
    queryFn: () =>
      favouritesOnly
        ? listFavourites()
        : listCoins({ ...commonFilters, metal_id: selectedMetalIds, sort }),
  });

  function runSearch() {
    setAppliedQ(qInput);
  }

  function toggleMetal(metalId: number) {
    setSelectedMetalIds((prev) =>
      prev.includes(metalId) ? prev.filter((id) => id !== metalId) : [...prev, metalId]
    );
  }

  const addToCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart.");
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 flex flex-wrap gap-3 items-center justify-end">
        <div className="relative w-full max-w-xs">
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Search by name, country, metal, year..."
            className="w-full border border-gray-300 rounded-sm pl-3 pr-16 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <div className="absolute right-0 top-0 h-full flex items-center">
            {qInput && (
              <button
                onClick={() => {
                  setQInput("");
                  setAppliedQ("");
                }}
                title="Clear"
                className="h-full px-2 flex items-center justify-center text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={runSearch}
              title="Search"
              className="h-full px-3 flex items-center justify-center text-gray-500 hover:text-accent"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={forSaleOnly}
            onChange={(e) => setForSaleOnly(e.target.checked)}
            className="accent-accent"
          />
          For sale only
        </label>
      </div>

      <div className="flex gap-6 items-start">
        <BrowseSidebar
          countries={countries ?? []}
          selectedCountryIds={selectedCountryIds}
          onCountryChange={setSelectedCountryIds}
          availableMetals={facets?.metals ?? []}
          selectedMetalIds={selectedMetalIds}
          onToggleMetal={toggleMetal}
          availableGrades={facets?.grades ?? []}
          grade={grade}
          onGradeChange={setGrade}
          availableCategories={facets?.categories ?? []}
          category={category}
          onCategoryChange={setCategory}
        />

        <div className="flex-1">
          <SortBar
            value={sort}
            onChange={setSort}
            showFavouritesOnly={favouritesOnly}
            onToggleFavouritesOnly={() => setFavouritesOnly((v) => !v)}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {page?.items.length === 0 && <p>No coins found</p>}
          {page?.items.map((coin) => (
            <CoinCard
              key={coin.id}
              coin={coin}
              onAddToCart={accessToken ? (id) => addToCartMutation.mutate(id) : undefined}
              onEdit={(c) => setEditingCoin(c)}
            />
          ))}
          </div>
        </div>
      </div>

      {editingCoin && (
        <EditCoinModal
          coin={editingCoin}
          onClose={() => setEditingCoin(null)}
          onSaved={() => {
            setEditingCoin(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
