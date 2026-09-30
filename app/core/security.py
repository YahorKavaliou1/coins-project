import asyncio
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

# New hashes use Argon2id. bcrypt hashes from before are still accepted and are replaced
# with Argon2id on the next successful login (see verify_and_update_password).
_password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))

# Verified against when the account doesn't exist (or is locked), so the response takes
# as long as a real check and doesn't reveal which emails are registered.
_DUMMY_HASH = _password_hash.hash("dummy-password-for-constant-time")


def _verify_and_update(plain_password: str, hashed_password: str) -> tuple[bool, str | None]:
    try:
        return _password_hash.verify_and_update(plain_password, hashed_password)
    except ValueError:
        # bcrypt >= 5 rejects passwords over 72 bytes instead of truncating them.
        return False, None


# Hashing is deliberately slow (~0.1 s of CPU): run it in a thread so a burst of logins
# doesn't block the event loop and stall every other request.


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_password_hash.hash, password)


async def verify_and_update_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    """Returns (is_valid, new_hash); new_hash is set when the stored hash should be upgraded."""
    return await asyncio.to_thread(_verify_and_update, plain_password, hashed_password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return (await verify_and_update_password(plain_password, hashed_password))[0]


async def burn_password_check(plain_password: str) -> None:
    """Spends the same time as a real password check, for constant-time responses."""
    await verify_password(plain_password, _DUMMY_HASH)


def _create_token(subject: str, version: int, expires_delta: timedelta, token_type: str) -> str:
    expire = datetime.now(UTC) + expires_delta
    # "ver" must equal User.token_version, which lets the server revoke issued tokens.
    payload = {"sub": subject, "ver": version, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(subject: str, version: int) -> str:
    return _create_token(
        subject, version, timedelta(minutes=settings.access_token_expire_minutes), "access"
    )


def create_refresh_token(subject: str, version: int) -> str:
    return _create_token(
        subject, version, timedelta(days=settings.refresh_token_expire_days), "refresh"
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"require": ["exp", "sub", "type", "ver"]},
        )
    except jwt.PyJWTError as e:
        raise ValueError("Invalid token") from e
