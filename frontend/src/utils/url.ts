/** Mirrors the server check (app/schemas/fields.py): only plain http(s) addresses. */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname && !/\s/.test(value);
  } catch {
    return false;
  }
}

/** "https://www.numista.com/catalogue/..." -> "numista.com" */
export function displayHost(value: string): string {
  return new URL(value).hostname.replace(/^www\./, "");
}

/**
 * Where to go after logging in (`?next=` of the login page): only a path on this site, so a
 * crafted link can't send the user elsewhere ("//evil.com" and "https://..." are refused).
 */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/browse";
}

/** The login page, coming back to `path` afterwards. */
export function loginPath(path: string): string {
  return `/auth?next=${encodeURIComponent(path)}`;
}

/** "Austria 2024 Gold (1 oz) "Philharmonic"" -> "austria-2024-gold-1-oz-philharmonic" */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: "Česko" -> "cesko"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

/**
 * The canonical address of a coin's page: its id, then its name for search engines and people
 * ("/coins/12-austria-2024-gold-1-oz-philharmonic"). Only the id is used to find the coin;
 * any other form of the address redirects here (routes/coin.tsx).
 */
export function coinPath(coin: { id: number; name: string }): string {
  const slug = slugify(coin.name);
  return slug ? `/coins/${coin.id}-${slug}` : `/coins/${coin.id}`;
}
