import { useLocation } from "react-router";
import { LegalPage } from "../pages/LegalPage";
import { legalDocuments } from "../content/legal";
import { pageMeta } from "../utils/seo";
import type { Route } from "./+types/legal";

// One module for all legal pages (routes.ts): the address tells which document it is.
function documentAt(pathname: string) {
  return legalDocuments.find((doc) => doc.path === pathname) ?? legalDocuments[0];
}

export function meta({ location }: Route.MetaArgs) {
  const doc = documentAt(location.pathname);
  return pageMeta({ title: doc.title, description: doc.subtitle, path: doc.path });
}

export default function LegalRoute() {
  const doc = documentAt(useLocation().pathname);
  return <LegalPage doc={doc} />;
}
