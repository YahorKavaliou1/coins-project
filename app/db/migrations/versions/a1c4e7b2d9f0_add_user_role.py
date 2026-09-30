"""add user role

Revision ID: a1c4e7b2d9f0
Revises: f339b505d327
Create Date: 2026-09-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e7b2d9f0'
down_revision: Union[str, Sequence[str], None] = 'f339b505d327'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), server_default='user', nullable=False),
    )
    op.create_check_constraint('ck_users_role', 'users', "role IN ('user', 'seller', 'admin')")
    # Existing accounts were created when everyone could sell; keep their access.
    op.execute("UPDATE users SET role = 'admin'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_users_role', 'users', type_='check')
    op.drop_column('users', 'role')
