from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    secret_key: str = "change-me-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Role assigned to newly registered users: "user", "seller" or "admin".
    default_user_role: Literal["user", "seller", "admin"] = "admin"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
