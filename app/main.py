import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

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
from app.services.email.worker import run_email_worker

logging.getLogger("app").setLevel(logging.INFO)
if not logging.getLogger("app").handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     [%(name)s] %(message)s"))
    logging.getLogger("app").addHandler(_handler)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    worker = asyncio.create_task(run_email_worker()) if settings.email_worker_enabled else None
    yield
    if worker is not None:
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker


app = FastAPI(title="Coins API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(BodySizeLimitMiddleware)

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
