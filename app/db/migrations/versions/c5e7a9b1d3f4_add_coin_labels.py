"""add coin labels

Revision ID: c5e7a9b1d3f4
Revises: b9d4e6f8a0c2
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c5e7a9b1d3f4'
down_revision: Union[str, Sequence[str], None] = 'b9d4e6f8a0c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'coins',
        sa.Column(
            'labels',
            postgresql.ARRAY(sa.String(length=30)),
            server_default='{}',
            nullable=False,
        ),
    )
    op.create_index('ix_coins_labels', 'coins', ['labels'], unique=False, postgresql_using='gin')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_coins_labels', table_name='coins', postgresql_using='gin')
    op.drop_column('coins', 'labels')
