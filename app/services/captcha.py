"""CAPTCHA check with Cloudflare Turnstile.

The browser widget gives the visitor a one-time token; the form sends it as `captcha_token`
and the endpoint asks Cloudflare whether it is valid before doing anything else.
Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
"""

import logging

import httpx
from fastapi import HTTPException, Request

from app.core.config import settings

logger = logging.getLogger("app.captcha")

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TIMEOUT_SECONDS = 5
CAPTCHA_FAILED_DETAIL = "Please complete the security check and try again."


def captcha_enabled() -> bool:
    return bool(settings.turnstile_secret_key)


async def verify_captcha(token: str | None, remote_ip: str | None) -> bool:
    if not captcha_enabled():
        return True
    if not token:
        return False

    data = {"secret": settings.turnstile_secret_key, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(VERIFY_URL, data=data)
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError):
        # Fail closed: if Cloudflare can't be reached, bots must not get through unchecked.
        logger.warning("Turnstile verification failed to complete", exc_info=True)
        return False

    if not result.get("success"):
        logger.info("Turnstile rejected a token: %s", result.get("error-codes"))
        return False
    if settings.turnstile_hostname and result.get("hostname") != settings.turnstile_hostname:
        logger.warning("Turnstile token issued for another host: %s", result.get("hostname"))
        return False
    return True


async def require_captcha(token: str | None, request: Request) -> None:
    """Raises 400 unless the CAPTCHA token is valid (no-op while CAPTCHA is disabled)."""
    remote_ip = request.client.host if request.client else None
    if not await verify_captcha(token, remote_ip):
        raise HTTPException(status_code=400, detail=CAPTCHA_FAILED_DETAIL)
