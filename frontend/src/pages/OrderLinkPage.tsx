import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOrderByLink } from "../api/orders";
import { PurchaseCard } from "./PurchasesPage";

/** An order opened from its own link (emails of guest orders): no account needed. */
export function OrderLinkPage() {
  const orderId = Number(useParams().orderId);
  const token = useSearchParams()[0].get("token") ?? "";

  const { data: order, isError } = useQuery({
    queryKey: ["order", orderId, token],
    queryFn: () => getOrderByLink(orderId, token),
    enabled: Number.isInteger(orderId) && token !== "",
    retry: false,
  });

  if (isError || !token) {
    return (
      <p className="text-gray-600">
        This order link is invalid. Please use the link from your order email, or{" "}
        <Link to="/contact" className="text-accent font-semibold hover:underline">
          contact us
        </Link>
        .
      </p>
    );
  }
  if (!order) return <p>Loading...</p>;

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <PurchaseCard order={order} linkToken={token} />
      <p className="text-sm text-gray-500">
        To see all your orders in one place,{" "}
        <Link to="/forgot-password" className="text-accent font-semibold hover:underline">
          set a password
        </Link>{" "}
        for the email address you ordered with, then open My purchases.
      </p>
    </div>
  );
}
