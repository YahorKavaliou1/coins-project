import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCoins } from "../api/coins";
import { listCountries } from "../api/reference";
import { addToCart } from "../api/cart";
import { CoinCard } from "../components/CoinCard";
import { EditCoinModal } from "../components/EditCoinModal";
import type { Coin } from "../types";
import { useAuthStore } from "../store/authStore";

export function BrowsePage() {
  const [countryId, setCountryId] = useState("");
  const [q, setQ] = useState("");
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [editingCoin, setEditingCoin] = useState<Coin | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });

  const { data: page, refetch } = useQuery({
    queryKey: ["coins", countryId, q, forSaleOnly],
    queryFn: () =>
      listCoins({
        country_id: countryId ? parseInt(countryId, 10) : undefined,
        q: q || undefined,
        for_sale_only: forSaleOnly || undefined,
      }),
  });

  const addToCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      alert("Added to cart.");
    },
    onError: (err: any) => {
      alert(`Error: ${err.response?.data?.detail || "unknown error"}`);
    },
  });

  const currentCountries = countries?.filter((c) => !c.is_historical) ?? [];
  const historicalCountries = countries?.filter((c) => c.is_historical) ?? [];
  const regions = [...new Set(currentCountries.map((c) => c.region ?? "Other"))].sort();

  return (
    <div>
      <div className="bg-white p-4 rounded-lg shadow mb-4 flex flex-wrap gap-2 items-center">
        <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="border rounded p-2">
          <option value="">All countries</option>
          {regions.map((region) => (
            <optgroup key={region} label={region}>
              {currentCountries
                .filter((c) => (c.region ?? "Other") === region)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
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

        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          className="border rounded p-2 flex-1 min-w-[180px]"
        />

        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={forSaleOnly} onChange={(e) => setForSaleOnly(e.target.checked)} />
          For sale only
        </label>

        <button onClick={() => refetch()} className="bg-brand text-white rounded p-2 px-4">
          Apply
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
