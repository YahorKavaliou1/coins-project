/** Same as MAX_FILE_SIZE_BYTES in app/services/image_storage.py. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Same as MAX_DIMENSION there: the server keeps no more pixels than this. */
const MAX_DIMENSION = 2560;
/** Tried in order until the photo fits; 0.95 already looks identical to the original. */
const QUALITIES = [0.95, 0.92, 0.9, 0.87, 0.85];

/**
 * Makes a photo fit the 5 MB upload limit with the least possible loss: photos within the
 * limit are sent untouched; larger ones (typical of 48 Mpx phone cameras) are scaled to
 * what the server keeps anyway and encoded at the highest quality that fits.
 *
 * Returns the original file if the browser can't decode it (the server then reports why).
 */
export async function fitImage(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    // Applies the EXIF orientation, so the result is upright like the photo on the phone.
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // A photo saved as PNG is far too big lossless; WebP stays WebP.
    const type = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      if (!blob) break;
      if (blob.size <= MAX_UPLOAD_BYTES) {
        const name = blob.type === "image/jpeg" ? file.name.replace(/\.(png|webp)$/i, ".jpg") : file.name;
        return new File([blob], name, { type: blob.type });
      }
    }
    return file;
  } finally {
    bitmap.close();
  }
}
