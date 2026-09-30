"""Storage for coin images.

Images are validated and re-encoded with Pillow (shared by every backend), then saved by
the configured backend:

- LocalImageStorage: app/static/uploads/coins/{coin_id}/, served by the existing /static
  StaticFiles mount without any extra routing (default).
- AWSImageStorage: Amazon S3 or an S3-compatible service; enable with IMAGE_STORAGE=s3.

Use get_image_storage() (also a FastAPI dependency) instead of instantiating backends.
The URL returned by save_image_file() is stored in coin_images.url and used as-is by the UI.
"""

import io
import logging
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

logger = logging.getLogger("app.images")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 1600  # px, longest side

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

    def process_image(self, data: bytes) -> tuple[bytes, str]:
        """Validate, downscale if needed, and re-encode the image.

        Returns (processed_bytes, file_extension).
        """
        try:
            image: Image.Image = Image.open(io.BytesIO(data))
            image.load()
        except (UnidentifiedImageError, OSError) as e:
            raise HTTPException(status_code=400, detail="Invalid or corrupted image file.") from e

        fmt = (image.format or "JPEG").upper()
        ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(fmt, "jpg")

        if image.width > MAX_DIMENSION or image.height > MAX_DIMENSION:
            image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

        if fmt == "JPEG" and image.mode in ("RGBA", "P"):
            image = image.convert("RGB")

        buffer = io.BytesIO()
        image.save(buffer, format=fmt)
        return buffer.getvalue(), ext

    @abstractmethod
    def save_image_file(self, coin_id: int, data: bytes, ext: str) -> str:
        """Stores a processed image and returns the URL the browser loads it from."""

    @abstractmethod
    def delete_image_file(self, url: str) -> None:
        """Deletes an image previously returned by save_image_file(). Missing files are ignored."""


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
            settings.s3_public_base_url
            or f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com"
        ).rstrip("/")
        # A client can be injected (tests use a stubbed one); otherwise build it from settings.
        self.client = client if client is not None else self._create_client()

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


@lru_cache
def get_image_storage() -> ImageStorage:
    """Factory: the storage selected by IMAGE_STORAGE. Also usable as a FastAPI dependency."""
    if settings.image_storage == "s3":
        return AWSImageStorage()
    return LocalImageStorage()
