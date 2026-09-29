import { useState } from "react";
import { Search, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listCoins } from "../api/coins";
import { addToCart } from "../api/cart";
import { CoinCard } from "../components/CoinCard";
import { EditCoinModal } from "../components/EditCoinModal";
import type { Coin } from "../types";
import { useAuthStore } from "../store/authStore";

export function BrowsePage() {
  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [editingCoin, setEditingCoin] = useState<Coin | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: page, refetch } = useQuery({
    queryKey: ["coins", appliedQ, forSaleOnly],
    queryFn: () =>
      listCoins({
        q: appliedQ || undefined,
        for_sale_only: forSaleOnly || undefined,
      }),
  });

  function runSearch() {
    setAppliedQ(qInput);
  }

  const addToCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: () => {
      alert("Added to cart.");
    },
    onError: (err: any) => {
      alert(`Error: ${err.response?.data?.detail || "unknown error"}`);
    },
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
