"""temporary login lockout instead of blocking

Revision ID: e5a1b3c7d9f2
Revises: d4f9a2c6e8b1
Create Date: 2026-10-01 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a1b3c7d9f2'
down_revision: Union[str, Sequence[str], None] = 'd4f9a2c6e8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    # Accounts blocked for failed logins get a regular temporary lock instead. The failure
    # count is kept, so the next wrong password locks the account again right away.
    op.execute(
        """
        UPDATE users
        SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL,
            locked_until = now() + interval '15 minutes'
        WHERE blocked_reason = 'too_many_failed_logins'
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        UPDATE users
        SET is_blocked = true, blocked_reason = 'too_many_failed_logins', blocked_at = now()
        WHERE locked_until > now()
        """
    )
    op.drop_column('users', 'locked_until')
