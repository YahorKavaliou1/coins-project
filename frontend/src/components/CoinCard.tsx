import type { Coin } from "../types";
import { useAuthStore } from "../store/authStore";

interface CoinCardProps {
  coin: Coin;
  onAddToCart?: (coinId: number) => void;
  onEdit?: (coin: Coin) => void;
}

export function CoinCard({ coin, onAddToCart, onEdit }: CoinCardProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.currentUser);

  const isOwner = currentUser !== null && coin.owner.id === currentUser.id;
  const canBuy = !!accessToken && !isOwner && coin.is_for_sale;
  const canEdit = isOwner && coin.is_for_sale;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold">{coin.name}</h3>
      <p className="text-sm text-gray-600">Year: {coin.year}</p>
      <p className="text-sm text-gray-600">Country: {coin.country.name}</p>
      <p className="text-sm text-gray-600">Metal: {coin.metal.name}</p>
      <p className="text-sm text-gray-600">
        Weight: {coin.weight} {coin.weight_unit}
      </p>
      {coin.composition && <p className="text-sm text-gray-600">Composition: {coin.composition}</p>}
      {coin.diameter !== null && <p className="text-sm text-gray-600">Diameter: {coin.diameter} mm</p>}
      {coin.mintage !== null && (
        <p className="text-sm text-gray-600">Mintage: {coin.mintage.toLocaleString()}</p>
      )}
      {coin.grade && <p className="text-sm text-gray-600">Grade: {coin.grade}</p>}
      {coin.catalog_number && <p className="text-sm text-gray-600">Catalog No.: {coin.catalog_number}</p>}
      {coin.price !== null && <p className="font-bold text-green-700 mt-1">${coin.price.toFixed(2)}</p>}

      {coin.images.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {coin.images.map((img) => (
            <img key={img.id} src={img.url} alt="" className="w-16 h-16 object-cover rounded border" />
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!coin.is_for_sale && <p className="text-gray-400 italic text-sm">Sold</p>}
        {canBuy && onAddToCart && (
          <button
            onClick={() => onAddToCart(coin.id)}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm rounded p-2"
          >
            Add to cart
          </button>
        )}
        {canEdit && onEdit && (
          <button
            onClick={() => onEdit(coin)}
            className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded p-2"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
