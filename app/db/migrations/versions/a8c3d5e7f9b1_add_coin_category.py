"""add coin category

Revision ID: a8c3d5e7f9b1
Revises: f7b2c4d8e1a3
Create Date: 2026-10-01 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8c3d5e7f9b1'
down_revision: Union[str, Sequence[str], None] = 'f7b2c4d8e1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('coins', sa.Column('category', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_coins_category'), 'coins', ['category'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_coins_category'), table_name='coins')
    op.drop_column('coins', 'category')
