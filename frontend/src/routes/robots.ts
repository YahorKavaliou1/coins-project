import { siteOrigin } from "../utils/seo";
import type { Route } from "./+types/robots";

// Account, checkout and admin pages have nothing for search engines.
const PRIVATE_PATHS = [
  "/auth",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/cart",
  "/purchases",
  "/order/",
  "/account",
  "/sell",
  "/my-lots",
  "/sales",
  "/admin",
];

export function loader({ request }: Route.LoaderArgs) {
  const lines = [
    "User-agent: *",
    ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${siteOrigin(request)}/sitemap.xml`,
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
