"""order statuses, seller settings, shipping options and saved addresses

Revision ID: a2c4e6f8b0d1
Revises: e7a9c1d3f5b6
Create Date: 2026-10-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a2c4e6f8b0d1'
down_revision: Union[str, Sequence[str], None] = 'e7a9c1d3f5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Seller settings.
    op.add_column('users', sa.Column('payment_details', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('contact_email', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('contact_phone', sa.String(length=40), nullable=True))
    op.add_column('users', sa.Column('contact_note', sa.String(length=500), nullable=True))
    op.add_column(
        'users',
        sa.Column(
            'shipping_options',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default='[]',
            nullable=False,
        ),
    )

    op.create_table(
        'shipping_addresses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('recipient_name', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('postal_code', sa.String(length=20), nullable=False),
        sa.Column('address_line', sa.String(length=255), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shipping_addresses_user_id'), 'shipping_addresses', ['user_id'], unique=False)

    # One order per seller, with payment and shipping steps.
    op.add_column('orders', sa.Column('seller_id', sa.Integer(), nullable=True))
    # Orders from before had a single seller in practice: take it from their items.
    op.execute(
        "UPDATE orders SET seller_id = "
        "(SELECT min(seller_id) FROM order_items WHERE order_items.order_id = orders.id)"
    )
    op.execute("DELETE FROM orders WHERE seller_id IS NULL AND NOT EXISTS "
               "(SELECT 1 FROM order_items WHERE order_items.order_id = orders.id)")
    op.alter_column('orders', 'seller_id', nullable=False)
    op.create_foreign_key('orders_seller_id_fkey', 'orders', 'users', ['seller_id'], ['id'])
    op.create_index(op.f('ix_orders_seller_id'), 'orders', ['seller_id'], unique=False)

    op.add_column('orders', sa.Column('shipping_method', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('shipping_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('orders', sa.Column('tracking_code', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True))
    # "completed" orders were finished deals.
    op.execute("UPDATE orders SET status = 'shipped' WHERE status NOT IN ('awaiting_payment', 'paid', 'shipped')")
    op.alter_column('orders', 'status', server_default='awaiting_payment')
    op.create_check_constraint(
        'ck_orders_status', 'orders', "status IN ('awaiting_payment', 'paid', 'shipped')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_orders_status', 'orders', type_='check')
    op.alter_column('orders', 'status', server_default='completed')
    op.execute("UPDATE orders SET status = 'completed'")
    op.drop_column('orders', 'shipped_at')
    op.drop_column('orders', 'paid_at')
    op.drop_column('orders', 'tracking_code')
    op.drop_column('orders', 'shipping_price')
    op.drop_column('orders', 'shipping_method')
    op.drop_index(op.f('ix_orders_seller_id'), table_name='orders')
    op.drop_constraint('orders_seller_id_fkey', 'orders', type_='foreignkey')
    op.drop_column('orders', 'seller_id')

    op.drop_index(op.f('ix_shipping_addresses_user_id'), table_name='shipping_addresses')
    op.drop_table('shipping_addresses')

    op.drop_column('users', 'shipping_options')
    op.drop_column('users', 'contact_note')
    op.drop_column('users', 'contact_phone')
    op.drop_column('users', 'contact_email')
    op.drop_column('users', 'payment_details')
