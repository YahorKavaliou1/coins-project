/** Formats an ISO timestamp as a UTC date, e.g. "30 Sep 2026". */
export function formatUtcDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO timestamp as a UTC date and time, e.g. "30 Sep 2026, 17:34 UTC". */
export function formatUtcDateTime(iso: string): string {
  const formatted = new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatted} UTC`;
}
