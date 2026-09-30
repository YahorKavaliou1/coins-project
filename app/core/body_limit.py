"""Caps the size of request bodies.

FastAPI reads and parses the body (spooling multipart uploads to temporary files) before
dependencies such as authentication run, so without a cap anyone could make the server
store arbitrarily large uploads. Per-endpoint limits (e.g. 5 MB per photo) still apply on top.
"""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The largest legitimate body: a 5 MB photo or table plus multipart overhead.
MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024
BODY_TOO_LARGE_DETAIL = "Request body is too large."


class _BodyTooLarge(HTTPException):
    # An HTTPException, so FastAPI passes it through body parsing and answers 413.
    def __init__(self) -> None:
        super().__init__(status_code=413, detail=BODY_TOO_LARGE_DETAIL)


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        too_large = JSONResponse({"detail": BODY_TOO_LARGE_DETAIL}, status_code=413)
        content_length = dict(scope["headers"]).get(b"content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = self.max_bytes + 1
            if declared > self.max_bytes:
                await too_large(scope, receive, send)
                return

        # Chunked bodies have no Content-Length: count the bytes as they arrive.
        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            # Raised outside a route (e.g. while a middleware reads the body).
            if not response_started:
                await too_large(scope, receive, send)
