"""Sends one email through Brevo's HTTP API.

For hosts that block outbound SMTP (Render's free plan blocks ports 25, 465 and 587): the API
goes over HTTPS. Docs: https://developers.brevo.com/reference/sendtransacemail
"""

import httpx

from app.core.config import settings
from app.services.email.errors import PermanentEmailError

API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(to_email: str, subject: str, html: str, text: str) -> None:
    payload = {
        "sender": {"name": settings.mail_from_name, "email": str(settings.mail_from)},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    headers = {"api-key": settings.brevo_api_key, "accept": "application/json"}
    async with httpx.AsyncClient(timeout=settings.smtp_timeout_seconds) as client:
        response = await client.post(API_URL, json=payload, headers=headers)
    if response.is_success:
        return
    detail = f"Brevo API {response.status_code}: {response.text[:500]}"
    # 400: this message is invalid (e.g. a malformed recipient), retrying won't help.
    # 401/403 (bad key, unauthorised IP), 429 and 5xx stay retryable: once the setting or
    # the provider is fixed, queued emails go out.
    if response.status_code == 400:
        raise PermanentEmailError(detail)
    raise RuntimeError(detail)
