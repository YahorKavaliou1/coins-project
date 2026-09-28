import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, UserCircle } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/cart";

const tabs = [
  { to: "/reference", label: "Reference data" },
  { to: "/sell", label: "Sell" },
  { to: "/browse", label: "Browse" },
  { to: "/purchases", label: "My purchases" },
];

export function Layout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  useCurrentUser();

  const { data: cart } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });

  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white shadow-md">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold whitespace-nowrap">Coins Catalog</h1>

          <nav className="flex gap-2 flex-1 justify-center">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                    isActive ? "bg-brand text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            {accessToken && (
              <NavLink
                to="/cart"
                title="Open cart"
                className={({ isActive }) =>
                  `relative p-2 rounded-full transition-colors ${
                    isActive ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-200"
                  }`
                }
              >
                <ShoppingCart className="w-5 h-5" />
                {!!cart?.items.length && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                    {cart.items.length}
                  </span>
                )}
              </NavLink>
            )}

            {accessToken ? (
              <>
                <UserCircle className="w-6 h-6 text-gray-600" />
                <button onClick={logout} className="text-red-600 underline">
                  Log out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate("/auth")} className="text-gray-700 underline">
                  Register
                </button>
                <button onClick={() => navigate("/auth")} className="bg-brand text-white rounded px-3 py-1.5">
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-5 pt-20">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
