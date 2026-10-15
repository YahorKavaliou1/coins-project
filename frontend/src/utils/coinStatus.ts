import type { CoinStatus } from "../types";

/** Why a coin can't be bought, for badges: "Sold" or "Not for sale" (withdrawn by its seller). */
export function unavailableLabel(status: CoinStatus): string {
  return status === "sold" ? "Sold" : "Not for sale";
}
