import { useRef } from "react";
import { FileSpreadsheet, FolderOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { inputClass, sectionTitleClass } from "../formStyles";
import { FIELDS, WEIGHT_UNITS, type Mapping, type WeightUnit } from "../../utils/batchImport";
import type { ImportTable } from "../../types";

// React's typings don't know about directory pickers; the attributes are passed through as-is.
const directoryInputAttrs = { webkitdirectory: "", directory: "" } as Record<string, string>;

interface SetupStepProps {
  table: ImportTable | null;
  tableLoading: boolean;
  onTableSelected: (file: File) => void;
  photoFolderName: string | null;
  photoCount: number;
  onPhotoFolderSelected: (files: File[]) => void;
  mapping: Mapping;
  onMappingChange: (mapping: Mapping) => void;
  defaultUnit: WeightUnit;
  onDefaultUnitChange: (unit: WeightUnit) => void;
  onContinue: () => void;
}

function FilePickerCard({
  icon,
  title,
  hint,
  status,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  status: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left border-2 border-dashed border-gray-300 hover:border-accent hover:bg-gray-50 rounded-md p-4 transition-colors"
    >
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-800">{title}</span>
        <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>
        <span className="block mt-2">{status}</span>
      </span>
    </button>
  );
}

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${ok ? "text-green-700" : "text-gray-500"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
      {children}
    </span>
  );
}

export function SetupStep({
  table,
  tableLoading,
  onTableSelected,
  photoFolderName,
  photoCount,
  onPhotoFolderSelected,
  mapping,
  onMappingChange,
  defaultUnit,
  onDefaultUnitChange,
  onContinue,
}: SetupStepProps) {
  const tableInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sample = (columnIndex: number | null) => {
    if (columnIndex === null || !table) return "";
    return table.rows.find((row) => row[columnIndex])?.[columnIndex] ?? "";
  };

  const missingRequired = FIELDS.filter((f) => f.required && mapping[f.key] === null);
  const usedColumns = new Map<number, string>();
  FIELDS.forEach((f) => {
    const index = mapping[f.key];
    if (index !== null) usedColumns.set(index, f.label);
  });

  function setField(key: keyof Mapping, value: string) {
    onMappingChange({ ...mapping, [key]: value === "" ? null : Number(value) });
  }

  function togglePhotoColumn(index: number) {
    const photos = mapping.photos.includes(index)
      ? mapping.photos.filter((i) => i !== index)
      : [...mapping.photos, index].sort((a, b) => a - b);
    onMappingChange({ ...mapping, photos });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Files */}
      <section className="bg-white border border-gray-200 rounded-md p-5">
        <h2 className={sectionTitleClass}>1. Files</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FilePickerCard
            icon={<FileSpreadsheet className="w-6 h-6" />}
            title="Data table"
            hint="CSV or Excel (.xlsx). The first row must contain column names."
            onClick={() => tableInputRef.current?.click()}
            status={
              tableLoading ? (
                <StatusLine ok={false}>Reading…</StatusLine>
              ) : table ? (
                <StatusLine ok>
                  {table.filename} · {table.rows.length} rows · {table.columns.length} columns
                </StatusLine>
              ) : (
                <StatusLine ok={false}>Click to choose a file</StatusLine>
              )
            }
          />
          <FilePickerCard
            icon={<FolderOpen className="w-6 h-6" />}
            title="Photos folder"
            hint="Optional. The table's photo columns reference file names in this folder."
            onClick={() => folderInputRef.current?.click()}
            status={
              photoFolderName ? (
                <StatusLine ok>
                  {photoFolderName} · {photoCount} {photoCount === 1 ? "image" : "images"}
                </StatusLine>
              ) : (
                <StatusLine ok={false}>Click to choose a folder</StatusLine>
              )
            }
          />
        </div>

        <input
          ref={tableInputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onTableSelected(file);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          {...directoryInputAttrs}
          onChange={(e) => {
            onPhotoFolderSelected(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </section>

      {/* Mapping */}
      {table && (
        <section className="bg-white border border-gray-200 rounded-md p-5">
          <h2 className={sectionTitleClass}>2. Match columns</h2>
          <p className="text-sm text-gray-500 -mt-2 mb-4">
            Columns were matched automatically by name. Check them and fix where needed.
          </p>

          <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 items-center text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Site field</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Column in your table</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Example value</div>

            {FIELDS.map((field) => {
              const index = mapping[field.key];
              const isMissing = field.required && index === null;
              return (
                <div key={field.key} className="contents">
                  <div className="font-medium text-gray-800">
                    {field.label}
                    {field.required && <span className="text-accent"> *</span>}
                  </div>
                  <select
                    value={index ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className={`${inputClass} py-1.5 ${isMissing ? "border-red-400" : ""}`}
                  >
                    <option value="">— not in table —</option>
                    {table.columns.map((column, i) => (
                      <option key={i} value={i}>
                        {column}
                        {usedColumns.has(i) && usedColumns.get(i) !== field.label
                          ? ` (used for ${usedColumns.get(i)})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <div className="text-gray-500 truncate" title={sample(index)}>
                    {field.key === "weight_unit" && index === null ? (
                      <span className="flex items-center gap-2">
                        <span className="text-xs">Use for all rows:</span>
                        <select
                          value={defaultUnit}
                          onChange={(e) => onDefaultUnitChange(e.target.value as WeightUnit)}
                          className={`${inputClass} py-1 !w-20`}
                        >
                          {WEIGHT_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : (
                      sample(index) || <span className="text-gray-300">—</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="font-medium text-gray-800 self-start pt-1">Photos</div>
            <div className="col-span-2">
              <div className="flex flex-wrap gap-2">
                {table.columns.map((column, i) => {
                  const checked = mapping.photos.includes(i);
                  return (
                    <label
                      key={i}
                      className={`inline-flex items-center gap-1.5 border rounded-sm px-2 py-1 text-xs cursor-pointer ${
                        checked ? "border-accent bg-accent/5 text-accent" : "border-gray-300 text-gray-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePhotoColumn(i)}
                        className="accent-[var(--color-accent)]"
                      />
                      {column}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Select every column with photo file names. A cell may list several files separated by “;” or “,”.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-4">
            {missingRequired.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700">
                <AlertCircle className="w-4 h-4" />
                Match required fields: {missingRequired.map((f) => f.label).join(", ")}
              </span>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={missingRequired.length > 0}
              className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to preview
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
