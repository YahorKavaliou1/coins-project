import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SellPage } from "./pages/SellPage";
import { MyLotsPage } from "./pages/MyLotsPage";
import { SalesPage } from "./pages/SalesPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { BrowsePage } from "./pages/BrowsePage";
import { CoinDetailPage } from "./pages/CoinDetailPage";
import { CartPage } from "./pages/CartPage";
import { HomePage } from "./pages/HomePage";
import { ContactPage } from "./pages/ContactPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminUserDetailPage } from "./pages/AdminUserDetailPage";
import { RequireRole } from "./components/RequireRole";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/sell"
              element={
                <RequireRole roles={["seller", "admin"]}>
                  <SellPage />
                </RequireRole>
              }
            />
            <Route
              path="/my-lots"
              element={
                <RequireRole roles={["seller", "admin"]}>
                  <MyLotsPage />
                </RequireRole>
              }
            />
            <Route
              path="/sales"
              element={
                <RequireRole roles={["seller", "admin"]}>
                  <SalesPage />
                </RequireRole>
              }
            />
            <Route
              path="/account"
              element={
                <RequireRole roles={["user", "seller", "admin"]}>
                  <AccountPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminOrdersPage />
                </RequireRole>
              }
            />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/coins/:id" element={<CoinDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route
              path="/admin/users"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminUserDetailPage />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
