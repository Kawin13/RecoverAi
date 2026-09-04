"""sync_model_constraints_and_indices

Revision ID: c4d8e2f1a9b3
Revises: b2e4f6a8c1d3
Create Date: 2026-09-03 14:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4d8e2f1a9b3'
down_revision: Union[str, None] = 'b2e4f6a8c1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind) if bind is not None else None

    # 1. checkout_sessions indices and constraints
    if insp is not None:
        cs_indices = [idx['name'] for idx in insp.get_indexes('checkout_sessions')]
        if 'ix_checkout_sessions_recovery_case_id' not in cs_indices:
            op.create_index('ix_checkout_sessions_recovery_case_id', 'checkout_sessions', ['recovery_case_id'])
        if 'ix_checkout_sessions_status' not in cs_indices:
            op.create_index('ix_checkout_sessions_status', 'checkout_sessions', ['status'])

        cs_fks = [fk['name'] for fk in insp.get_foreign_keys('checkout_sessions')]
        if 'fk_checkout_sessions_recovery_case_id' not in cs_fks and bind.dialect.name == 'postgresql':
            op.create_foreign_key(
                'fk_checkout_sessions_recovery_case_id',
                'checkout_sessions',
                'recovery_cases',
                ['recovery_case_id'],
                ['id']
            )

        # 2. payment_attempts indices
        pa_indices = [idx['name'] for idx in insp.get_indexes('payment_attempts')]
        if 'ix_payment_attempts_gateway_payment_id' not in pa_indices:
            op.create_index('ix_payment_attempts_gateway_payment_id', 'payment_attempts', ['gateway_payment_id'])

        # 3. recovery_cases indices
        rc_indices = [idx['name'] for idx in insp.get_indexes('recovery_cases')]
        if 'ix_recovery_cases_checkout_session_id' not in rc_indices:
            op.create_index('ix_recovery_cases_checkout_session_id', 'recovery_cases', ['checkout_session_id'])

        # 4. transactions indices and signature length
        tx_indices = [idx['name'] for idx in insp.get_indexes('transactions')]
        if 'ix_transactions_razorpay_order_id' not in tx_indices:
            op.create_index('ix_transactions_razorpay_order_id', 'transactions', ['razorpay_order_id'])
        if 'ix_transactions_razorpay_payment_id' not in tx_indices:
            op.create_index('ix_transactions_razorpay_payment_id', 'transactions', ['razorpay_payment_id'])

    if bind is not None and bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE transactions ALTER COLUMN razorpay_signature TYPE VARCHAR(256);")
        op.execute("ALTER TABLE checkout_sessions ALTER COLUMN cart_amount SET NOT NULL;")


def downgrade() -> None:
    pass
