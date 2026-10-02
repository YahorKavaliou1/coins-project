"""Delivers one email with the transport chosen by EMAIL_TRANSPORT."""

from app.core.config import settings
from app.services.email import brevo_api, smtp
from app.services.email.errors import PermanentEmailError

__all__ = ["PermanentEmailError", "send_email"]


async def send_email(to_email: str, subject: str, html: str, text: str) -> None:
    if settings.email_transport == "brevo_api":
        await brevo_api.send_email(to_email, subject, html, text)
    else:
        await smtp.send_email(to_email, subject, html, text)
