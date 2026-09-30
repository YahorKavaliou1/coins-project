"""Renders email templates (HTML + plain text) from app/templates/email."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core.config import settings

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "email"
SITE_NAME = "Coins Catalog"

SUBJECTS: dict[str, str] = {
    "verify_email": "Confirm your email address",
    "account_exists": "You already have a {site_name} account",
    "reset_password": "Reset your password",
    "password_changed": "Your password was changed",
    "order_confirmation": "Order #{order_id} confirmed",
    "coin_sold": "You sold a coin — order #{order_id}",
    "account_blocked": "Your account has been blocked",
    "account_locked": "Your account is temporarily locked",
    "account_unblocked": "Your account is active again",
}

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    # Escape user-provided values (names, addresses) in HTML; plain text needs no escaping.
    autoescape=select_autoescape(enabled_extensions=("html",), default_for_string=False),
    # Fail loudly on a missing variable instead of sending an email with blanks.
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def render_email(template: str, context: dict[str, Any]) -> RenderedEmail:
    if template not in SUBJECTS:
        raise ValueError(f"Unknown email template: {template}")
    full_context = {"site_name": SITE_NAME, "site_url": settings.frontend_url, **context}
    subject = SUBJECTS[template].format(**full_context)
    full_context["subject"] = subject
    html = _env.get_template(f"{template}.html").render(full_context)
    text = _env.get_template(f"{template}.txt").render(full_context)
    return RenderedEmail(subject=subject, html=html, text=text)
