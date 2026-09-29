import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { ReferencePage } from "./pages/ReferencePage";
import { SellPage } from "./pages/SellPage";
import { BrowsePage } from "./pages/BrowsePage";
import { CoinDetailPage } from "./pages/CoinDetailPage";
import { CartPage } from "./pages/CartPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reference" element={<ReferencePage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/coins/:id" element={<CoinDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
