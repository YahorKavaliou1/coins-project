"""Sends one email over SMTP (stdlib smtplib, run in a worker thread)."""

import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

from app.core.config import settings


class PermanentEmailError(Exception):
    """The server rejected the message for good (e.g. unknown recipient): don't retry."""


def build_message(to_email: str, subject: str, html: str, text: str) -> EmailMessage:
    sender_domain = str(settings.mail_from).rsplit("@", 1)[-1]
    message = EmailMessage()
    message["From"] = formataddr((settings.mail_from_name, str(settings.mail_from)))
    message["To"] = to_email
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid(domain=sender_domain)
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    return message


def _send_sync(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    timeout = settings.smtp_timeout_seconds
    smtp: smtplib.SMTP
    if settings.smtp_security == "ssl":
        smtp = smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=timeout, context=context
        )
    else:
        smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout)
    with smtp:
        if settings.smtp_security == "starttls":
            smtp.starttls(context=context)
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        try:
            smtp.send_message(message)
        except smtplib.SMTPRecipientsRefused as e:
            raise PermanentEmailError(f"Recipient refused: {e.recipients}") from e
        except smtplib.SMTPResponseException as e:
            # 5xx on the message itself is final; auth/connection problems stay retryable.
            if 500 <= e.smtp_code < 600 and not isinstance(e, smtplib.SMTPAuthenticationError):
                raise PermanentEmailError(f"{e.smtp_code} {e.smtp_error!r}") from e
            raise


async def send_email(to_email: str, subject: str, html: str, text: str) -> None:
    message = build_message(to_email, subject, html, text)
    await asyncio.to_thread(_send_sync, message)
