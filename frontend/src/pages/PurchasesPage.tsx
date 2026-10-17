import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Package } from "lucide-react";
import { listMyOrders, markOrderPaid } from "../api/orders";
import { getErrorMessage, type ApiError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OrderItems } from "../components/OrderItems";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import type { BuyerOrder } from "../types";
import { formatUtcDate, formatUtcDateTime } from "../utils/dates";
import { formatPrice } from "../utils/money";

export function PurchasesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: listMyOrders,
    enabled: !!accessToken,
  });

  if (!accessToken) return <p>Please log in to view your purchases.</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-4">My purchases</h1>
      {orders?.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No purchases yet.</p>
          <Link to="/browse" className="text-accent font-semibold hover:text-accent-dark">
            Go to shop
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {orders?.map((order) => (
          <PurchaseCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 text-gray-400 hover:text-accent"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function PurchaseCard({ order }: { order: BuyerOrder }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const paidMutation = useMutation({
    mutationFn: () => markOrderPaid(order.id),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Thank you! The seller will check the payment and ship your coins.");
    },
    onError: (err: ApiError) => {
      setConfirming(false);
      toast.error(getErrorMessage(err));
    },
  });

  const { seller } = order;
  const hasContacts = seller.contact_email || seller.contact_phone || seller.contact_note;

  return (
    <article className="bg-white border border-gray-200 rounded-md">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-gray-200 max-sm:px-4">
        <h2 className="font-bold">Order #{order.id}</h2>
        <OrderStatusBadge status={order.status} />
        <span className="text-xs text-gray-400 ml-auto">{formatUtcDateTime(order.created_at)}</span>
      </header>

      <div className="px-5 py-4 flex flex-col gap-4 max-sm:px-4">
        {order.status === "awaiting_payment" && (
          <div className="border border-amber-200 bg-amber-50 rounded-sm p-4">
            <div className="font-semibold text-amber-900 mb-1">
              Pay {formatPrice(order.total_price)} to {seller.name || "the seller"}
            </div>
            {seller.payment_details ? (
              <div className="flex items-start gap-2">
                <pre className="flex-1 whitespace-pre-wrap font-sans text-sm text-gray-800 bg-white border border-amber-100 rounded-sm p-3">
                  {seller.payment_details}
                </pre>
                <CopyButton text={seller.payment_details} />
              </div>
            ) : hasContacts ? (
              <p className="text-sm text-amber-900">
                The seller hasn't added payment details yet. Please contact them using the details below.
              </p>
            ) : (
              <p className="text-sm text-amber-900">
                The seller hasn't added payment details yet. They have been asked to: they will appear here. If it takes
                long,{" "}
                <Link to="/contact" className="underline font-semibold">
                  contact us
                </Link>
                .
              </p>
            )}
            <p className="text-xs text-amber-800 mt-2">
              Add the order number <strong>#{order.id}</strong> to the payment reference.
            </p>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-sm px-4 py-2.5"
            >
              I've paid
            </button>
          </div>
        )}

        {order.status === "paid" && (
          <p className="text-sm text-blue-900 bg-blue-50 border border-blue-100 rounded-sm p-3">
            You marked this order as paid on {formatUtcDate(order.paid_at!)}. The seller will check the payment and ship
            your coins.
          </p>
        )}

        {order.status === "shipped" && (
          <div className="text-sm text-green-900 bg-green-50 border border-green-100 rounded-sm p-3">
            Shipped on {formatUtcDate(order.shipped_at!)}.
            {order.tracking_code ? (
              <div className="flex items-center gap-2 mt-1">
                Tracking code: <span className="font-mono font-semibold">{order.tracking_code}</span>
                <CopyButton text={order.tracking_code} />
              </div>
            ) : (
              " The seller didn't add a tracking code."
            )}
          </div>
        )}

        <OrderItems order={order} />

        <div className="grid grid-cols-2 gap-4 text-sm max-sm:grid-cols-1">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Seller</div>
            <div className="font-semibold">{seller.name || "—"}</div>
            {hasContacts ? (
              <div className="text-gray-600 whitespace-pre-line">
                {seller.contact_email && (
                  <a href={`mailto:${seller.contact_email}`} className="block hover:text-accent">
                    {seller.contact_email}
                  </a>
                )}
                {seller.contact_phone && (
                  <a href={`tel:${seller.contact_phone.replace(/[^\d+]/g, "")}`} className="block hover:text-accent">
                    {seller.contact_phone}
                  </a>
                )}
                {seller.contact_note}
              </div>
            ) : (
              <div className="text-gray-400">No contacts given.</div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Shipping to</div>
            <div className="text-gray-600 whitespace-pre-line">{order.shipping_address}</div>
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Mark the order as paid?"
          message={`Confirm that you paid ${formatPrice(order.total_price)} to ${seller.name || "the seller"}. They will be notified to check the payment and ship your coins.`}
          confirmLabel="Yes, I've paid"
          pendingLabel="Saving…"
          isPending={paidMutation.isPending}
          onConfirm={() => paidMutation.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </article>
  );
}
