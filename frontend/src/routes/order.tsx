import { OrderLinkPage } from "../pages/OrderLinkPage";

// The link carries a secret token: keep the page out of search engines.
export function meta() {
  return [{ title: "Your order" }, { name: "robots", content: "noindex" }];
}

export default OrderLinkPage;
