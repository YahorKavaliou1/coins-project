import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "../api/orders";
import { useAuthStore } from "../store/authStore";
import { OrderCard } from "../components/OrderCard";

export function PurchasesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: listMyOrders,
    enabled: !!accessToken,
  });

  if (!accessToken) return <p>Please log in to view your purchases.</p>;
  if (orders && orders.length === 0) return <p>No purchases yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {orders?.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
