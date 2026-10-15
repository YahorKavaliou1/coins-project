import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Pencil, Plus, RotateCcw } from "lucide-react";
import { listMyLots, relistCoins, withdrawCoins } from "../api/coins";
import { getErrorMessage, type ApiError } from "../api/client";
import { EditCoinModal } from "../components/EditCoinModal";
import { Pagination } from "../components/Pagination";
import { toast } from "../store/toastStore";
import type { CoinStatus, MyLot } from "../types";
import { formatUtcDate, formatUtcDateTime } from "../utils/dates";
import { formatPrice } from "../utils/money";

const PAGE_SIZE = 20;

const TABS: { status: CoinStatus; label: string; empty: string }[] = [
  { status: "for_sale", label: "For sale", empty: "You have no lots on sale." },
  { status: "withdrawn", label: "Withdrawn", empty: "No lots withdrawn from sale." },
  { status: "sold", label: "Sold", empty: "Nothing sold yet." },
];

function isTab(value: string | null): value is CoinStatus {
  return TABS.some((t) => t.status === value);
}

/** "Albania 1935 1 Qindar" -> "1 Qindar", as on the coin page; the country and year are shown above it. */
function lotTitle(lot: MyLot): string {
  const prefix = `${lot.country.name} ${lot.year} `;
  return lot.name.startsWith(prefix) ? lot.name.slice(prefix.length) : lot.name;
}

export function MyLotsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const status: CoinStatus = isTab(tabParam) ? tabParam : "for_sale";

  const [page, setPage] = useState({ status, number: 1 });
  const pageNumber = page.status === status ? page.number : 1;
  // Selection is per tab and page: switching either clears it.
  const [selection, setSelection] = useState({ key: "", ids: [] as number[] });
  const selectionKey = `${status}:${pageNumber}`;
  const selectedIds = selection.key === selectionKey ? selection.ids : [];
  const [editingLot, setEditingLot] = useState<MyLot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-lots", status, pageNumber],
    queryFn: () => listMyLots(status, pageNumber, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const lots = data?.items ?? [];
  const pageCount = data ? Math.ceil(data.total / data.page_size) : 0;

  function setSelected(ids: number[]) {
    setSelection({ key: selectionKey, ids });
  }

  function toggle(id: number) {
    setSelected(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const statusMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: "withdraw" | "relist" }) =>
      action === "withdraw" ? withdrawCoins(ids) : relistCoins(ids),
    onSuccess: (changed, { ids, action }) => {
      const verb = action === "withdraw" ? "withdrawn from sale" : "returned to sale";
      const count = `${changed.length} ${changed.length === 1 ? "lot" : "lots"}`;
      if (changed.length === ids.length) toast.success(`${count} ${verb}.`);
      // E.g. a coin bought between loading the page and clicking.
      else toast.error(`${count} ${verb}; ${ids.length - changed.length} could not be changed (sold meanwhile?).`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["my-lots"] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      queryClient.invalidateQueries({ queryKey: ["coin-facets"] });
      queryClient.invalidateQueries({ queryKey: ["coin"] });
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  const selectable = status !== "sold";
  const action = status === "for_sale" ? "withdraw" : "relist";
  const allSelected = lots.length > 0 && selectedIds.length === lots.length;

  function goToPage(number: number) {
    setPage({ status, number });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold">My lots</h1>
        <button
          type="button"
          onClick={() => navigate("/sell")}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-sm px-3 py-2"
        >
          <Plus className="w-4 h-4" />
          List a coin
        </button>
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-4 max-sm:gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setSearchParams(tab.status === "for_sale" ? {} : { tab: tab.status })}
            className={`-mb-px pb-2.5 text-sm font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-colors ${
              status === tab.status ? "text-gray-900 border-accent" : "text-gray-400 border-transparent hover:text-gray-700"
            }`}
          >
            {tab.label}
            {data && <span className="ml-1.5 text-xs font-semibold text-gray-400">{data.counts[tab.status]}</span>}
          </button>
        ))}
      </div>

      {selectable && lots.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-md px-4 py-2.5 mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : lots.map((l) => l.id))}
              className="accent-accent w-4 h-4"
            />
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all on page"}
          </label>
          <button
            type="button"
            disabled={selectedIds.length === 0 || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ ids: selectedIds, action })}
            className="ml-auto flex items-center gap-1.5 border border-accent text-accent hover:bg-accent hover:text-white text-xs font-bold uppercase tracking-wide rounded-sm px-3 py-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {action === "withdraw" ? <EyeOff className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            {action === "withdraw" ? "Withdraw from sale" : "Return to sale"}
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && lots.length === 0 && (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-md p-6 text-center">
          {TABS.find((t) => t.status === status)!.empty}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {lots.map((lot) => (
          <LotRow
            key={lot.id}
            lot={lot}
            selectable={selectable}
            selected={selectedIds.includes(lot.id)}
            onToggle={() => toggle(lot.id)}
            onEdit={() => setEditingLot(lot)}
            onChangeStatus={() => statusMutation.mutate({ ids: [lot.id], action })}
            busy={statusMutation.isPending}
          />
        ))}
      </div>

      <Pagination page={pageNumber} pageCount={pageCount} onChange={goToPage} />

      {editingLot && (
        <EditCoinModal
          coin={editingLot}
          onClose={() => setEditingLot(null)}
          onSaved={() => {
            setEditingLot(null);
            queryClient.invalidateQueries({ queryKey: ["my-lots"] });
            toast.success("Lot updated.");
          }}
        />
      )}
    </div>
  );
}

