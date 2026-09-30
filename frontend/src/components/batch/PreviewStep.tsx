import { useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  WEIGHT_UNITS,
  splitPhotoNames,
  type DraftRow,
  type DraftValues,
  type PhotoIndex,
  type RowErrors,
} from "../../utils/batchImport";
import type { Country, Metal } from "../../types";

const PAGE_SIZE = 50;

const cellInputClass =
  "bg-transparent border border-transparent rounded-sm px-2 py-1 text-sm hover:border-gray-300 focus:outline-none focus:border-accent focus:bg-white";
const errorCellClass = "!border-red-400 bg-red-50";

type TextColumn = { key: keyof DraftValues; label: string; width: string; numeric?: boolean };

const TEXT_COLUMNS_BEFORE_METAL: TextColumn[] = [
  { key: "year", label: "Year", width: "w-20", numeric: true },
  { key: "denomination", label: "Denomination", width: "w-32" },
];
const TEXT_COLUMNS_AFTER_METAL: TextColumn[] = [
  { key: "composition", label: "Composition", width: "w-32" },
  { key: "weight", label: "Weight", width: "w-20", numeric: true },
];
const TEXT_COLUMNS_TAIL: TextColumn[] = [
  { key: "diameter", label: "Diam. mm", width: "w-20", numeric: true },
  { key: "grade", label: "Grade", width: "w-24" },
  { key: "catalog_number", label: "Catalog No.", width: "w-28" },
  { key: "mintage", label: "Mintage", width: "w-24", numeric: true },
  { key: "extra_info", label: "Extra info", width: "w-40" },
  { key: "price", label: "Price $", width: "w-24", numeric: true },
];

interface PreviewStepProps {
  rows: DraftRow[];
  errors: Map<number, RowErrors>;
  countries: Country[];
  metals: Metal[];
  photoIndex: PhotoIndex;
  photoUrls: Map<File, string>;
  onRowChange: (row: DraftRow) => void;
  onRowDelete: (id: number) => void;
  onBack: () => void;
  onPublish: () => void;
}

