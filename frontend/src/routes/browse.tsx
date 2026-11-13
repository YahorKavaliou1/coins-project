import { BrowsePage } from "../pages/BrowsePage";
import { loadBrowseInitialData } from "../pages/browseData";
import { pageMeta } from "../utils/seo";
import type { Route } from "./+types/browse";

export function loader() {
  return loadBrowseInitialData();
}

export function meta() {
  return pageMeta({
    title: "Shop collector coins and bullion",
    description:
      "Buy gold and silver bullion, ancient and modern collector coins. Every coin is inspected " +
      "by hand and photographed as it is. Filter by country, metal, grade and category.",
    path: "/browse",
  });
}

export default function BrowseRoute({ loaderData }: Route.ComponentProps) {
  return <BrowsePage initial={loaderData} />;
}
