import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { getSellerSettings } from "../api/account";

/**
 * Shows `children` (the listing forms) only once the seller has payment details: the API
 * refuses to put coins on sale before (buyers receive the details with every order).
 */
export function PaymentDetailsGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ["seller-settings"], queryFn: getSellerSettings });
  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data && !data.payment_details) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 max-sm:p-6 max-w-xl text-center mx-auto">
        <CreditCard className="w-10 h-10 text-accent mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-2">Add your payment details first</h2>
        <p className="text-sm text-gray-600 mb-5">
          Buyers receive them by email with every order to pay you, so they are needed before you list coins for sale.
          You can also add your contacts and shipping options there.
        </p>
        <Link
          to="/account"
          className="inline-block bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3"
        >
          Go to Account settings
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
