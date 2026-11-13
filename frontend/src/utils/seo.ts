import { company } from "../content/site";

/**
 * The public address of the site, e.g. https://www.example.com (no trailing slash), set at
 * build time (see .env.example). Canonical links and the sitemap need absolute URLs.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");

/** SITE_URL, or the address the request came to when it isn't set (development). */
export function siteOrigin(request: Request): string {
  return SITE_URL || new URL(request.url).origin;
}

interface PageMetaOptions {
  /** Without the site name: it is appended. */
  title: string;
  description: string;
  /** The page's canonical path, e.g. "/browse". */
  path: string;
  image?: string;
  type?: "website" | "product";
}

/** Title, description, canonical link and link-preview (Open Graph) tags of a page. */
export function pageMeta({ title, description, path, image, type = "website" }: PageMetaOptions) {
  const fullTitle = `${title} | ${company.name}`;
  const url = SITE_URL ? `${SITE_URL}${path}` : undefined;
  return [
    { title: fullTitle },
    { name: "description", content: description },
    ...(url ? [{ tagName: "link", rel: "canonical", href: url }, { property: "og:url", content: url }] : []),
    { property: "og:site_name", content: company.name },
    { property: "og:type", content: type },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
}

/** For pages that must not appear in search results (errors). */
export function notFoundMeta() {
  return [{ title: `Page not found | ${company.name}` }, { name: "robots", content: "noindex" }];
}
