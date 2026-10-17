import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSellerSettings } from "../api/account";

/** Reminds a seller without payment details that buyers won't know how to pay them. */
export function PaymentDetailsNotice() {
  const { data } = useQuery({ queryKey: ["seller-settings"], queryFn: getSellerSettings });
  if (!data || data.payment_details) return null;
  return (
    <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-sm p-3 mb-4">
      Add your payment details to list coins for sale or return them to sale: buyers receive them with every order.{" "}
      <Link to="/account" className="font-semibold underline">
        Add them in Account settings
      </Link>
      .
    </p>
  );
}
