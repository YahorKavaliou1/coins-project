import { useQuery } from "@tanstack/react-query";
import { getCoinFacets } from "../api/coins";

/** Pass as `list` on the category input. Render <CategoryDatalist /> once per page. */
export const CATEGORY_DATALIST_ID = "coin-categories";

/**
 * Suggests the categories already in use, so sellers pick an existing one ("Bullion")
 * instead of creating near-duplicates ("bullion", "Bullion coins") that split the shop filter.
 */
export function CategoryDatalist() {
  // Under "coin-facets", so it refreshes whenever coins are created, edited or deleted.
  const { data } = useQuery({
    queryKey: ["coin-facets", "all-categories"],
    queryFn: () => getCoinFacets(),
  });
  return (
    <datalist id={CATEGORY_DATALIST_ID}>
      {(data?.categories ?? []).map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}
