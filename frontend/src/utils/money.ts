/** All prices on the site are in euros: 12.5 -> "€12.50". */
export function formatPrice(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
