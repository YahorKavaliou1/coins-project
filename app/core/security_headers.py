"""Security-related response headers for every API response."""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Swagger UI and ReDoc load scripts from a CDN and run inline code, so the strict policy
# below would blank them; they get no CSP (and are disabled in production).
DOCS_PATHS = ("/docs", "/redoc")

_COMMON_HEADERS = {
    # Browsers must not guess a different content type: an uploaded "image" is never run
    # as HTML or script.
    "X-Content-Type-Options": "nosniff",
    # Links in emails carry one-time tokens in the URL; never leak them in Referer.
    "Referrer-Policy": "no-referrer",
    # No page of the API may be framed (clickjacking).
    "X-Frame-Options": "DENY",
}
# The API serves JSON and images only: nothing it returns may load or run anything.
_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_HSTS = "max-age=31536000; includeSubDomains"


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope["path"]

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in _COMMON_HEADERS.items():
                    headers.setdefault(name, value)
                if not path.startswith(DOCS_PATHS):
                    headers.setdefault("Content-Security-Policy", _CSP)
                if not path.startswith("/static/"):
                    # Responses carry personal data (profile, orders, cart): keep them out of
                    # browser and proxy caches. Photos stay cacheable.
                    headers.setdefault("Cache-Control", "no-store")
                if self.hsts:
                    headers.setdefault("Strict-Transport-Security", _HSTS)
            await send(message)

        await self.app(scope, receive, send_with_headers)
