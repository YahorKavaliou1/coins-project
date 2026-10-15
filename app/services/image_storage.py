"""Storage for coin images.

Images are validated and re-encoded with Pillow (shared by every backend) into two files:
the photo itself, in high quality, for the coin's page, and a small thumbnail for coin cards
and lists, so that a page of coins loads fast. Both are saved by the configured backend:

- LocalImageStorage: app/static/uploads/coins/{coin_id}/, served by the existing /static
  StaticFiles mount without any extra routing (default).
- AWSImageStorage: Amazon S3 or an S3-compatible service; enable with IMAGE_STORAGE=s3.

Use get_image_storage() (also a FastAPI dependency) instead of instantiating backends.
The URL returned by save_image_file() is stored in coin_images.url and used as-is by the UI.
"""

import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

logger = logging.getLogger("app.images")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
# The browser recompresses larger photos to fit (frontend/src/utils/fitImage.ts).
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
# px, longest side of the photo on the coin's page. Larger photos are scaled down, with no
# visible loss: big enough to zoom into a coin's details, and encoded at high quality.
MAX_DIMENSION = 2560
# px, longest side of the thumbnail. A card shows a photo at up to ~150 CSS px; 480 stays
# sharp on 3x phone screens.
THUMBNAIL_DIMENSION = 480
# Checked before decoding: a small, highly compressed file can declare a huge canvas
# (a "decompression bomb") and take gigabytes of memory once decoded. 50 Mpx covers
# photos from any current phone (48 Mpx main cameras).
MAX_PIXELS = 50_000_000
MAX_IMAGES_PER_COIN = 12
PILLOW_FORMATS = ["JPEG", "PNG", "WEBP"]

# Re-encoding is unavoidable (it strips metadata such as GPS location and makes every file
# safe to serve), so it must not cost visible quality, yet the coin page should load fast.
# JPEG: quality 90 and no chroma subsampling (4:4:4): visually identical to the upload and
# about a third smaller than quality 95; Pillow's defaults (75, 4:2:0) blur fine detail and
# colour edges. Lossy WebP always halves colour resolution, so photos are kept as JPEG.
_SAVE_OPTIONS: dict[str, dict[str, Any]] = {
    "JPEG": {"quality": 90, "subsampling": 0, "optimize": True},
    "WEBP": {"quality": 90, "method": 4},
    "PNG": {"optimize": True},
}


def _has_transparency(image: Image.Image) -> bool:
    if image.mode in ("RGBA", "LA", "PA"):
        # An all-opaque alpha channel is no transparency. One band: extrema is (min, max).
        lowest, _ = image.getchannel("A").getextrema()
        return isinstance(lowest, int | float) and lowest < 255
    return "transparency" in image.info


# WebP is a third smaller than JPEG at the same look; quality 82 is indistinguishable from
# the photo at thumbnail size. method 6: slowest, smallest file (thumbnails are tiny).
_THUMBNAIL_OPTIONS: dict[str, Any] = {"format": "WEBP", "quality": 82, "method": 6}
THUMBNAIL_EXT = "webp"


@dataclass
class ProcessedImage:
    data: bytes
    ext: str
    thumbnail: bytes  # always THUMBNAIL_EXT


def make_thumbnail(image: Image.Image) -> bytes:
    """A small WebP of an upright, decoded image (the image itself is left unchanged)."""
    thumb = image.copy()
    thumb.thumbnail((THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION), Image.Resampling.LANCZOS)
    if thumb.mode not in ("RGB", "RGBA"):
        # Keeps transparency of PNG/WebP coins cut out from their background.
        has_alpha = thumb.mode in ("LA", "PA") or "transparency" in thumb.info
        thumb = thumb.convert("RGBA" if has_alpha else "RGB")
    buffer = io.BytesIO()
    thumb.save(buffer, **_THUMBNAIL_OPTIONS)
    return buffer.getvalue()


EXTENSION_CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class ImageStorage(ABC):
    """Validation and processing are storage-independent and shared by all backends;
    each backend implements where the processed file is saved and how it is deleted."""

    def validate_content_type(self, content_type: str | None) -> None:
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG, or WEBP images are allowed.",
            )

    def validate_size(self, data: bytes) -> None:
        if len(data) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller.")

    def process_image(self, data: bytes) -> ProcessedImage:
        """Validate, downscale if needed, and re-encode the image; also make its thumbnail.

        CPU-heavy: call it in a thread.
        """
        invalid = HTTPException(status_code=400, detail="Invalid or corrupted image file.")
        try:
            # Only the declared formats are tried, whatever the file claims to be.
            image: Image.Image = Image.open(io.BytesIO(data), formats=PILLOW_FORMATS)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
            raise invalid from e

        # open() only reads the header, so this runs before any pixel is decoded.
        if image.width * image.height > MAX_PIXELS:
            raise HTTPException(status_code=400, detail="Image resolution is too large.")

        fmt = (image.format or "JPEG").upper()

        if fmt == "JPEG":
            # Let the decoder downscale by up to 8x while decoding: less memory and CPU.
            image.draft(None, (MAX_DIMENSION, MAX_DIMENSION))
        try:
            image.load()
        except (OSError, Image.DecompressionBombError) as e:
            raise invalid from e

        # Downscaled first (LANCZOS, the sharpest filter): the rotation below then copies
        # fewer pixels. The bounding box is square, so the order doesn't change the result.
        if image.width > MAX_DIMENSION or image.height > MAX_DIMENSION:
            image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

        # Phones store photos sideways plus an EXIF "rotate me" tag, which re-encoding drops:
        # apply the rotation to the pixels instead (lossless: pixels are only moved).
        image = ImageOps.exif_transpose(image)

        # A photo saved as PNG is lossless and several MB: stored as JPEG like other photos,
        # unless it has transparency (e.g. a coin cut out from its background).
        if fmt == "PNG" and not _has_transparency(image):
            fmt = "JPEG"
        if fmt == "JPEG" and image.mode != "RGB":
            image = image.convert("RGB")
        ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]

        buffer = io.BytesIO()
        image.save(buffer, format=fmt, **_SAVE_OPTIONS[fmt])
        return ProcessedImage(data=buffer.getvalue(), ext=ext, thumbnail=make_thumbnail(image))

    @abstractmethod
    def save_image_file(self, coin_id: int, data: bytes, ext: str) -> str:
        """Stores a processed image and returns the URL the browser loads it from."""

    @abstractmethod
    def delete_image_file(self, url: str) -> None:
        """Deletes an image previously returned by save_image_file(). Missing files are ignored."""

    @abstractmethod
    def read_image_file(self, url: str) -> bytes:
        """Reads back an image saved by save_image_file() (used to backfill thumbnails)."""


