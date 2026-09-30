from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32
INSECURE_SECRET_KEYS = {"", "change-me-in-prod", "your-secret-key-here"}


class Settings(BaseSettings):
    database_url: str

    # Signs JWT tokens. Required: the app refuses to start without a real key.
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Role assigned to newly registered users: "user", "seller" or "admin".
    default_user_role: Literal["user", "seller", "admin"] = "admin"

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


settings = Settings()
