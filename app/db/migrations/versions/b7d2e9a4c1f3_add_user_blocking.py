"""add user blocking

Revision ID: b7d2e9a4c1f3
Revises: a1c4e7b2d9f0
Create Date: 2026-09-30 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e9a4c1f3'
down_revision: Union[str, Sequence[str], None] = 'a1c4e7b2d9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_blocked', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('blocked_reason', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('blocked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'blocked_at')
    op.drop_column('users', 'blocked_reason')
    op.drop_column('users', 'is_blocked')
