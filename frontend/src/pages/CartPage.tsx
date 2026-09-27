import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCart, removeFromCart } from "../api/cart";
import { checkout } from "../api/orders";
import { useAuthStore } from "../store/authStore";

export function CartPage() {
  const [address, setAddress] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data: cart } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });

  const removeMutation = useMutation({
    mutationFn: removeFromCart,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => checkout(address),
    onSuccess: (order) => {
      setLog((l) => [...l, JSON.stringify({ order_placed: order }, null, 2)]);
      setAddress("");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      setLog((l) => [...l, JSON.stringify({ error: err.response?.data })]);
    },
  });

  if (!accessToken) return <p>Please log in to view your cart.</p>;

  return (
    <div>
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <h2 className="font-semibold mb-2">Your cart</h2>
        {(!cart || cart.items.length === 0) && <p>Your cart is empty.</p>}
        {cart?.items.map((item) => (
          <div key={item.id} className="flex justify-between items-center border-b py-2 last:border-b-0">
            <div className="flex items-center gap-3">
              {item.coin.images[0] && (
                <img src={item.coin.images[0].url} alt="" className="w-12 h-12 object-cover rounded" />
              )}
              <div>
                <div className="font-medium text-sm">{item.coin.name}</div>
                <div className="text-green-700 font-bold text-sm">
                  {item.coin.price !== null ? `$${item.coin.price.toFixed(2)}` : "Price not set"}
                </div>
              </div>
            </div>
            <button
              onClick={() => removeMutation.mutate(item.coin.id)}
              className="bg-red-700 hover:bg-red-600 text-white text-sm rounded px-3 py-1"
            >
              Remove
            </button>
          </div>
        ))}
        {cart && cart.items.length > 0 && (
          <div className="text-right font-bold mt-3 pt-3 border-t">Total: ${cart.total_price.toFixed(2)}</div>
        )}
      </div>

      {cart && cart.items.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Checkout</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkoutMutation.mutate();
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shipping address"
              required
              className="border rounded p-2"
            />
            <button type="submit" className="bg-brand text-white rounded p-2">
              Place order
            </button>
          </form>
        </div>
      )}

      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap">
        {log.join("\n")}
      </pre>
    </div>
  );
}
