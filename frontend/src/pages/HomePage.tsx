import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { listCoins } from "../api/coins";
import { CoinCard } from "../components/CoinCard";
import { company, home } from "../content/site";

const FEATURE_ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  award: Award,
  truck: Truck,
  rotate: RotateCcw,
};

const sectionTitle = "text-xl font-bold text-gray-900";

export function HomePage() {
  const { data: latest } = useQuery({
    queryKey: ["coins", "home-latest"],
    queryFn: () => listCoins({ sort: "recent", for_sale_only: true, page_size: 4 }),
  });

  return (
    <div className="flex flex-col gap-14 pb-10">
      <Hero />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {home.features.map((feature) => {
          const Icon = FEATURE_ICONS[feature.icon] ?? ShieldCheck;
          return (
            <div key={feature.title} className="bg-white border border-gray-200 rounded-md p-5">
              <Icon className="w-7 h-7 text-accent mb-3" />
              <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.text}</p>
            </div>
          );
        })}
      </section>

      {!!latest?.items.length && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className={sectionTitle}>New in the shop</h2>
            <Link to="/browse" className="text-sm font-semibold text-accent hover:text-accent-dark flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {latest.items.map((coin) => (
              <CoinCard key={coin.id} coin={coin} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={`${sectionTitle} mb-4`}>How it works</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {home.steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="shrink-0 w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md p-6">
          <h2 className={`${sectionTitle} mb-3`}>{home.about.title}</h2>
          {home.about.paragraphs.map((p) => (
            <p key={p} className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">
              {p}
            </p>
          ))}
        </div>
        <div className="bg-brand text-white rounded-md p-6 flex flex-col">
          <h2 className="text-xl font-bold mb-2">{home.sellCta.title}</h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-5">{home.sellCta.text}</p>
          <Link
            to="/contact"
            className="mt-auto text-center bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3"
          >
            {home.sellCta.button}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-md bg-brand text-white">
      <div className="relative z-10 max-w-xl px-8 py-14 sm:px-12 sm:py-16">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-300 mb-3">{home.hero.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">{home.hero.title}</h1>
        <p className="text-gray-300 leading-relaxed mb-8">{home.hero.text}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/browse"
            className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3 flex items-center gap-2"
          >
            {home.hero.primaryCta} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/contact"
            className="border border-gray-400 hover:border-white text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3"
          >
            {home.hero.secondaryCta}
          </Link>
        </div>
      </div>
      {/* Decorative coins, in the site colours. */}
      <div aria-hidden className="hidden md:block absolute inset-y-0 right-0 w-2/5">
        <Coin className="absolute w-64 h-64 right-16 top-10 opacity-90" />
        <Coin className="absolute w-40 h-40 right-72 bottom-8 opacity-60" />
        <Coin className="absolute w-28 h-28 right-6 bottom-6 opacity-40" />
      </div>
      <span className="sr-only">{company.tagline}</span>
    </section>
  );
}

function Coin({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <circle cx="32" cy="32" r="30" fill="#d4a72c" stroke="#7a1f2b" strokeWidth="3" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#9c7a17" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
      <path fill="#7a1f2b" d="M32 18.5l3.9 8.6 9.4 1-7 6.3 2 9.2L32 38.8l-8.3 4.8 2-9.2-7-6.3 9.4-1z" />
    </svg>
  );
}
