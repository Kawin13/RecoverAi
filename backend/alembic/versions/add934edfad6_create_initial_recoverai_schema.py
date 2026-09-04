"""create_initial_recoverai_schema

Revision ID: add934edfad6
Revises: 
Create Date: 2026-08-25 21:01:58.765878

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision: str = 'add934edfad6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = set()
    if bind is not None:
        try:
            insp = sa.inspect(bind)
            curr_schema = None
            if bind.dialect.name == "postgresql":
                curr_schema = bind.execute(sa.text("SELECT current_schema();")).scalar()
            existing_tables = set(insp.get_table_names(schema=curr_schema))
        except Exception:
            existing_tables = set()

    # 1. customers
    if 'customers' not in existing_tables:
        op.create_table(
            'customers',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('email', sa.String(255), nullable=False),
            sa.Column('phone', sa.String(32), nullable=True),
            sa.Column('tier', sa.String(32), server_default='STANDARD', nullable=True),
            sa.Column('ltv', sa.Float(), server_default='0.0', nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_customers_id', 'customers', ['id'])
        op.create_index('ix_customers_email', 'customers', ['email'])

    # 2. transactions
    if 'transactions' not in existing_tables:
        op.create_table(
            'transactions',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('order_id', sa.String(64), nullable=False),
            sa.Column('customer_id', sa.String(64), sa.ForeignKey('customers.id'), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('currency', sa.String(8), server_default='INR', nullable=True),
            sa.Column('method', sa.String(32), server_default='Card', nullable=True),
            sa.Column('status', sa.String(32), server_default='FAILED', nullable=True),
            sa.Column('razorpay_order_id', sa.String(64), nullable=True),
            sa.Column('razorpay_payment_id', sa.String(64), nullable=True),
            sa.Column('razorpay_signature', sa.String(256), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_transactions_id', 'transactions', ['id'])
        op.create_index('ix_transactions_order_id', 'transactions', ['order_id'])
        op.create_index('ix_transactions_customer_id', 'transactions', ['customer_id'])
        op.create_index('ix_transactions_razorpay_order_id', 'transactions', ['razorpay_order_id'])
        op.create_index('ix_transactions_razorpay_payment_id', 'transactions', ['razorpay_payment_id'])

    # 3. payment_attempts
    if 'payment_attempts' not in existing_tables:
        op.create_table(
            'payment_attempts',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('transaction_id', sa.String(64), sa.ForeignKey('transactions.id'), nullable=False),
            sa.Column('attempt_number', sa.Integer(), server_default='1', nullable=True),
            sa.Column('gateway', sa.String(64), server_default='Razorpay', nullable=True),
            sa.Column('gateway_payment_id', sa.String(64), nullable=True),
            sa.Column('error_code', sa.String(64), nullable=True),
            sa.Column('error_description', sa.String(512), nullable=True),
            sa.Column('error_category', sa.String(64), nullable=True),
            sa.Column('latency_ms', sa.Integer(), server_default='0', nullable=True),
            sa.Column('status', sa.String(32), server_default='FAILED', nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_payment_attempts_id', 'payment_attempts', ['id'])
        op.create_index('ix_payment_attempts_transaction_id', 'payment_attempts', ['transaction_id'])
        op.create_index('ix_payment_attempts_gateway_payment_id', 'payment_attempts', ['gateway_payment_id'])

    # 4. recovery_cases
    if 'recovery_cases' not in existing_tables:
        op.create_table(
            'recovery_cases',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('transaction_id', sa.String(64), sa.ForeignKey('transactions.id'), nullable=False, unique=True),
            sa.Column('risk_amount', sa.Float(), nullable=False),
            sa.Column('failure_category', sa.String(64), nullable=False),
            sa.Column('recovery_probability', sa.Float(), server_default='0.0', nullable=True),
            sa.Column('selected_strategy', sa.String(64), server_default='SMART_PAYLINK_1CLICK', nullable=True),
            sa.Column('expected_recovery_value', sa.Float(), server_default='0.0', nullable=True),
            sa.Column('status', sa.String(32), server_default='DETECTED', nullable=True),
            sa.Column('current_step', sa.String(64), server_default='DETECTED', nullable=True),
            sa.Column('max_attempts', sa.Integer(), server_default='3', nullable=True),
            sa.Column('attempt_count', sa.Integer(), server_default='1', nullable=True),
            sa.Column('channel', sa.String(32), server_default='IN_APP', nullable=True),
            sa.Column('scheduled_at', sa.DateTime(), nullable=True),
            sa.Column('executed_at', sa.DateTime(), nullable=True),
            sa.Column('execution_payload', sa.String(2048), nullable=True),
            sa.Column('checkout_session_id', sa.String(64), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('recovered_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_recovery_cases_id', 'recovery_cases', ['id'])
        op.create_index('ix_recovery_cases_transaction_id', 'recovery_cases', ['transaction_id'])
        op.create_index('ix_recovery_cases_checkout_session_id', 'recovery_cases', ['checkout_session_id'])

    # 5. checkout_sessions
    if 'checkout_sessions' not in existing_tables:
        op.create_table(
            'checkout_sessions',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('customer_id', sa.String(64), sa.ForeignKey('customers.id'), nullable=False),
            sa.Column('order_id', sa.String(64), nullable=False),
            sa.Column('cart_amount', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('status', sa.String(32), server_default='STARTED', nullable=True),
            sa.Column('selected_method', sa.String(32), nullable=True),
            sa.Column('payment_attempted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('last_activity_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('abandoned_at', sa.DateTime(), nullable=True),
            sa.Column('is_demo_simulation', sa.Boolean(), server_default=sa.text('true'), nullable=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=True),
            sa.Column('items_summary', sa.String(255), nullable=True),
            sa.Column('cart_value', sa.Float(), nullable=True),
            sa.Column('dropped_at_step', sa.String(64), nullable=True),
            sa.Column('is_recovered', sa.Boolean(), server_default=sa.text('false'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_checkout_sessions_id', 'checkout_sessions', ['id'])
        op.create_index('ix_checkout_sessions_customer_id', 'checkout_sessions', ['customer_id'])
        op.create_index('ix_checkout_sessions_order_id', 'checkout_sessions', ['order_id'])
        op.create_index('ix_checkout_sessions_status', 'checkout_sessions', ['status'])
        op.create_index('ix_checkout_sessions_recovery_case_id', 'checkout_sessions', ['recovery_case_id'])

    # 6. recovery_actions
    if 'recovery_actions' not in existing_tables:
        op.create_table(
            'recovery_actions',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=False),
            sa.Column('strategy', sa.String(64), nullable=False),
            sa.Column('channel', sa.String(32), server_default='SMS', nullable=True),
            sa.Column('payload_data', sa.Text(), nullable=True),
            sa.Column('erv', sa.Float(), server_default='0.0', nullable=True),
            sa.Column('status', sa.String(32), server_default='DISPATCHED', nullable=True),
            sa.Column('dispatched_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_recovery_actions_id', 'recovery_actions', ['id'])
        op.create_index('ix_recovery_actions_recovery_case_id', 'recovery_actions', ['recovery_case_id'])

    # 7. agent_decisions
    if 'agent_decisions' not in existing_tables:
        op.create_table(
            'agent_decisions',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=False),
            sa.Column('model_name', sa.String(64), server_default='XGBoost+Gemini-2.5-Flash', nullable=True),
            sa.Column('input_features', sa.Text(), nullable=True),
            sa.Column('propensity_scores', sa.Text(), nullable=True),
            sa.Column('selected_action', sa.String(64), nullable=False),
            sa.Column('reasoning_summary', sa.Text(), nullable=False),
            sa.Column('decided_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_agent_decisions_id', 'agent_decisions', ['id'])
        op.create_index('ix_agent_decisions_recovery_case_id', 'agent_decisions', ['recovery_case_id'])

    # 8. audit_logs
    if 'audit_logs' not in existing_tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=True),
            sa.Column('transaction_id', sa.String(64), sa.ForeignKey('transactions.id'), nullable=True),
            sa.Column('actor', sa.String(64), server_default='AUTONOMOUS_AGENT', nullable=True),
            sa.Column('action_type', sa.String(64), nullable=False),
            sa.Column('target_resource', sa.String(128), nullable=False),
            sa.Column('details', sa.Text(), nullable=False),
            sa.Column('metadata_json', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_audit_logs_id', 'audit_logs', ['id'])
        op.create_index('ix_audit_logs_recovery_case_id', 'audit_logs', ['recovery_case_id'])
        op.create_index('ix_audit_logs_transaction_id', 'audit_logs', ['transaction_id'])

    # 9. guardrail_events
    if 'guardrail_events' not in existing_tables:
        op.create_table(
            'guardrail_events',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=True),
            sa.Column('rule_name', sa.String(128), nullable=False),
            sa.Column('threshold_breached', sa.String(128), nullable=False),
            sa.Column('action_taken', sa.String(64), server_default='BLOCKED', nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('triggered_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_guardrail_events_id', 'guardrail_events', ['id'])
        op.create_index('ix_guardrail_events_recovery_case_id', 'guardrail_events', ['recovery_case_id'])

    # 10. recovery_outcomes
    if 'recovery_outcomes' not in existing_tables:
        op.create_table(
            'recovery_outcomes',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=False, unique=True),
            sa.Column('recovered_amount', sa.Float(), nullable=False),
            sa.Column('payment_method_used', sa.String(32), server_default='UPI', nullable=True),
            sa.Column('time_to_recover_seconds', sa.Integer(), server_default='0', nullable=True),
            sa.Column('settled_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_recovery_outcomes_id', 'recovery_outcomes', ['id'])
        op.create_index('ix_recovery_outcomes_recovery_case_id', 'recovery_outcomes', ['recovery_case_id'])

    # 11. payment_links
    if 'payment_links' not in existing_tables:
        op.create_table(
            'payment_links',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('payment_link_id', sa.String(64), nullable=False, unique=True),
            sa.Column('recovery_case_id', sa.String(64), sa.ForeignKey('recovery_cases.id'), nullable=False),
            sa.Column('short_url', sa.String(256), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('currency', sa.String(8), server_default='INR', nullable=True),
            sa.Column('status', sa.String(32), server_default='created', nullable=True),
            sa.Column('is_live_demo', sa.Boolean(), server_default=sa.text('false'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_payment_links_id', 'payment_links', ['id'])
        op.create_index('ix_payment_links_payment_link_id', 'payment_links', ['payment_link_id'])
        op.create_index('ix_payment_links_recovery_case_id', 'payment_links', ['recovery_case_id'])

    # 12. webhook_events
    if 'webhook_events' not in existing_tables:
        op.create_table(
            'webhook_events',
            sa.Column('id', sa.String(128), primary_key=True),
            sa.Column('event_type', sa.String(64), nullable=False),
            sa.Column('resource_id', sa.String(64), nullable=True),
            sa.Column('status', sa.String(32), server_default='PROCESSED', nullable=True),
            sa.Column('payload_summary', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_webhook_events_id', 'webhook_events', ['id'])
        op.create_index('ix_webhook_events_event_type', 'webhook_events', ['event_type'])
        op.create_index('ix_webhook_events_resource_id', 'webhook_events', ['resource_id'])

    # 13. profiles (baseline schema)
    if 'profiles' not in existing_tables:
        op.create_table(
            'profiles',
            sa.Column('id', sa.Uuid(as_uuid=False), primary_key=True),
            sa.Column('full_name', sa.String(255), nullable=True),
            sa.Column('email', sa.String(255), nullable=True),
            sa.Column('avatar_url', sa.Text(), nullable=True),
            sa.Column('role', sa.String(32), server_default='operator', nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.CheckConstraint("role IN ('admin', 'operator')", name='role_check'),
        )
        op.create_index('ix_profiles_id', 'profiles', ['id'])
        op.create_index('ix_profiles_email', 'profiles', ['email'])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table('profiles')
    op.drop_table('webhook_events')
    op.drop_table('payment_links')
    op.drop_table('recovery_outcomes')
    op.drop_table('guardrail_events')
    op.drop_table('audit_logs')
    op.drop_table('agent_decisions')
    op.drop_table('recovery_actions')
    op.drop_table('checkout_sessions')
    op.drop_table('recovery_cases')
    op.drop_table('payment_attempts')
    op.drop_table('transactions')
    op.drop_table('customers')

