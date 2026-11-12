import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LegalDocument } from "../content/legal";

/** Renders "[text](href)" as links: internal paths with the router, others as plain anchors. */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const className = "text-accent hover:underline break-words";
    parts.push(
      href.startsWith("/") ? (
        <Link key={index} to={href} className={className}>
          {label}
        </Link>
      ) : (
        <a
          key={index}
          href={href}
          className={className}
          {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>
      )
    );
    last = index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
  // Opened from the footer: start at the top, not at the old scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${doc.title} · Coins Catalog`;
    return () => {
      document.title = "Coins Catalog";
    };
  }, [doc]);

  return (
    <article className="max-w-3xl pb-10">
      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Legal</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{doc.title}</h1>
        <p className="text-sm text-gray-500">{doc.subtitle}</p>
      </header>

      <div className="flex flex-col gap-8">
        {doc.sections.map((section, i) => (
          <section key={section.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900 mb-3">
              {i + 1}. {section.title}
            </h2>
            <div className="flex flex-col gap-3 text-sm text-gray-700 leading-relaxed">
              {section.blocks.map((block, j) =>
                Array.isArray(block) ? (
                  <ul key={j} className="list-disc pl-5 flex flex-col gap-1.5 marker:text-gray-400">
                    {block.map((item, k) => (
                      <li key={k}>{renderInline(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={j}>{renderInline(block)}</p>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
