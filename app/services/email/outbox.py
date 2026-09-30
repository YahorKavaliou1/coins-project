"""Puts emails into the outbox. The caller commits them together with its own changes."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_outbox import EmailOutbox
from app.services.email.renderer import render_email


def enqueue_email(
    db: AsyncSession,
    *,
    to_email: str,
    template: str,
    context: dict[str, Any],
    user_id: int | None = None,
) -> EmailOutbox:
    rendered = render_email(template, context)
    email = EmailOutbox(
        user_id=user_id,
        to_email=to_email,
        template=template,
        subject=rendered.subject,
        html_body=rendered.html,
        text_body=rendered.text,
    )
    db.add(email)
    return email
