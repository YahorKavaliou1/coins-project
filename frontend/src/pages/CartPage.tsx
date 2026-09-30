import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShoppingCart, Trash2 } from "lucide-react";
import { getCart, removeFromCart } from "../api/cart";
import { checkout } from "../api/orders";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { getErrorMessage, type ApiError } from "../api/client";
import { inputClass, labelClass, sectionTitleClass } from "../components/formStyles";
import type { Coin } from "../types";

function coinTitle(coin: Coin): string {
  const prefix = `${coin.country.name} ${coin.year} `;
  return coin.name.startsWith(prefix) ? coin.name.slice(prefix.length) : coin.name;
}

export function CartPage() {
  const [address, setAddress] = useState("");
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });

  const removeMutation = useMutation({
    mutationFn: removeFromCart,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => checkout(address),
    onSuccess: (order) => {
      setAddress("");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      toast.success(`Order #${order.id} placed.`);
      navigate("/purchases");
    },
    onError: (err: ApiError) => {
      toast.error(getErrorMessage(err));
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  if (!accessToken) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
        <p className="text-gray-600 mb-4">Please log in to view your cart.</p>
        <button
          onClick={() => navigate("/auth")}
          className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3"
        >
          Log in
        </button>
      </div>
    );
  }

  if (isLoading || !cart) return <p>Loading...</p>;

  if (cart.items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-12 flex flex-col items-center text-center">
        <ShoppingCart className="w-12 h-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold mb-1">Your cart is empty</h1>
        <p className="text-sm text-gray-500 mb-6">Find something for your collection in the shop.</p>
        <Link
          to="/browse"
          className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3"
        >
          Go to shop
        </Link>
      </div>
    );
  }

  const unavailable = cart.items.filter((item) => !item.coin.is_for_sale);
  const itemCount = cart.items.length;
  const available = cart.items.filter((item) => item.coin.is_for_sale);
  // Sold items can't be bought, so they don't count towards the total.
  const total = available.reduce((sum, item) => sum + (item.coin.price ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Your cart</h1>
      <p className="text-sm text-gray-500 mb-6">
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Items */}
        <section className="lg:col-span-2 bg-white border border-gray-200 rounded-md divide-y divide-gray-200">
          {cart.items.map(({ id, coin }) => {
            const image = coin.images[0];
            return (
              <div key={id} className={`flex gap-4 p-4 ${coin.is_for_sale ? "" : "bg-gray-50"}`}>
                <Link
                  to={`/coins/${coin.id}`}
                  className="w-20 h-20 shrink-0 bg-gray-100 border border-gray-200 rounded-sm overflow-hidden flex items-center justify-center"
                >
                  {image ? (
                    <img
                      src={image.url}
                      alt=""
                      className={`w-full h-full object-contain ${coin.is_for_sale ? "" : "opacity-50 grayscale"}`}
                    />
                  ) : (
                    <span className="text-[10px] text-gray-300">No image</span>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="text-accent text-xs font-semibold uppercase">
                    {coin.country.name} · {coin.year}
                  </div>
                  <Link
                    to={`/coins/${coin.id}`}
                    className="font-bold text-sm leading-snug hover:text-accent block mt-0.5"
                  >
                    {coinTitle(coin)}
                  </Link>
                  <div className="text-xs text-gray-400 mt-1">
                    {[coin.grade, coin.catalog_number].filter(Boolean).join(" · ")}
                  </div>
                  {!coin.is_for_sale && (
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      No longer available
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between shrink-0">
                  <span className={`font-bold ${coin.is_for_sale ? "" : "text-gray-400 line-through"}`}>
                    {coin.price !== null ? `$${coin.price.toFixed(2)}` : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(coin.id)}
                    disabled={removeMutation.isPending}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-red-700 disabled:opacity-50"
                    title="Remove from cart"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Summary & checkout */}
        <section className="bg-white border border-gray-200 rounded-md p-5 lg:sticky lg:top-24">
          <h2 className={sectionTitleClass}>Order summary</h2>

          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Items ({available.length})</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-baseline border-t border-gray-200 pt-3 mb-5">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-bold">${total.toFixed(2)}</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkoutMutation.mutate();
            }}
          >
            <label htmlFor="shipping-address" className={labelClass}>
              Shipping address
            </label>
            <textarea
              id="shipping-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, postal code, country"
              required
              rows={3}
              className={`${inputClass} resize-none`}
            />

            {unavailable.length > 0 && (
              <p className="text-xs text-red-700 mt-3">
                Remove unavailable items from your cart to place the order.
              </p>
            )}

            <button
              type="submit"
              disabled={checkoutMutation.isPending || unavailable.length > 0}
              className="mt-4 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutMutation.isPending ? "Placing order..." : "Place order"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
