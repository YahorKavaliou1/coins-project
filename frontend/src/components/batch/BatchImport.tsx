import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { listCountries, listMetals } from "../../api/reference";
import { createCoinsBatch, parseImportTable } from "../../api/coinImport";
import { uploadCoinImage } from "../../api/coins";
import { getErrorMessage, type ApiError } from "../../api/client";
import { toast } from "../../store/toastStore";
import {
  autoMap,
  buildDraftRows,
  buildPhotoIndex,
  emptyMapping,
  isImageFileName,
  splitPhotoNames,
  toBatchItem,
  validateRow,
  type DraftRow,
  type Mapping,
  type RowErrors,
  type WeightUnit,
} from "../../utils/batchImport";
import type { ImportTable } from "../../types";
import { SetupStep } from "./SetupStep";
import { PreviewStep } from "./PreviewStep";

type Step = "setup" | "preview" | "publishing" | "done";

const UPLOAD_CONCURRENCY = 4;

interface PublishResult {
  lotCount: number;
  photoCount: number;
  failedPhotos: { row: number; name: string; reason: string }[];
}

interface PhotoTask {
  coinId: number;
  row: number;
  file: File;
}

async function runPool<T>(tasks: T[], limit: number, worker: (task: T) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await worker(task);
    }
  });
  await Promise.all(runners);
}

