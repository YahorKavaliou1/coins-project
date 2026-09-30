"""add user token_version, one order item per coin

Revision ID: d4f9a2c6e8b1
Revises: c3e8f1a5b2d7
Create Date: 2026-10-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f9a2c6e8b1'
down_revision: Union[str, Sequence[str], None] = 'c3e8f1a5b2d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))
    # A coin can be sold only once. Fails if the database already holds a double sale:
    # resolve those orders manually, then rerun the migration.
    op.create_unique_constraint('uq_order_items_coin_id', 'order_items', ['coin_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_order_items_coin_id', 'order_items', type_='unique')
    op.drop_column('users', 'token_version')
