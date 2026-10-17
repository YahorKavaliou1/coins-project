import { Link } from "react-router-dom";
import type { Order } from "../types";
import { formatPrice } from "../utils/money";

/** The coins of an order with photos and links, then shipping and the total. */
export function OrderItems({ order }: { order: Order }) {
  return (
    <div className="text-sm">
      {order.items.map((item) => {
        const content = (
          <>
            <span className="w-12 h-12 shrink-0 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
              {item.image_url ? (
                <img src={item.image_url} alt="" loading="lazy" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[9px] text-gray-400">No image</span>
              )}
            </span>
            <span className="flex-1 min-w-0">{item.coin_name_snapshot}</span>
          </>
        );
        return (
          <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
            {item.coin_id !== null ? (
              <Link to={`/coins/${item.coin_id}`} className="flex-1 min-w-0 flex items-center gap-3 hover:text-accent">
                {content}
              </Link>
            ) : (
              <span className="flex-1 min-w-0 flex items-center gap-3">{content}</span>
            )}
            <span className="font-semibold whitespace-nowrap">{formatPrice(item.price_paid)}</span>
          </div>
        );
      })}
      <div className="flex justify-between gap-3 py-2 text-gray-500">
        <span>Shipping{order.shipping_method ? `: ${order.shipping_method}` : ""}</span>
        <span className="whitespace-nowrap">
          {order.shipping_price !== null ? formatPrice(order.shipping_price) : "arranged with the seller"}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-2 border-t border-gray-200 font-bold">
        <span>Total</span>
        <span>{formatPrice(order.total_price)}</span>
      </div>
    </div>
  );
}
