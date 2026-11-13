import { HomePage } from "../pages/HomePage";
import { listLatestCoins } from "../api/coins";
import { company, home } from "../content/site";
import { pageMeta } from "../utils/seo";
import type { Route } from "./+types/home";

export async function loader() {
  return { latest: await listLatestCoins() };
}

export function meta() {
  return pageMeta({ title: company.tagline, description: home.hero.text, path: "/" });
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  return <HomePage initialLatest={loaderData.latest} />;
}
