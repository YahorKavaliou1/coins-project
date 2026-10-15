"""add coin image thumbnails

Revision ID: e7a9c1d3f5b6
Revises: d6f8b0c2e4a5
Create Date: 2026-10-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a9c1d3f5b6'
down_revision: Union[str, Sequence[str], None] = 'd6f8b0c2e4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('coin_images', sa.Column('thumbnail_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('coin_images', 'thumbnail_url')
