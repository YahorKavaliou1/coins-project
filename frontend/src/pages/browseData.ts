import { getCoinFacets, listCoins } from "../api/coins";
import { listCountries } from "../api/reference";
import type { CoinFacets, CoinPage, Country } from "../types";

// Divisible by 2 and 3, so the last row of the grid is full on both phone and desktop.
export const PAGE_SIZE = 24;

export interface BrowseInitialData {
  countries: Country[];
  facets: CoinFacets;
  page: CoinPage;
}

/**
 * The shop as it first opens (no filters, newest first, page 1), loaded on the server
 * (routes/browse.tsx). Must request the same as the queries in BrowsePage.
 */
export async function loadBrowseInitialData(): Promise<BrowseInitialData> {
  const [countries, facets, page] = await Promise.all([
    listCountries(),
    getCoinFacets({ for_sale_only: true, metal_id: [] }),
    listCoins({ for_sale_only: true, metal_id: [], sort: "recent", page: 1, page_size: PAGE_SIZE }),
  ]);
  return { countries, facets, page };
}
