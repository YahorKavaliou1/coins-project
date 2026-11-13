import { listSitemapCoins } from "../api/coins";
import { legalDocuments } from "../content/legal";
import { coinPath } from "../utils/url";
import { siteOrigin } from "../utils/seo";
import type { Route } from "./+types/sitemap";

/** The public pages for search engines: the main ones and every coin on sale. */
export async function loader({ request }: Route.LoaderArgs) {
  const origin = siteOrigin(request);
  const coins = await listSitemapCoins();
  const paths = ["/", "/browse", "/contact", ...legalDocuments.map((doc) => doc.path), ...coins.map(coinPath)];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(xml + "\n", {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
