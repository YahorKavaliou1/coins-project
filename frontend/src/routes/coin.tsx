import { data, isRouteErrorResponse, redirect } from "react-router";
import { isAxiosError } from "axios";
import { getCoin } from "../api/coins";
import { apiClient } from "../api/client";
import { CoinDetailPage } from "../pages/CoinDetailPage";
import { NotFound } from "../components/NotFound";
import { coinPath } from "../utils/url";
import { formatPrice } from "../utils/money";
import { notFoundMeta, pageMeta } from "../utils/seo";
import type { Coin } from "../types";
import type { Route } from "./+types/coin";

export async function loader({ params }: Route.LoaderArgs) {
  // "12-austria-2024-gold-1-oz" (or an old "12"): only the id counts.
  const id = /^(\d{1,9})(?:-|$)/.exec(params.coinSlug)?.[1];
  if (!id) throw data(null, { status: 404 });

  let coin: Coin;
  try {
    coin = await getCoin(Number(id));
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) throw data(null, { status: 404 });
    throw err;
  }

  // One address per coin: links without the name (or with an outdated one) move here for good.
  const canonical = coinPath(coin);
  if (`/coins/${params.coinSlug}` !== canonical) throw redirect(canonical, 301);
  return { coin };
}

/** Photos stored by the API itself (development) have relative URLs, served next to the API. */
function absoluteUrl(url: string): string {
  const base = apiClient.defaults.baseURL || (typeof window === "undefined" ? undefined : window.location.origin);
  return new URL(url, base).href;
}

function description(coin: Coin): string {
  const facts = [
    coin.denomination,
    coin.metal.name + (coin.composition ? ` (${coin.composition})` : ""),
    `${coin.weight} ${coin.weight_unit}`,
    coin.grade && `grade ${coin.grade}`,
    coin.catalog_number,
  ].filter(Boolean);
  const offer = coin.is_for_sale && coin.price !== null ? `Buy for ${formatPrice(coin.price)}.` : "No longer available.";
  return `${coin.name}: ${coin.country.name}, ${coin.year}, ${facts.join(", ")}. ${offer} Photos of the actual coin, authenticity guaranteed.`;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return notFoundMeta();
  const { coin } = loaderData;
  const photo = coin.images[0]?.url;
  // Withdrawn by its seller (and possibly deleted later): kept out of search results. Sold
  // coins stay indexed, marked unavailable, so their page keeps its links.
  const robots = coin.status === "withdrawn" ? [{ name: "robots", content: "noindex" }] : [];
  return [
    ...pageMeta({
      title: coin.is_for_sale && coin.price !== null ? `${coin.name} – ${formatPrice(coin.price)}` : coin.name,
      description: description(coin),
      path: coinPath(coin),
      image: photo && absoluteUrl(photo),
      type: "product",
    }),
    ...robots,
  ];
}

export default function CoinRoute({ loaderData }: Route.ComponentProps) {
  return <CoinDetailPage key={loaderData.coin.id} initialCoin={loaderData.coin} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return <p>Something went wrong. Please try again in a moment.</p>;
}
