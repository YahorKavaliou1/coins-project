from typing import Literal

from pydantic import EmailStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32
INSECURE_SECRET_KEYS = {"", "change-me-in-prod", "your-secret-key-here"}
PLACEHOLDER_SMTP_VALUES = {"your-smtp-login", "your-smtp-key", "your-smtp-key-here"}
LOCAL_SMTP_HOSTS = {"localhost", "127.0.0.1", "::1", "mailpit"}


class Settings(BaseSettings):
    database_url: str

    # Signs JWT tokens. Required: the app refuses to start without a real key.
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Role assigned to newly registered users: "user", "seller" or "admin".
    default_user_role: Literal["user", "seller", "admin"] = "admin"

    # Consecutive wrong passwords after which the account is blocked.
    max_failed_login_attempts: int = 8

    # --- Email (SMTP) ---
    # Brevo: host smtp-relay.brevo.com, port 587, security starttls, username = SMTP login,
    # password = SMTP key. Local Mailpit: host localhost, port 1025, security none, no credentials.
    smtp_host: str
    smtp_port: int = 587
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_timeout_seconds: int = 20
    mail_from: EmailStr
    mail_from_name: str = "Coins Catalog"
    # Public URL of the frontend, used for links in emails.
    frontend_url: str = "http://localhost:5173"
    # Runs the outbox worker inside the API process. Disable if a separate worker is used.
    email_worker_enabled: bool = True

    email_verification_ttl_hours: int = 24
    password_reset_ttl_minutes: int = 60
    # Newly registered accounts that never confirm their email are deleted after this.
    unverified_account_ttl_days: int = 7

    # hide_input_in_errors: never echo SECRET_KEY (or other values) into startup logs.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        hint = 'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        if value.strip() in INSECURE_SECRET_KEYS:
            raise ValueError(f"SECRET_KEY is a placeholder value. {hint}")
        if len(value) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(
                f"SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters long. {hint}"
            )
        return value

    @field_validator("frontend_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @model_validator(mode="after")
    def validate_smtp(self) -> "Settings":
        if {self.smtp_username, self.smtp_password} & PLACEHOLDER_SMTP_VALUES:
            raise ValueError("SMTP_USERNAME / SMTP_PASSWORD still contain placeholder values")
        if bool(self.smtp_username) != bool(self.smtp_password):
            raise ValueError("Set both SMTP_USERNAME and SMTP_PASSWORD, or neither")
        if self.smtp_security == "none" and self.smtp_host not in LOCAL_SMTP_HOSTS:
            raise ValueError(
                "SMTP_SECURITY=none is only allowed for a local server such as Mailpit"
            )
        return self


settings = Settings()
