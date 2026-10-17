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