interface LotRowProps {
  lot: MyLot;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChangeStatus: () => void;
  busy: boolean;
}

function LotRow({ lot, selectable, selected, onToggle, onEdit, onChangeStatus, busy }: LotRowProps) {
  const image = lot.images[0];
  const details = [lot.sku && `SKU ${lot.sku}`, lot.grade, lot.catalog_number].filter(Boolean).join(" · ");

  return (
    <div
      className={`bg-white border rounded-md p-3 flex gap-3 items-start max-sm:flex-wrap ${
        selected ? "border-accent bg-accent/5" : "border-gray-200"
      }`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${lot.name}`}
          className="accent-accent w-4 h-4 mt-1 shrink-0"
        />
      )}

      <Link to={`/coins/${lot.id}`} className="w-16 h-16 shrink-0 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
        {image ? (
          <img src={image.url} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="text-[10px] text-gray-400">No image</span>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="text-accent text-xs font-semibold uppercase">
          {lot.country.name} · {lot.year}
        </div>
        <Link to={`/coins/${lot.id}`} className="font-bold text-sm leading-snug hover:text-accent">
          {lotTitle(lot)}
        </Link>
        {details && <div className="text-xs text-gray-400 mt-0.5">{details}</div>}
        {lot.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {lot.labels.map((label) => (
              <span key={label} className="bg-accent/10 text-accent-dark text-[10px] font-medium rounded-full px-2 py-0.5">
                {label}
              </span>
            ))}
          </div>
        )}
        {lot.sale && <SaleDetails lot={lot} />}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0 max-sm:flex-row max-sm:items-center max-sm:w-full max-sm:justify-between max-sm:pl-7">
        <div className="text-right max-sm:text-left">
          {lot.sale ? (
            <div className="font-bold text-sm">{formatPrice(lot.sale.price_paid)}</div>
          ) : (
            lot.price !== null && <div className="font-bold text-sm">{formatPrice(lot.price)}</div>
          )}
          <div className="text-[11px] text-gray-400">Listed {formatUtcDate(lot.created_at)}</div>
        </div>

        {lot.status !== "sold" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onChangeStatus}
              disabled={busy}
              title={lot.status === "for_sale" ? "Withdraw from sale" : "Return to sale"}
              className="border border-gray-300 text-gray-500 hover:border-accent hover:text-accent rounded-sm p-1.5 transition-colors disabled:opacity-40"
            >
              {lot.status === "for_sale" ? <EyeOff className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 border border-accent text-accent hover:bg-accent hover:text-white text-xs font-bold uppercase rounded-sm px-2.5 py-1.5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SaleDetails({ lot }: { lot: MyLot }) {
  const sale = lot.sale!;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs bg-gray-50 border border-gray-100 rounded-sm p-2.5">
      <dt className="text-gray-400">Sold</dt>
      <dd className="text-gray-700">{formatUtcDateTime(sale.sold_at)}</dd>
      <dt className="text-gray-400">Order</dt>
      <dd className="text-gray-700">#{sale.order_id}</dd>
      <dt className="text-gray-400">Price paid</dt>
      <dd className="text-gray-700">{formatPrice(sale.price_paid)}</dd>
      <dt className="text-gray-400">Buyer</dt>
      <dd className="text-gray-700">{sale.buyer_name || "—"}</dd>
      <dt className="text-gray-400">Ship to</dt>
      <dd className="text-gray-700 whitespace-pre-line">{sale.shipping_address}</dd>
    </dl>
  );
}
