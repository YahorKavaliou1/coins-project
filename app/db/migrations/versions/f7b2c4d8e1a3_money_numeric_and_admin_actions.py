"""money as numeric, admin audit log, cart cascade

Revision ID: f7b2c4d8e1a3
Revises: e5a1b3c7d9f2
Create Date: 2026-10-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7b2c4d8e1a3'
down_revision: Union[str, Sequence[str], None] = 'e5a1b3c7d9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Prices the API used to accept but that can't be sold at (NaN, infinite, zero or
    # negative) are cleared; such coins can't be added to a cart until the seller sets one.
    op.execute(
        """
        UPDATE coins SET price = NULL
        WHERE price = 'NaN' OR price <= 0 OR price > 99999999.99
        """
    )
    op.alter_column(
        'coins', 'price', type_=sa.Numeric(12, 2), postgresql_using='round(price::numeric, 2)'
    )
    op.create_check_constraint('ck_coins_price_positive', 'coins', 'price > 0')
    op.alter_column(
        'orders', 'total_price', type_=sa.Numeric(14, 2),
        postgresql_using='round(total_price::numeric, 2)',
    )
    op.alter_column(
        'order_items', 'price_paid', type_=sa.Numeric(12, 2),
        postgresql_using='round(price_paid::numeric, 2)',
    )
    op.alter_column('order_items', 'coin_name_snapshot', type_=sa.Text())

    op.drop_constraint('cart_items_coin_id_fkey', 'cart_items', type_='foreignkey')
    op.create_foreign_key(
        'cart_items_coin_id_fkey', 'cart_items', 'coins', ['coin_id'], ['id'], ondelete='CASCADE'
    )

    op.create_table(
        'admin_actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=True),
        sa.Column('admin_email', sa.String(length=255), nullable=False),
        sa.Column('target_user_id', sa.Integer(), nullable=True),
        sa.Column('target_email', sa.String(length=255), nullable=False),
        sa.Column('action', sa.String(length=30), nullable=False),
        sa.Column('details', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_admin_actions_target_user_id'), 'admin_actions', ['target_user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_admin_actions_target_user_id'), table_name='admin_actions')
    op.drop_table('admin_actions')

    op.drop_constraint('cart_items_coin_id_fkey', 'cart_items', type_='foreignkey')
    op.create_foreign_key('cart_items_coin_id_fkey', 'cart_items', 'coins', ['coin_id'], ['id'])

    # Snapshots longer than 255 characters are cut to fit.
    op.alter_column(
        'order_items', 'coin_name_snapshot', type_=sa.String(length=255),
        postgresql_using='left(coin_name_snapshot, 255)',
    )
    op.alter_column('order_items', 'price_paid', type_=sa.Float())
    op.alter_column('orders', 'total_price', type_=sa.Float())
    op.drop_constraint('ck_coins_price_positive', 'coins', type_='check')
    op.alter_column('coins', 'price', type_=sa.Float())
