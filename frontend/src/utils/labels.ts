/** Mirrors the API limits (app/schemas/fields.py). */
export const MAX_LABELS = 5;
export const MAX_LABEL_LENGTH = 30;

/** Collapses whitespace and drops blanks and case-insensitive duplicates, like the API does. */
export function cleanLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().replace(/\s+/g, " ");
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      cleaned.push(label);
    }
  }
  return cleaned;
}

/** "Proof, Low mintage; Gift" -> ["Proof", "Low mintage", "Gift"] */
export function splitLabels(text: string): string[] {
  return cleanLabels(text.split(/[,;\n|]+/));
}
