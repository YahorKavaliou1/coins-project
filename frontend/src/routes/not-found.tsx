import { data } from "react-router";
import { NotFound } from "../components/NotFound";
import { notFoundMeta } from "../utils/seo";

// Unknown addresses answer 404, so search engines drop them instead of indexing an empty page.
export function loader() {
  throw data(null, { status: 404 });
}

export function meta() {
  return notFoundMeta();
}

export default NotFound;

export function ErrorBoundary() {
  return <NotFound />;
}
