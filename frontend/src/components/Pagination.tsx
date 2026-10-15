import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

/** Page numbers to show: first, last and the current one with its neighbours; null is a gap. */
function pageItems(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    // A gap of one page is shown as that page rather than as "…".
    if (prev !== undefined && p - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) items.push(null);
    items.push(p);
  });
  return items;
}

const buttonClass =
  "min-w-9 h-9 px-2 flex items-center justify-center rounded-sm border text-sm font-semibold transition-colors";

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const arrowClass = `${buttonClass} bg-white text-gray-700 border-gray-300 hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none`;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        title="Previous page"
        className={arrowClass}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageItems(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${buttonClass} ${
              p === page
                ? "bg-brand text-white border-brand"
                : "bg-white text-gray-700 border-gray-300 hover:border-accent hover:text-accent"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        title="Next page"
        className={arrowClass}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
