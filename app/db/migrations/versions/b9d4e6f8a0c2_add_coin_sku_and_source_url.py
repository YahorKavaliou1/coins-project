"""add coin sku and source url

Revision ID: b9d4e6f8a0c2
Revises: a8c3d5e7f9b1
Create Date: 2026-10-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9d4e6f8a0c2'
down_revision: Union[str, Sequence[str], None] = 'a8c3d5e7f9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('coins', sa.Column('sku', sa.String(length=100), nullable=True))
    op.add_column('coins', sa.Column('source_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('coins', 'source_url')
    op.drop_column('coins', 'sku')
