import { Zip, ZipPassThrough } from "fflate";
import type { ExportResult } from "../types";

const DOWNLOAD_CONCURRENCY = 4;

export interface ExportOutcome {
  /** File names as downloaded: the table and, if there are photos, their archive. */
  files: string[];
  photoCount: number;
  failedPhotos: string[];
}

function download(parts: BlobPart[], filename: string, type: string) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked later: the browser reads the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Builds a ZIP of the photos as they arrive. The archive is streamed into chunks rather than
 * one big buffer, and photos are stored as they are (already compressed): fast, and memory
 * stays close to the size of the archive itself.
 */
async function zipPhotos(
  photos: ExportResult["photos"],
  onProgress: (done: number) => void
): Promise<{ chunks: Uint8Array<ArrayBuffer>[]; failed: string[] }> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const failed: string[] = [];
  let finished!: () => void;
  let failedZip!: (err: Error) => void;
  const done = new Promise<void>((resolve, reject) => {
    finished = resolve;
    failedZip = reject;
  });
  const zip = new Zip((err, chunk, final) => {
    if (err) return failedZip(err);
    chunks.push(chunk as Uint8Array<ArrayBuffer>);
    if (final) finished();
  });

  let next = 0;
  let completed = 0;
  const worker = async () => {
    while (next < photos.length) {
      const photo = photos[next++];
      try {
        // Photos are public; the storage allows cross-origin GET (CORS).
        const response = await fetch(photo.url);
        if (!response.ok) throw new Error(String(response.status));
        const data = new Uint8Array(await response.arrayBuffer());
        // Each file is added whole, so parallel downloads never interleave in the archive.
        const entry = new ZipPassThrough(photo.filename);
        zip.add(entry);
        entry.push(data, true);
      } catch {
        failed.push(photo.filename);
      }
      onProgress(++completed);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, photos.length) }, worker));
  zip.end();
  await done;
  return { chunks, failed };
}

/**
 * Downloads the table, then the photos as a ZIP next to it ("lots-2026-10-15-photos.zip").
 * Unzipped, the photos folder can be used with the batch import together with the table.
 */
export async function downloadExport(
  result: ExportResult,
  onProgress: (done: number, total: number) => void
): Promise<ExportOutcome> {
  download(
    [base64ToBytes(result.workbook_base64)],
    result.filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const files = [result.filename];
  const total = result.photos.length;
  if (total === 0) return { files, photoCount: 0, failedPhotos: [] };

  onProgress(0, total);
  const { chunks, failed } = await zipPhotos(result.photos, (done) => onProgress(done, total));
  if (failed.length < total) {
    const zipName = result.filename.replace(/\.xlsx$/, "-photos.zip");
    download(chunks, zipName, "application/zip");
    files.push(zipName);
  }
  return { files, photoCount: total - failed.length, failedPhotos: failed };
}
