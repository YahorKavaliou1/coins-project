import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";
import { legalDocuments } from "./content/legal";

export default [
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("browse", "routes/browse.tsx"),
    route("coins/:coinSlug", "routes/coin.tsx"),
    route("contact", "routes/contact.tsx"),
    ...legalDocuments.map((doc) => route(doc.path.slice(1), "routes/legal.tsx", { id: `legal${doc.path}` })),
    route("auth", "routes/auth.tsx"),
    route("verify-email", "routes/verify-email.tsx"),
    route("forgot-password", "routes/forgot-password.tsx"),
    route("reset-password", "routes/reset-password.tsx"),
    route("cart", "routes/cart.tsx"),
    route("purchases", "routes/purchases.tsx"),
    route("account", "routes/account.tsx"),
    route("sell", "routes/sell.tsx"),
    route("my-lots", "routes/my-lots.tsx"),
    route("sales", "routes/sales.tsx"),
    route("admin/orders", "routes/admin-orders.tsx"),
    route("admin/users", "routes/admin-users.tsx"),
    route("admin/users/:id", "routes/admin-user-detail.tsx"),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
