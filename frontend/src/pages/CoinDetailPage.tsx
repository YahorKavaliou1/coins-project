import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingCart, ChevronLeft } from "lucide-react";
import { getCoin } from "../api/coins";
import { addToCart } from "../api/cart";
import { addFavourite, removeFavourite } from "../api/favourites";
import { useAuthStore } from "../store/authStore";
import { EditCoinModal } from "../components/EditCoinModal";

export function CoinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const coinId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [editing, setEditing] = useState(false);

  const { data: coin, refetch } = useQuery({
    queryKey: ["coin", coinId],
    queryFn: () => getCoin(coinId),
    enabled: Number.isFinite(coinId),
  });

  const addToCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      alert("Added to cart.");
    },
    onError: (err: any) => alert(`Error: ${err.response?.data?.detail || "unknown error"}`),
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: () =>
      coin?.is_favourite ? removeFavourite(coinId) : addFavourite(coinId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coin", coinId] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
    },
    onError: (err: any) => alert(`Error: ${err.response?.data?.detail || "unknown error"}`),
  });

  if (!coin) return <p>Loading...</p>;

  const isOwner = currentUser !== null && coin.owner.id === currentUser.id;
  const canBuy = !!accessToken && !isOwner && coin.is_for_sale;
  const canEdit = isOwner && coin.is_for_sale;

  const activeImage = coin.images[activeImageIdx];

  const namePrefix = `${coin.country.name} ${coin.year} `;
  const displayTitle = coin.name.startsWith(namePrefix)
    ? coin.name.slice(namePrefix.length)
    : coin.name;

  const details: [string, string][] = [
    ["Country / Issuer", coin.country.name],
    ["Year", String(coin.year)],
  ];
  if (coin.denomination) details.push(["Denomination", coin.denomination]);
  if (coin.composition) details.push(["Composition", coin.composition]);
  if (coin.grade) details.push(["Grade", coin.grade]);
  details.push(["Weight", `${coin.weight} ${coin.weight_unit}`]);
  if (coin.diameter !== null) details.push(["Diameter", `${coin.diameter} mm`]);
  if (coin.catalog_number) details.push(["Catalog No.", coin.catalog_number]);
  if (coin.mintage !== null) details.push(["Mintage", coin.mintage.toLocaleString()]);
  details.push(["Metal", coin.metal.name]);

  const summaryParts = [
    coin.country.name,
    String(coin.year),
    coin.denomination,
    coin.metal.name + (coin.composition ? ` (${coin.composition})` : ""),
    `${coin.weight} ${coin.weight_unit}`,
    coin.grade,
    coin.catalog_number,
  ].filter(Boolean);

  return (
    <div>
      <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <button onClick={() => navigate("/browse")} className="flex items-center gap-1 hover:text-accent">
          <ChevronLeft className="w-3 h-3" />
          Shop
        </button>
        <span>/</span>
        <span className="text-gray-700">{coin.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Images */}
        <div className="lg:col-span-2">
          <div className="relative bg-white border border-gray-200 rounded-md overflow-hidden aspect-square flex items-center justify-center">
            {coin.grade && (
              <span className="absolute top-2 left-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                {coin.grade}
              </span>
            )}
            {!coin.is_for_sale && (
              <span className="absolute top-2 right-2 bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded z-10">
                SOLD
              </span>
            )}
            {activeImage ? (
              <img src={activeImage.url} alt={coin.name} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-300">No image</span>
            )}
          </div>

          {coin.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {coin.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`w-16 h-16 rounded border-2 overflow-hidden ${
                    idx === activeImageIdx ? "border-accent" : "border-gray-200"
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="lg:col-span-1">
          <div className="text-accent text-sm font-semibold uppercase">
            {coin.country.name} · {coin.year}
          </div>
          <h1 className="text-2xl font-bold mt-1">{displayTitle}</h1>

          <p className="text-sm text-gray-600 mt-3">{summaryParts.join(" ")}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            {coin.denomination && (
              <span className="border border-gray-300 rounded px-3 py-1 text-xs font-medium text-gray-700">
                {coin.denomination}
              </span>
            )}
            {coin.composition && (
              <span className="border border-gray-300 rounded px-3 py-1 text-xs font-medium text-gray-700">
                {coin.metal.name} ({coin.composition})
              </span>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 mt-5">
            {coin.price !== null && <div className="text-3xl font-bold mb-3">${coin.price.toFixed(2)}</div>}

            {canEdit ? (
              <button
                onClick={() => setEditing(true)}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded py-3"
              >
                Edit
              </button>
            ) : canBuy ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavouriteMutation.mutate()}
                  className={`border rounded p-3 transition-colors ${
                    coin.is_favourite
                      ? "text-accent border-accent bg-accent/10"
                      : "text-gray-400 hover:text-accent hover:border-accent"
                  }`}
                  title={coin.is_favourite ? "Remove from favourites" : "Add to favourites"}
                  type="button"
                >
                  <Heart className="w-5 h-5" fill={coin.is_favourite ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => addToCartMutation.mutate(coin.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold uppercase rounded py-3"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to cart
                </button>
              </div>
            ) : !coin.is_for_sale ? (
              <div className="text-center text-gray-400 italic py-2">Sold</div>
            ) : null}
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <div className="text-accent text-xs font-semibold uppercase">{label}</div>
                <div className="text-sm text-gray-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* Reserved space for future AI-generated insight */}
          <div className="mt-4" />
        </div>
      </div>

      {editing && (
        <EditCoinModal
          coin={coin}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
