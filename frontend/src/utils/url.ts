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
