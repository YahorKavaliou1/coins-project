"""add email tokens and outbox

Revision ID: c3e8f1a5b2d7
Revises: b7d2e9a4c1f3
Create Date: 2026-09-30 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e8f1a5b2d7'
down_revision: Union[str, Sequence[str], None] = 'b7d2e9a4c1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Existing users keep is_verified = false and get verification_deadline = NULL:
    they are asked to confirm their email on the next login and are never auto-deleted.
    """
    op.add_column('users', sa.Column('verification_deadline', sa.DateTime(timezone=True), nullable=True))

    op.create_table('user_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('purpose', sa.String(length=30), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_user_tokens_user_id'), 'user_tokens', ['user_id'], unique=False)

    op.create_table('email_outbox',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('to_email', sa.String(length=255), nullable=False),
    sa.Column('template', sa.String(length=50), nullable=False),
    sa.Column('subject', sa.String(length=255), nullable=False),
    sa.Column('html_body', sa.Text(), nullable=True),
    sa.Column('text_body', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('last_error', sa.Text(), nullable=True),
    sa.Column('next_attempt_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_outbox_user_id'), 'email_outbox', ['user_id'], unique=False)
    op.create_index(op.f('ix_email_outbox_status'), 'email_outbox', ['status'], unique=False)
    op.create_index(op.f('ix_email_outbox_next_attempt_at'), 'email_outbox', ['next_attempt_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_email_outbox_next_attempt_at'), table_name='email_outbox')
    op.drop_index(op.f('ix_email_outbox_status'), table_name='email_outbox')
    op.drop_index(op.f('ix_email_outbox_user_id'), table_name='email_outbox')
    op.drop_table('email_outbox')
    op.drop_index(op.f('ix_user_tokens_user_id'), table_name='user_tokens')
    op.drop_table('user_tokens')
    op.drop_column('users', 'verification_deadline')