export function BatchImport() {
  const queryClient = useQueryClient();
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: metals = [] } = useQuery({ queryKey: ["metals"], queryFn: listMetals });

  const [step, setStep] = useState<Step>("setup");
  const [table, setTable] = useState<ImportTable | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoFolderName, setPhotoFolderName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping>(emptyMapping);
  const [defaultUnit, setDefaultUnit] = useState<WeightUnit>("oz");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [progress, setProgress] = useState({ label: "", done: 0, total: 0 });
  const [result, setResult] = useState<PublishResult | null>(null);

  const photoIndex = useMemo(() => buildPhotoIndex(photoFiles), [photoFiles]);

  // Preview URLs for the chosen photos: created when a folder is picked, revoked when it is
  // replaced, on reset and on unmount. The ref mirrors state for the unmount cleanup.
  const [photoUrls, setPhotoUrls] = useState<Map<File, string>>(() => new Map());
  const photoUrlsRef = useRef(photoUrls);
  function replacePhotoUrls(files: File[]) {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const urls = new Map(files.map((file) => [file, URL.createObjectURL(file)] as const));
    photoUrlsRef.current = urls;
    setPhotoUrls(urls);
  }
  useEffect(() => () => photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const errors = useMemo(() => {
    const map = new Map<number, RowErrors>();
    for (const row of rows) map.set(row.id, validateRow(row, photoIndex));
    return map;
  }, [rows, photoIndex]);

  async function handleTableSelected(file: File) {
    setTableLoading(true);
    try {
      const parsed = await parseImportTable(file);
      setTable(parsed);
      setMapping(autoMap(parsed.columns));
    } catch (err) {
      toast.error(getErrorMessage(err as ApiError));
    } finally {
      setTableLoading(false);
    }
  }

  function handlePhotoFolderSelected(files: File[]) {
    const images = files.filter((f) => isImageFileName(f.name));
    const folder = files[0]?.webkitRelativePath.split("/")[0] || "Selected folder";
    setPhotoFiles(images);
    replacePhotoUrls(images);
    setPhotoFolderName(folder);
    if (images.length === 0) toast.error("No JPEG, PNG or WEBP images found in this folder.");
  }

  function goToPreview() {
    if (!table) return;
    setRows(buildDraftRows(table.rows, mapping, defaultUnit, countries, metals));
    setStep("preview");
  }

  function reset() {
    setStep("setup");
    setTable(null);
    setPhotoFiles([]);
    replacePhotoUrls([]);
    setPhotoFolderName(null);
    setMapping(emptyMapping());
    setRows([]);
    setResult(null);
  }

  async function publish() {
    setStep("publishing");
    setProgress({ label: "Creating lots…", done: 0, total: rows.length });

    let ids: number[];
    try {
      ({ ids } = await createCoinsBatch(rows.map(toBatchItem)));
    } catch (err) {
      toast.error(getErrorMessage(err as ApiError));
      setStep("preview");
      return;
    }

    const tasks: PhotoTask[] = rows.flatMap((row, i) =>
      splitPhotoNames(row.photos).map((name) => ({
        coinId: ids[i],
        row: row.sourceRow,
        file: photoIndex.get(name.toLowerCase())!,
      }))
    );

    const failedPhotos: PublishResult["failedPhotos"] = [];
    let done = 0;
    setProgress({ label: "Uploading photos…", done, total: tasks.length });
    await runPool(tasks, UPLOAD_CONCURRENCY, async (task) => {
      try {
        await uploadCoinImage(task.coinId, task.file);
      } catch (err) {
        failedPhotos.push({ row: task.row, name: task.file.name, reason: getErrorMessage(err as ApiError) });
      }
      done += 1;
      setProgress({ label: "Uploading photos…", done, total: tasks.length });
    });

    queryClient.invalidateQueries({ queryKey: ["coins"] });
    queryClient.invalidateQueries({ queryKey: ["coin-facets"] });
    setResult({ lotCount: ids.length, photoCount: tasks.length - failedPhotos.length, failedPhotos });
    setStep("done");
  }

  if (step === "publishing") {
    const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 max-w-xl mx-auto text-center">
        <div className="text-lg font-bold mb-1">Publishing lots</div>
        <div className="text-sm text-gray-500 mb-5">
          {progress.label} {progress.total > 0 && `${progress.done} / ${progress.total}`}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-4">Please keep this page open until the upload finishes.</p>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 max-w-xl mx-auto text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <div className="text-xl font-bold mb-1">
          {result.lotCount} {result.lotCount === 1 ? "lot" : "lots"} published
        </div>
        <div className="text-sm text-gray-500">
          {result.photoCount} {result.photoCount === 1 ? "photo" : "photos"} uploaded
        </div>

        {result.failedPhotos.length > 0 && (
          <div className="text-left border border-amber-200 bg-amber-50 rounded-sm p-3 mt-5">
            <div className="flex items-center gap-1 text-sm font-bold text-amber-800 mb-1">
              <AlertTriangle className="w-4 h-4" />
              {result.failedPhotos.length} photos failed to upload
            </div>
            <p className="text-xs text-amber-800 mb-2">The lots were created; add these photos via Edit on each coin.</p>
            <ul className="text-xs text-amber-900 max-h-40 overflow-y-auto">
              {result.failedPhotos.map((f, i) => (
                <li key={i}>
                  Row {f.row}: {f.name} — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 border border-gray-300 rounded-sm text-sm font-bold uppercase tracking-wide text-gray-700 hover:border-accent hover:text-accent"
          >
            Import another file
          </button>
          <Link
            to="/browse"
            className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-sm text-sm font-bold uppercase tracking-wide"
          >
            Go to shop
          </Link>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <PreviewStep
        rows={rows}
        errors={errors}
        countries={countries}
        metals={metals}
        photoIndex={photoIndex}
        photoUrls={photoUrls}
        onRowChange={(updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
        onRowDelete={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
        onBack={() => setStep("setup")}
        onPublish={publish}
      />
    );
  }

  return (
    <SetupStep
      table={table}
      tableLoading={tableLoading}
      onTableSelected={handleTableSelected}
      photoFolderName={photoFolderName}
      photoCount={photoFiles.length}
      onPhotoFolderSelected={handlePhotoFolderSelected}
      mapping={mapping}
      onMappingChange={setMapping}
      defaultUnit={defaultUnit}
      onDefaultUnitChange={setDefaultUnit}
      onContinue={goToPreview}
    />
  );
}
