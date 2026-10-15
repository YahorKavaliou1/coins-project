import type { CoinImage } from "../types";

/** The small, fast version for cards and lists; photos from before thumbnails have none. */
export function thumbnailSrc(image: CoinImage): string {
  return image.thumbnail_url ?? image.url;
}