class LocalImageStorage(ImageStorage):
    UPLOAD_ROOT = Path("app/static/uploads/coins")

    def save_image_file(self, coin_id: int, data: bytes, ext: str) -> str:
        coin_dir = self.UPLOAD_ROOT / str(coin_id)
        coin_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{uuid4().hex}.{ext}"
        file_path = coin_dir / filename
        file_path.write_bytes(data)

        return f"/static/uploads/coins/{coin_id}/{filename}"

    def delete_image_file(self, url: str) -> None:
        # url looks like "/static/uploads/coins/{coin_id}/{filename}"
        relative_path = url.removeprefix("/static/")
        file_path = Path("app/static") / relative_path
        file_path.unlink(missing_ok=True)

    def read_image_file(self, url: str) -> bytes:
        return (Path("app/static") / url.removeprefix("/static/")).read_bytes()


class AWSImageStorage(ImageStorage):
    """Amazon S3 or any S3-compatible service (Cloudflare R2, Scaleway, MinIO...).

    Not used until IMAGE_STORAGE=s3. Settings (see app/core/config.py):
        S3_BUCKET               bucket name (required)
        S3_REGION               e.g. eu-central-1 (Frankfurt)
        S3_ACCESS_KEY_ID        \\ credentials; if empty, boto3's default chain is used
        S3_SECRET_ACCESS_KEY    / (env vars, ~/.aws/credentials, IAM role)
        S3_ENDPOINT_URL         only for non-AWS services, e.g. Cloudflare R2
        S3_PUBLIC_BASE_URL      public read URL (bucket URL or CDN); default: AWS bucket URL
        S3_KEY_PREFIX           folder inside the bucket, default "coins"

    Objects are stored as {prefix}/{coin_id}/{random}.{ext}. The bucket (or the CDN in front
    of it) must allow public reads of these objects, because the browser loads them directly.
    Required IAM permissions: s3:PutObject and s3:DeleteObject on the bucket.
    """

    def __init__(self, client: Any = None) -> None:
        self.bucket = settings.s3_bucket
        self.prefix = settings.s3_key_prefix.strip("/")
        self.public_base_url = (
            settings.s3_public_base_url or self._default_public_base_url()
        ).rstrip("/")
        # A client can be injected (tests use a stubbed one); otherwise build it from settings.
        self.client = client if client is not None else self._create_client()

    @staticmethod
    def _default_public_base_url() -> str:
        if settings.s3_endpoint_url and settings.s3_addressing_style == "path":
            # Path-style services serve public objects at <endpoint>/<bucket>/<key> (Neon).
            return f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket}"
        return f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com"

    @staticmethod
    def _create_client() -> Any:
        import boto3
        from botocore.config import Config

        credentials: dict[str, str] = {}
        if settings.s3_access_key_id:
            credentials = {
                "aws_access_key_id": settings.s3_access_key_id,
                "aws_secret_access_key": settings.s3_secret_access_key,
            }
        return boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url or None,
            # boto3 >= 1.36 adds CRC checksum headers to every upload by default. Several
            # S3-compatible services (Cloudflare R2, Google Cloud Storage, Backblaze B2...)
            # reject such requests; "when_required" restores the classic behaviour and is
            # equally fine for Amazon S3.
            config=Config(
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                s3={"addressing_style": settings.s3_addressing_style},
            ),
            **credentials,
        )

    def _key_for(self, coin_id: int, filename: str) -> str:
        return "/".join(part for part in (self.prefix, str(coin_id), filename) if part)

    def save_image_file(self, coin_id: int, data: bytes, ext: str) -> str:
        key = self._key_for(coin_id, f"{uuid4().hex}.{ext}")
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=EXTENSION_CONTENT_TYPES.get(ext, "application/octet-stream"),
            # File names are random and never reused, so browsers/CDNs may cache forever.
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"{self.public_base_url}/{key}"

    def delete_image_file(self, url: str) -> None:
        base = f"{self.public_base_url}/"
        if not url.startswith(base):
            # E.g. a photo uploaded while the local storage was active.
            logger.warning("Not deleting %s: it is not stored in bucket %s", url, self.bucket)
            return
        # S3 delete is idempotent: deleting a missing key is not an error.
        self.client.delete_object(Bucket=self.bucket, Key=url.removeprefix(base))

    def read_image_file(self, url: str) -> bytes:
        key = url.removeprefix(f"{self.public_base_url}/")
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        data: bytes = response["Body"].read()
        return data


@lru_cache
def get_image_storage() -> ImageStorage:
    """Factory: the storage selected by IMAGE_STORAGE. Also usable as a FastAPI dependency."""
    if settings.image_storage == "s3":
        return AWSImageStorage()
    return LocalImageStorage()
