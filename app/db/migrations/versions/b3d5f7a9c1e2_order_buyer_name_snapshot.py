"""order buyer name snapshot

Revision ID: b3d5f7a9c1e2
Revises: a2c4e6f8b0d1
Create Date: 2026-11-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d5f7a9c1e2'
down_revision: Union[str, Sequence[str], None] = 'a2c4e6f8b0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('orders', sa.Column('buyer_name', sa.String(length=255), nullable=True))
    # Existing orders keep showing the name their buyers have now.
    op.execute(
        "UPDATE orders SET buyer_name = users.full_name FROM users WHERE users.id = orders.buyer_id"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('orders', 'buyer_name')
