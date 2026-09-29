import { Heart, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Coin } from "../types";
import { useAuthStore } from "../store/authStore";
import { addFavourite, removeFavourite } from "../api/favourites";

interface CoinCardProps {
  coin: Coin;
  onAddToCart?: (coinId: number) => void;
  onEdit?: (coin: Coin) => void;
}

export function CoinCard({ coin, onAddToCart, onEdit }: CoinCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.currentUser);

  const toggleFavouriteMutation = useMutation({
    mutationFn: () =>
      coin.is_favourite ? removeFavourite(coin.id) : addFavourite(coin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["coin", coin.id] });
    },
    onError: (err: any) => alert(`Error: ${err.response?.data?.detail || "unknown error"}`),
  });

  const isOwner = currentUser !== null && coin.owner.id === currentUser.id;
  const canBuy = !!accessToken && !isOwner && coin.is_for_sale;
  const canEdit = isOwner && coin.is_for_sale;

  const images = coin.images.slice(0, 2);

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      onClick={() => navigate(`/coins/${coin.id}`)}
      className="bg-white rounded-lg shadow overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Images */}
      <div className="relative flex bg-gray-100 aspect-[2/1]">
        {images.length > 0 ? (
          images.map((img) => (
            <img key={img.id} src={img.url} alt="" className="w-1/2 h-full object-contain" />
          ))
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            No image
          </div>
        )}

        {coin.grade && (
          <span className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {coin.grade}
          </span>
        )}

        {!coin.is_for_sale && (
          <span className="absolute top-1.5 right-1.5 bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            SOLD
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <div className="text-accent text-xs font-semibold uppercase">
          {coin.country.name}
          {coin.year ? ` · ${coin.year}` : ""}
        </div>

        <div className="font-bold text-sm mt-0.5 leading-snug">
          {coin.denomination || coin.metal.name}
          {coin.extra_info ? ` - ${coin.extra_info}` : ""}
        </div>

        <div className="flex items-center justify-between mt-1">
          {coin.catalog_number ? (
            <span className="text-gray-400 text-xs">{coin.catalog_number}</span>
          ) : (
            <span />
          )}
          {coin.price !== null && (
            <span className="font-bold text-sm whitespace-nowrap">${coin.price.toFixed(2)}</span>
          )}
        </div>

        <div className="mt-auto pt-3" onClick={stop}>
          {canEdit && onEdit ? (
            <button
              onClick={() => onEdit(coin)}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded py-2"
            >
              Edit
            </button>
          ) : canBuy && onAddToCart ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavouriteMutation.mutate()}
                className={`border rounded p-2 transition-colors ${
                  coin.is_favourite
                    ? "text-red-500 border-red-300 bg-red-50"
                    : "text-gray-400 hover:text-red-500 hover:border-red-300"
                }`}
                title={coin.is_favourite ? "Remove from favourites" : "Add to favourites"}
                type="button"
              >
                <Heart className="w-4 h-4" fill={coin.is_favourite ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onAddToCart(coin.id)}
                className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase rounded py-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to cart
              </button>
            </div>
          ) : !coin.is_for_sale ? (
            <div className="text-center text-gray-400 text-sm italic py-2">Sold</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