export function PreviewStep({
  rows,
  errors,
  countries,
  metals,
  photoIndex,
  photoUrls,
  onRowChange,
  onRowDelete,
  onBack,
  onPublish,
}: PreviewStepProps) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [page, setPage] = useState(0);

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    [countries]
  );
  const sortedMetals = useMemo(() => [...metals].sort((a, b) => a.name.localeCompare(b.name)), [metals]);

  const rowsWithErrors = rows.filter((row) => Object.keys(errors.get(row.id) ?? {}).length > 0);
  const visible = onlyErrors ? rowsWithErrors : rows;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const setValue = (row: DraftRow, key: keyof DraftValues, value: string) =>
    onRowChange({ ...row, values: { ...row.values, [key]: value } });

  const renderTextCell = (row: DraftRow, rowErrors: RowErrors, column: TextColumn) => {
    const error = rowErrors[column.key];
    return (
      <td key={column.key} className="px-1 py-1 align-top">
        <input
          value={row.values[column.key]}
          onChange={(e) => setValue(row, column.key, e.target.value)}
          inputMode={column.numeric ? "decimal" : undefined}
          title={error}
          className={`${cellInputClass} ${column.width} ${error ? errorCellClass : ""}`}
        />
      </td>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-md px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to column matching
        </button>
        <div className="text-sm">
          <span className="font-bold">{rows.length}</span> lots
          {rowsWithErrors.length > 0 ? (
            <span className="text-red-700">
              {" "}
              · <span className="font-bold">{rowsWithErrors.length}</span> with errors
            </span>
          ) : (
            <span className="text-green-700"> · all valid</span>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(e) => {
              setOnlyErrors(e.target.checked);
              setPage(0);
            }}
          />
          Show only rows with errors
        </label>
        <span className="text-xs text-gray-400 ml-auto">Click any cell to edit. Hover a red cell to see the problem.</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
        <table className="text-sm min-w-max">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left">Row</th>
              <th className="px-2 py-2 text-left">Photos</th>
              <th className="px-2 py-2 text-left">Country *</th>
              {TEXT_COLUMNS_BEFORE_METAL.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left">
                  {c.label}
                  {c.key === "year" && " *"}
                </th>
              ))}
              <th className="px-2 py-2 text-left">Metal *</th>
              {TEXT_COLUMNS_AFTER_METAL.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left">
                  {c.label}
                  {c.key === "weight" && " *"}
                </th>
              ))}
              <th className="px-2 py-2 text-left">Unit</th>
              {TEXT_COLUMNS_TAIL.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left">
                  {c.label}
                  {c.key === "price" && " *"}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const rowErrors = errors.get(row.id) ?? {};
              const hasErrors = Object.keys(rowErrors).length > 0;
              const photoNames = splitPhotoNames(row.photos);
              return (
                <tr key={row.id} className={`border-t border-gray-200 ${hasErrors ? "bg-red-50/30" : ""}`}>
                  <td className="sticky left-0 bg-white px-3 py-2 align-top text-gray-400 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {hasErrors && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                      {row.sourceRow}
                    </span>
                  </td>

                  {/* Photos */}
                  <td className="px-1 py-1 align-top">
                    <input
                      value={row.photos}
                      onChange={(e) => onRowChange({ ...row, photos: e.target.value })}
                      placeholder="—"
                      title={rowErrors.photos}
                      className={`${cellInputClass} w-44 ${rowErrors.photos ? errorCellClass : ""}`}
                    />
                    {photoNames.length > 0 && (
                      <div className="flex gap-1 px-2 mt-1">
                        {photoNames.slice(0, 4).map((name) => {
                          const file = photoIndex.get(name.toLowerCase());
                          const url = file && photoUrls.get(file);
                          return url ? (
                            <img
                              key={name}
                              src={url}
                              alt={name}
                              title={name}
                              className="w-8 h-8 object-cover rounded-sm border border-gray-200"
                            />
                          ) : (
                            <span
                              key={name}
                              title={`Not found: ${name}`}
                              className="w-8 h-8 rounded-sm border border-dashed border-red-400 bg-red-50 text-[9px] text-red-600 flex items-center justify-center"
                            >
                              ?
                            </span>
                          );
                        })}
                        {photoNames.length > 4 && (
                          <span className="text-xs text-gray-400 self-center">+{photoNames.length - 4}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Country */}
                  <td className="px-1 py-1 align-top">
                    <select
                      value={row.countryId ?? ""}
                      onChange={(e) =>
                        onRowChange({ ...row, countryId: e.target.value ? Number(e.target.value) : null })
                      }
                      title={rowErrors.country}
                      className={`${cellInputClass} w-40 ${rowErrors.country ? errorCellClass : ""}`}
                    >
                      <option value="">{row.countryText ? `“${row.countryText}” — choose…` : "Choose…"}</option>
                      {sortedCountries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {TEXT_COLUMNS_BEFORE_METAL.map((c) => renderTextCell(row, rowErrors, c))}

                  {/* Metal */}
                  <td className="px-1 py-1 align-top">
                    <select
                      value={row.metalId ?? ""}
                      onChange={(e) =>
                        onRowChange({ ...row, metalId: e.target.value ? Number(e.target.value) : null })
                      }
                      title={rowErrors.metal}
                      className={`${cellInputClass} w-36 ${rowErrors.metal ? errorCellClass : ""}`}
                    >
                      <option value="">{row.metalText ? `“${row.metalText}” — choose…` : "Choose…"}</option>
                      {sortedMetals.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {TEXT_COLUMNS_AFTER_METAL.map((c) => renderTextCell(row, rowErrors, c))}

                  {/* Unit */}
                  <td className="px-1 py-1 align-top">
                    <select
                      value={row.values.weight_unit}
                      onChange={(e) => setValue(row, "weight_unit", e.target.value)}
                      title={rowErrors.weight_unit}
                      className={`${cellInputClass} w-20 ${rowErrors.weight_unit ? errorCellClass : ""}`}
                    >
                      {!WEIGHT_UNITS.includes(row.values.weight_unit as (typeof WEIGHT_UNITS)[number]) && (
                        <option value={row.values.weight_unit}>{row.values.weight_unit || "—"}</option>
                      )}
                      {WEIGHT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>

                  {TEXT_COLUMNS_TAIL.map((c) => renderTextCell(row, rowErrors, c))}

                  <td className="px-2 py-1 align-top">
                    <button
                      type="button"
                      onClick={() => onRowDelete(row.id)}
                      className="p-1.5 text-gray-400 hover:text-red-700"
                      title="Remove this lot from the import"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-gray-400">
                  {onlyErrors ? "No rows with errors." : "No rows left to import."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & publish */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {pageCount > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="p-1 border border-gray-300 rounded-sm disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              Page {currentPage + 1} of {pageCount}
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount - 1}
                className="p-1 border border-gray-300 rounded-sm disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {rowsWithErrors.length > 0 && (
            <span className="text-xs text-red-700">Fix or remove rows with errors to publish.</span>
          )}
          <button
            type="button"
            onClick={onPublish}
            disabled={rows.length === 0 || rowsWithErrors.length > 0}
            className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            OK — publish {rows.length} {rows.length === 1 ? "lot" : "lots"}
          </button>
        </div>
      </div>
    </div>
  );
}
