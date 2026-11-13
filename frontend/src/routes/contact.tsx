import { ContactPage } from "../pages/ContactPage";
import { contact } from "../content/site";
import { pageMeta } from "../utils/seo";

export function meta() {
  return pageMeta({ title: "Contact us", description: contact.intro, path: "/contact" });
}

export default ContactPage;
