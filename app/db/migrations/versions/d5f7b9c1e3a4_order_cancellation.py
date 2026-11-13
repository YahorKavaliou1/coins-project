"""order cancellation and payment reminders

Revision ID: d5f7b9c1e3a4
Revises: c4e6a8b0d2f3
Create Date: 2026-11-13 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f7b9c1e3a4'
down_revision: Union[str, Sequence[str], None] = 'c4e6a8b0d2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('orders', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'orders', sa.Column('payment_reminder_sent_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.drop_constraint('ck_orders_status', 'orders', type_='check')
    op.create_check_constraint(
        'ck_orders_status', 'orders', "status IN ('awaiting_payment', 'paid', 'shipped', 'cancelled')"
    )
    op.add_column(
        'order_items',
        sa.Column('cancelled', sa.Boolean(), server_default='false', nullable=False),
    )
    # A coin may now appear again in a later order once an earlier one was cancelled.
    op.drop_constraint('uq_order_items_coin_id', 'order_items', type_='unique')
    op.create_index(
        'uq_order_items_active_coin',
        'order_items',
        ['coin_id'],
        unique=True,
        postgresql_where=sa.text('NOT cancelled'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_order_items_active_coin', table_name='order_items')
    op.create_unique_constraint('uq_order_items_coin_id', 'order_items', ['coin_id'])
    op.drop_column('order_items', 'cancelled')
    op.drop_constraint('ck_orders_status', 'orders', type_='check')
    op.create_check_constraint(
        'ck_orders_status', 'orders', "status IN ('awaiting_payment', 'paid', 'shipped')"
    )
    op.drop_column('orders', 'payment_reminder_sent_at')
    op.drop_column('orders', 'cancelled_at')
