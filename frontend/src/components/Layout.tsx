import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, UserCircle, ChevronDown } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/cart";
import { Toaster } from "./Toaster";
import { Footer } from "./Footer";
import { mainNav } from "./navigation";
import { canSell, isAdmin } from "../utils/roles";
import { formatUtcDate } from "../utils/dates";

export function Layout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.currentUser);
  const navigate = useNavigate();
  useCurrentUser();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: cart } = useQuery({
    queryKey: ["cart", accessToken],
    queryFn: getCart,
    enabled: !!accessToken,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(path: string) {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-6 max-md:flex-wrap max-md:px-4 max-md:py-3 max-md:gap-x-3 max-md:gap-y-2">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold text-gray-900 whitespace-nowrap hover:text-accent max-md:text-base max-md:gap-2">
            <img src="/logo.png" alt="" width={36} height={36} className="w-9 h-9 rounded-sm max-md:w-8 max-md:h-8" />
            Coins Catalog
          </Link>

          {/* Below md the sections drop to their own row under the logo and the account controls. */}
          <nav className="flex gap-6 flex-1 justify-center max-md:order-last max-md:basis-full max-md:justify-start max-md:gap-5">
            {mainNav.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `text-sm font-medium uppercase tracking-wide pb-1 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-accent border-accent"
                      : "text-gray-700 border-transparent hover:text-accent"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm whitespace-nowrap max-md:gap-3">
            {accessToken && (
              <NavLink
                to="/cart"
                title="Open cart"
                className={({ isActive }) =>
                  `relative p-2 border rounded-sm transition-colors ${
                    isActive
                      ? "border-accent text-accent"
                      : "border-gray-300 text-gray-700 hover:border-accent hover:text-accent"
                  }`
                }
              >
                <ShoppingCart className="w-5 h-5" />
                {!!cart?.items.length && (
                  <span className="absolute -top-2 -right-2 bg-accent text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                    {cart.items.length}
                  </span>
                )}
              </NavLink>
            )}

            {accessToken ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-1 text-gray-700 hover:text-accent transition-colors uppercase text-sm font-medium tracking-wide"
                >
                  <UserCircle className="w-6 h-6" />
                  <ChevronDown className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 shadow-lg py-1 z-50 flex flex-col">
                    {currentUser && (
                      <div className="px-4 py-2 border-b border-gray-200 mb-1">
                        <div className="text-xs text-gray-500 truncate">{currentUser.email}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-accent mt-0.5">
                          {currentUser.role}
                        </div>
                        <div
                          className="text-[10px] text-gray-400 mt-0.5"
                          title={`Account created ${currentUser.created_at}`}
                        >
                          Member since {formatUtcDate(currentUser.created_at)} (UTC)
                        </div>
                      </div>
                    )}
                    {canSell(currentUser) && (
                      <button
                        type="button"
                        onClick={() => goTo("/sell")}
                        className="block w-full text-left px-4 py-2 text-sm uppercase tracking-wide text-gray-700 hover:text-accent hover:bg-gray-50"
                      >
                        Sell
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => goTo("/purchases")}
                      className="block w-full text-left px-4 py-2 text-sm uppercase tracking-wide text-gray-700 hover:text-accent hover:bg-gray-50"
                    >
                      My purchases
                    </button>
                    {isAdmin(currentUser) && (
                      <button
                        type="button"
                        onClick={() => goTo("/admin/users")}
                        className="block w-full text-left px-4 py-2 text-sm uppercase tracking-wide text-gray-700 hover:text-accent hover:bg-gray-50"
                      >
                        Users
                      </button>
                    )}
                    <div className="border-t border-gray-200 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm uppercase tracking-wide text-red-600 hover:bg-gray-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 max-md:gap-2">
                <button
                  onClick={() => navigate("/auth")}
                  className="text-sm font-medium uppercase tracking-wide text-gray-700 underline underline-offset-2 hover:text-accent"
                >
                  Login
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => navigate("/auth?mode=register")}
                  className="text-sm font-medium uppercase tracking-wide text-gray-700 underline underline-offset-2 hover:text-accent"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-6xl mx-auto p-5 pt-24 max-md:px-4 max-md:pt-28">
        <main>
          <Outlet />
        </main>
      </div>

      <Footer />

      <Toaster />
    </div>
  );
}
