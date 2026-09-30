from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import BlockReason, UserRole

MIN_PASSWORD_LENGTH = 6


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
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
    verification_deadline: datetime | None


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=MIN_PASSWORD_LENGTH)


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


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
