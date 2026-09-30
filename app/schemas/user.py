from collections.abc import Callable
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models.user import BlockReason, UserRole

MIN_PASSWORD_LENGTH = 6
# Keeps hashing cost bounded; no real password is longer.
MAX_PASSWORD_LENGTH = 128

# (requirement text, check) — the frontend shows the same list in utils/password.ts.
PASSWORD_RULES: list[tuple[str, Callable[[str], bool]]] = [
    ("an uppercase letter", str.isupper),
    ("a lowercase letter", str.islower),
    ("a digit", str.isdigit),
    ("a special character", lambda c: not c.isalnum() and not c.isspace()),
]


def check_password_strength(password: str) -> str:
    """Applied wherever a password is set (registration, reset, profile), never at login,
    so accounts created before this rule can still log in."""
    missing = [
        text for text, is_match in PASSWORD_RULES if not any(is_match(char) for char in password)
    ]
    if missing:
        raise ValueError("Password must contain " + ", ".join(missing))
    return password


StrongPassword = Annotated[
    str,
    Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH),
    AfterValidator(check_password_strength),
]
# An existing password to check: no strength rules, which apply only when a password is set.
CurrentPassword = Annotated[str, Field(max_length=MAX_PASSWORD_LENGTH)]


class UserCreate(BaseModel):
    email: EmailStr
    password: StrongPassword
    full_name: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    is_blocked: bool
    blocked_reason: BlockReason | None
    blocked_at: datetime | None
    failed_login_attempts: int
    locked_until: datetime | None
    verification_deadline: datetime | None


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: StrongPassword | None = None
    # Required when `password` is set, so a stolen access token can't take over the account.
    current_password: CurrentPassword | None = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str | None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str


class EmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str
    password: CurrentPassword


class ResetPasswordRequest(BaseModel):
    token: str
    password: StrongPassword
