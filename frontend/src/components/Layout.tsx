import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/cart";

const tabs = [
  { to: "/auth", label: "Auth" },
  { to: "/reference", label: "Reference data" },
  { to: "/sell", label: "Sell" },
  { to: "/browse", label: "Browse" },
  { to: "/cart", label: "Cart" },
  { to: "/purchases", label: "My purchases" },
];

export function Layout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const { data: currentUser } = useCurrentUser();

  const { data: cart } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });

  return (
    <div className="max-w-5xl mx-auto p-5">
      <header className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Coins Catalog</h1>
        <div className="flex items-center gap-3 text-sm">
          {accessToken && (
            <span className="bg-brand text-white px-3 py-1 rounded-full">
              Cart: {cart?.items.length ?? 0}
            </span>
          )}
          <span className="text-gray-500">
            {currentUser ? `Logged in as ${currentUser.email}` : "Not logged in"}
          </span>
          {accessToken && (
            <button onClick={logout} className="text-red-600 underline">
              Log out
            </button>
          )}
        </div>
      </header>

      <nav className="flex gap-2 mb-5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-4 py-2 rounded-md text-sm font-medium ${
                isActive ? "bg-brand text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
