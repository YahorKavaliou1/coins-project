"""Local filesystem storage for coin images.

Images are validated and re-encoded with Pillow, then saved under
app/static/uploads/coins/{coin_id}/ so they are served by the existing
/static StaticFiles mount without any extra routing.
"""

import io
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 1600  # px, longest side

UPLOAD_ROOT = Path("app/static/uploads/coins")


def validate_content_type(content_type: str | None) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, or WEBP images are allowed.",
        )


def validate_size(data: bytes) -> None:
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller.")


def process_image(data: bytes) -> tuple[bytes, str]:
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


def save_image_file(coin_id: int, data: bytes, ext: str) -> str:
    coin_dir = UPLOAD_ROOT / str(coin_id)
    coin_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}.{ext}"
    file_path = coin_dir / filename
    file_path.write_bytes(data)

    return f"/static/uploads/coins/{coin_id}/{filename}"


def delete_image_file(url: str) -> None:
    # url looks like "/static/uploads/coins/{coin_id}/{filename}"
    relative_path = url.removeprefix("/static/")
    file_path = Path("app/static") / relative_path
    file_path.unlink(missing_ok=True)
