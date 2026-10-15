"""coin status: for sale, withdrawn or sold

Revision ID: d6f8b0c2e4a5
Revises: c5e7a9b1d3f4
Create Date: 2026-10-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6f8b0c2e4a5'
down_revision: Union[str, Sequence[str], None] = 'c5e7a9b1d3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'coins',
        sa.Column('status', sa.String(length=20), server_default='for_sale', nullable=False),
    )
    # Until now a coin left sale only by being bought.
    op.execute("UPDATE coins SET status = 'sold' WHERE NOT is_for_sale")
    op.create_check_constraint(
        'ck_coins_status_valid', 'coins', "status IN ('for_sale', 'withdrawn', 'sold')"
    )
    op.create_index(op.f('ix_coins_status'), 'coins', ['status'], unique=False)
    op.drop_column('coins', 'is_for_sale')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'coins',
        sa.Column('is_for_sale', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    )
    # Withdrawn coins become "not for sale", which the old schema can't tell from sold.
    op.execute("UPDATE coins SET is_for_sale = (status = 'for_sale')")
    op.drop_index(op.f('ix_coins_status'), table_name='coins')
    op.drop_constraint('ck_coins_status_valid', 'coins', type_='check')
    op.drop_column('coins', 'status')
