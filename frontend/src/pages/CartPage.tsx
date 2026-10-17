import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShoppingCart, Trash2 } from "lucide-react";
import { getCart, removeFromCart } from "../api/cart";
import { listAddresses } from "../api/account";
import { checkout } from "../api/orders";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { getErrorMessage, type ApiError } from "../api/client";
import { AddressForm } from "../components/AddressForm";
import { EMPTY_ADDRESS, addressSummary, cleanAddress } from "../utils/address";
import { sectionTitleClass } from "../components/formStyles";
import type { AddressFields, CartItemRead, CartSeller, Coin } from "../types";
import { formatPrice } from "../utils/money";
import { thumbnailSrc } from "../utils/images";

function coinTitle(coin: Coin): string {
  const prefix = `${coin.country.name} ${coin.year} `;
  return coin.name.startsWith(prefix) ? coin.name.slice(prefix.length) : coin.name;
}

/** Cents, so float sums like 0.1 + 0.2 add up like the server's decimals. */
const toCents = (euros: number) => Math.round(euros * 100);

export function CartPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
    enabled: !!accessToken,
  });

  // Shipping option per seller; a seller's first option until the buyer picks another.
  const [shippingChoice, setShippingChoice] = useState<Record<number, string>>({});
  // A saved address id, "new", or null for the default one.
  const [addressChoice, setAddressChoice] = useState<number | "new" | null>(null);
  const [newAddress, setNewAddress] = useState<AddressFields>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);

  const removeMutation = useMutation({
    mutationFn: async (coinIds: number[]) => {
      for (const id of coinIds) await removeFromCart(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  const sellers = cart?.sellers ?? [];
  const available = cart?.items.filter((item) => item.coin.is_for_sale) ?? [];
  const unavailable = cart?.items.filter((item) => !item.coin.is_for_sale) ?? [];

  const chosenOption = (seller: CartSeller) =>
    seller.shipping_options.find((o) => o.name === shippingChoice[seller.id]) ?? seller.shipping_options[0];
  const itemsCents = available.reduce((sum, item) => sum + toCents(item.coin.price ?? 0), 0);
  const shippingCents = sellers.reduce((sum, s) => sum + toCents(chosenOption(s)?.price ?? 0), 0);
  const total = (itemsCents + shippingCents) / 100;

  const defaultAddress = addresses?.find((a) => a.is_default) ?? addresses?.[0];
  const selectedAddress = addressChoice ?? defaultAddress?.id ?? "new";

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkout({
        ...(selectedAddress === "new"
          ? { address: cleanAddress(newAddress), save_address: saveAddress }
          : { address_id: selectedAddress }),
        shipping: sellers.map((s) => ({ seller_id: s.id, option_name: chosenOption(s)?.name ?? null })),
        expected_total: total,
      }),
    onSuccess: (orders) => {
      setNewAddress(EMPTY_ADDRESS);
      for (const key of ["cart", "orders", "coins", "addresses", "my-lots"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(
        orders.length === 1
          ? `Order #${orders[0].id} placed. The seller's payment details are on the way to your email.`
          : `${orders.length} orders placed, one per seller. Payment details are on the way to your email.`
      );
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
          onClick={() => navigate("/auth?next=/cart")}
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

  const itemRow = ({ id, coin }: CartItemRead) => {
    const image = coin.images[0];
    return (
      <div key={id} className={`flex gap-4 p-4 ${coin.is_for_sale ? "" : "bg-gray-50"}`}>
        <Link
          to={`/coins/${coin.id}`}
          className="w-20 h-20 shrink-0 bg-gray-100 border border-gray-200 rounded-sm overflow-hidden flex items-center justify-center"
        >
          {image ? (
            <img
              src={thumbnailSrc(image)}
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
          <Link to={`/coins/${coin.id}`} className="font-bold text-sm leading-snug hover:text-accent block mt-0.5">
            {coinTitle(coin)}
          </Link>
          <div className="text-xs text-gray-400 mt-1">{[coin.grade, coin.catalog_number].filter(Boolean).join(" · ")}</div>
          {!coin.is_for_sale && (
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 mt-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              No longer available
            </div>
          )}
        </div>
        <div className="flex flex-col items-end justify-between shrink-0">
          <span className={`font-bold ${coin.is_for_sale ? "" : "text-gray-400 line-through"}`}>
            {coin.price !== null ? formatPrice(coin.price) : "—"}
          </span>
          <button
            type="button"
            onClick={() => removeMutation.mutate([coin.id])}
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
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Your cart</h1>
      <p className="text-sm text-gray-500 mb-6">
        {cart.items.length} {cart.items.length === 1 ? "item" : "items"}
        {sellers.length > 1 && ` from ${sellers.length} sellers: one order per seller, each paid and shipped separately`}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {unavailable.length > 0 && (
            <section className="bg-white border border-red-200 rounded-md divide-y divide-gray-200">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50">
                <span className="text-sm font-semibold text-red-800">
                  {unavailable.length} {unavailable.length === 1 ? "item is" : "items are"} no longer available
                </span>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(unavailable.map((i) => i.coin.id))}
                  disabled={removeMutation.isPending}
                  className="text-xs font-bold uppercase tracking-wide text-red-700 hover:text-red-900 disabled:opacity-50"
                >
                  Remove all
                </button>
              </div>
              {unavailable.map(itemRow)}
            </section>
          )}

          {sellers.map((seller) => {
            const items = available.filter((item) => item.coin.owner.id === seller.id);
            const option = chosenOption(seller);
            return (
              <section key={seller.id} className="bg-white border border-gray-200 rounded-md divide-y divide-gray-200">
                <div className="px-4 py-3 text-sm">
                  Sold by <span className="font-semibold">{seller.name || "a seller"}</span>
                </div>
                {items.map(itemRow)}
                <div className="px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Shipping</div>
                  {seller.shipping_options.length === 0 ? (
                    <p className="text-sm text-gray-500">The seller arranges shipping and its cost with you after the order.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {seller.shipping_options.map((o) => (
                        <label key={o.name} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name={`shipping-${seller.id}`}
                            checked={option?.name === o.name}
                            onChange={() => setShippingChoice((prev) => ({ ...prev, [seller.id]: o.name }))}
                            className="accent-accent"
                          />
                          <span className="flex-1">{o.name}</span>
                          <span className="font-semibold">{o.price === 0 ? "Free" : formatPrice(o.price)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Summary & checkout */}
        <section className="bg-white border border-gray-200 rounded-md p-5 lg:sticky lg:top-24">
          <h2 className={sectionTitleClass}>Order summary</h2>

          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Items ({available.length})</span>
            <span>{formatPrice(itemsCents / 100)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Shipping</span>
            <span>{formatPrice(shippingCents / 100)}</span>
          </div>
          <div className="flex justify-between items-baseline border-t border-gray-200 pt-3 mb-5">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-bold">{formatPrice(total)}</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkoutMutation.mutate();
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Deliver to</div>
            <div className="flex flex-col gap-2 mb-3">
              {addresses?.map((address) => (
                <label key={address.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddress === address.id}
                    onChange={() => setAddressChoice(address.id)}
                    className="accent-accent mt-1"
                  />
                  <span>{addressSummary(address)}</span>
                </label>
              ))}
              {(addresses?.length ?? 0) > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddress === "new"}
                    onChange={() => setAddressChoice("new")}
                    className="accent-accent"
                  />
                  A new address
                </label>
              )}
            </div>

            {selectedAddress === "new" && (
              <div className="mb-3">
                <AddressForm value={newAddress} onChange={setNewAddress} />
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="accent-accent"
                  />
                  Save to my addresses
                </label>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3">
              After placing the order you'll get the seller's payment details by email. Pay, then mark the order as
              paid in My purchases.
            </p>

            {unavailable.length > 0 && (
              <p className="text-xs text-red-700 mt-3">Remove unavailable items from your cart to place the order.</p>
            )}

            <button
              type="submit"
              disabled={checkoutMutation.isPending || unavailable.length > 0 || available.length === 0}
              className="mt-4 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutMutation.isPending ? "Placing order..." : sellers.length > 1 ? `Place ${sellers.length} orders` : "Place order"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
