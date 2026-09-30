"""Per-IP rate limits for endpoints that are expensive or send emails.

Use `@limiter.limit("5/minute")` on an endpoint that takes a `request: Request` argument.
Limits for the auth endpoints are defined next to them in app/api/auth.py.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings

TOO_MANY_REQUESTS_DETAIL = "Too many requests. Please wait a moment and try again."

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
)


def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RateLimitExceeded)
    # {"detail": ...} like every other API error, so the frontend can show the message.
    # Retry-After: the length of the limit's window, an upper bound on the wait.
    retry_after = exc.limit.limit.get_expiry() if exc.limit is not None else 60
    return JSONResponse(
        {"detail": TOO_MANY_REQUESTS_DETAIL},
        status_code=429,
        headers={"Retry-After": str(retry_after)},
    )
