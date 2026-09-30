"""Set the role of an existing account, e.g. to appoint the first admin after creating the DB.

Usage:
    python -m app.scripts.set_role you@example.com            # -> admin
    python -m app.scripts.set_role someone@example.com seller

The account must be registered through the site first, so its owner proved the address
by confirming it. Assigning roles by email in .env at registration time is avoided on
purpose: someone could register your address first with their own password.
"""

import argparse
import asyncio
import sys

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.user import User, UserRole


async def set_role(email: str, role: UserRole) -> int:
    # Own engine without SQL echo, so the command prints only its result.
    engine = create_async_engine(settings.database_url)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        user = (
            await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
        ).scalar_one_or_none()
        if user is None:
            print(f"No account with email {email}. Register it on the site first.", file=sys.stderr)
            await engine.dispose()
            return 1

        previous = user.role
        user.role = role
        await db.commit()

        print(f"{user.email}: role {previous} -> {role}")
        if not user.is_verified:
            print("Note: the email is not confirmed yet; confirm it via the link to log in.")
        if user.is_blocked:
            print("Note: the account is blocked; unblock it to log in.")
    await engine.dispose()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("email")
    parser.add_argument(
        "role", nargs="?", default=UserRole.ADMIN, choices=[r.value for r in UserRole]
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(set_role(args.email, UserRole(args.role))))


if __name__ == "__main__":
    main()
