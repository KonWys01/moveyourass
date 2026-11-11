"""new_activity notification preference

Revision ID: a1d9c3e5b7f2
Revises: 4a77ada19765
Create Date: 2026-11-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1d9c3e5b7f2'
down_revision: Union[str, Sequence[str], None] = '4a77ada19765'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'notification_prefs',
        sa.Column(
            'new_activity',
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('notification_prefs', 'new_activity')
