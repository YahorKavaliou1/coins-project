import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from asyncpg.exceptions import DataError as AsyncpgDataError
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DataError, DBAPIError, IntegrityError

from app.api import (
    auth,
    cart,
    coin_images,
    coin_import,
    coins,
    countries,
    favourites,
    metals,
    orders,
    users,
)
from app.core.body_limit import BodySizeLimitMiddleware
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware
from app.services.email.worker import run_email_worker

logger = logging.getLogger("app")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     [%(name)s] %(message)s"))
    logger.addHandler(_handler)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    worker = asyncio.create_task(run_email_worker()) if settings.email_worker_enabled else None
    yield
    if worker is not None:
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker


docs_enabled = settings.api_docs_enabled
app = FastAPI(
    title="Coins API",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
# The last one added runs first: unknown hosts are rejected before anything else, and every
# response (errors included) gets the security headers.
app.add_middleware(BodySizeLimitMiddleware)
if settings.cors_origin_list:
    # The frontend on its own domain (production). Auth is a bearer token, not cookies, so no
    # credentials mode is needed.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Retry-After"],
        max_age=600,
    )
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.hsts_enabled)


# Last line of defence for input the schemas don't bound (e.g. a path id beyond the INTEGER
# range) and for races on unique constraints: a clear 4xx instead of a 500 with a traceback.
@app.exception_handler(DBAPIError)
async def db_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DBAPIError)
    # DataError: rejected by the server; AsyncpgDataError: by the driver before sending
    # (e.g. 99999999999 doesn't fit an INTEGER parameter).
    driver_error = exc.orig.__cause__ if exc.orig is not None else None
    if isinstance(exc, DataError) or isinstance(driver_error, AsyncpgDataError):
        return JSONResponse({"detail": "Invalid value."}, status_code=422)
    logger.error("Database error", exc_info=exc)
    return JSONResponse({"detail": "Internal Server Error"}, status_code=500)


@app.exception_handler(IntegrityError)
async def db_integrity_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        {"detail": "The request conflicts with the current data. Please reload and try again."},
        status_code=409,
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(countries.router)
app.include_router(metals.router)
app.include_router(coin_import.router)
app.include_router(coins.router)
app.include_router(favourites.router)
app.include_router(coin_images.router)
app.include_router(cart.router)
app.include_router(orders.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Only user-uploaded coin photos are served (stored URLs look like /static/uploads/coins/...).
# The UI is the React app in frontend/; nothing else in app/static is exposed.
app.mount("/static/uploads", StaticFiles(directory="app/static/uploads"), name="uploads")
