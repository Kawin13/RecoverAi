import uuid
from datetime import datetime, timedelta
import pytest
from sqlalchemy.orm import Session

from app.models.workspaces import Workspace, DEFAULT_WORKSPACE_ID
from app.models.customers import Customer
from app.models.transactions import Transaction
from app.models.recovery_cases import RecoveryCase
from app.models.recovery_outcomes import RecoveryOutcome
from app.services.dashboard_service import DashboardService
from app.services.analytics_service import AnalyticsService
from app.schemas.analytics import AnalyticsFilters


@pytest.fixture
def clean_workspace(db_session: Session):
    """Creates a fresh, isolated workspace for deterministic verification."""
    ws_id = str(uuid.uuid4())
    ws = Workspace(
        id=ws_id,
        name=f"Test Workspace {ws_id[:8]}",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(ws)
    db_session.commit()
    return ws


def test_hardcoded_overview_revenue_and_active_count_removed(db_session: Session, clean_workspace: Workspace):
    """
    1. Overview KPIs must come purely from the workspace DB.
    An empty workspace must show exactly 0.0 at risk, 0.0 recovered, 0 active recoveries,
    without silently injecting 681400.0, 459840.0, or 184.
    """
    dashboard_svc = DashboardService(db_session)
    summary = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)

    assert summary.metrics.revenue_at_risk == 0.0
    assert summary.metrics.revenue_recovered == 0.0
    assert summary.metrics.active_recoveries == 0
    assert summary.metrics.recovery_rate == 0.0

    # Verify absence of legacy hardcoded numbers
    assert summary.metrics.revenue_at_risk != 681400.0
    assert summary.metrics.revenue_recovered != 459840.0
    assert summary.metrics.active_recoveries != 184


def test_analytics_artificial_data_removed(db_session: Session, clean_workspace: Workspace):
    """
    2. Analytics must not artificially scale revenue (+5.42L, +4.18L) when DB cases < 15.
    Empty or low-volume workspaces must reflect truthful numbers.
    """
    analytics_svc = AnalyticsService(db_session)
    res = analytics_svc.get_financial_analytics(
        AnalyticsFilters(time_range="7d"),
        workspace_id=clean_workspace.id
    )

    assert res.kpis.revenue_at_risk == 0.0
    assert res.kpis.revenue_recovered == 0.0
    assert res.kpis.active_recoveries == 0
    assert res.kpis.recovery_rate == 0.0
    assert res.kpis.net_recovery_value == 0.0
    assert res.kpis.avg_recovery_time_minutes == 0.0
    assert res.kpis.avg_attempts_before_recovery == 0.0

    # Ensure no fake categories were generated
    assert len(res.recovery_by_merchant_category) == 0


def test_demo_live_labeling(db_session: Session, clean_workspace: Workspace):
    """
    3. Explicit data modes: LIVE TEST DATA, SIMULATED DATA, Demo Dataset.
    """
    dashboard_svc = DashboardService(db_session)

    # Clean workspace with no seed records is operational LIVE TEST DATA
    summary_live = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)
    assert summary_live.data_mode == "LIVE TEST DATA"

    # Add a simulation record
    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        name="Simulated Customer",
        email="sim@test.io",
        created_at=datetime.utcnow()
    )
    db_session.add(cust)
    db_session.commit()

    tx = Transaction(
        id=f"tx_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        order_id="ord_sim_1",
        customer_id=cust.id,
        amount=1500.0,
        status="FAILED",
        created_at=datetime.utcnow()
    )
    db_session.add(tx)
    db_session.commit()

    case_sim = RecoveryCase(
        id=f"case_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        transaction_id=tx.id,
        risk_amount=1500.0,
        failure_category="TECHNICAL_TIMEOUT",
        channel="EMAIL_SIMULATION",
        status="DETECTED",
        created_at=datetime.utcnow()
    )
    db_session.add(case_sim)
    db_session.commit()

    summary_sim = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)
    assert summary_sim.data_mode == "SIMULATED DATA"

    # In default demo workspace with demo customers, returns Demo Dataset
    summary_demo = dashboard_svc.get_dashboard_summary(workspace_id=DEFAULT_WORKSPACE_ID)
    if any(c.transaction and c.transaction.customer_id in ["cust_771", "cust_802"] for c in db_session.query(RecoveryCase).filter(RecoveryCase.workspace_id == DEFAULT_WORKSPACE_ID).all()):
        assert summary_demo.data_mode == "Demo Dataset"


def test_genuine_time_filters_24h_7d_30d(db_session: Session, clean_workspace: Workspace):
    """
    4. Time filters (24H, 7D, 30D) must genuinely bind to start_time and end_time SQL constraints.
    """
    now = datetime.utcnow()
    dashboard_svc = DashboardService(db_session)
    analytics_svc = AnalyticsService(db_session)

    # Create customer
    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        name="Time Filter Test Customer",
        email="time@test.io",
        created_at=now - timedelta(days=60)
    )
    db_session.add(cust)
    db_session.commit()

    # Seed 4 cases with varying timestamps:
    # A: 2 hours ago (within 24h, 7d, 30d) - risk 1000.0
    # B: 3 days ago (within 7d, 30d; outside 24h) - risk 2000.0
    # C: 15 days ago (within 30d; outside 24h, 7d) - risk 4000.0
    # D: 45 days ago (outside all three) - risk 8000.0
    test_cases_meta = [
        ("A", now - timedelta(hours=2), 1000.0),
        ("B", now - timedelta(days=3), 2000.0),
        ("C", now - timedelta(days=15), 4000.0),
        ("D", now - timedelta(days=45), 8000.0),
    ]

    for label, ts, amt in test_cases_meta:
        tx = Transaction(
            id=f"tx_tf_{label}_{uuid.uuid4().hex[:6]}",
            workspace_id=clean_workspace.id,
            order_id=f"ord_tf_{label}",
            customer_id=cust.id,
            amount=amt,
            status="FAILED",
            created_at=ts
        )
        db_session.add(tx)
        db_session.commit()

        rc = RecoveryCase(
            id=f"case_tf_{label}_{uuid.uuid4().hex[:6]}",
            workspace_id=clean_workspace.id,
            transaction_id=tx.id,
            risk_amount=amt,
            failure_category="TECHNICAL_TIMEOUT",
            status="DETECTED",
            created_at=ts
        )
        db_session.add(rc)
        db_session.commit()

    # 1. Test 24h Filter: Only Case A (₹1,000)
    dash_24h = dashboard_svc.get_dashboard_summary(time_range="24h", workspace_id=clean_workspace.id)
    assert dash_24h.metrics.revenue_at_risk == 1000.0
    assert dash_24h.metrics.active_recoveries == 1

    an_24h = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="24h"), workspace_id=clean_workspace.id)
    assert an_24h.kpis.revenue_at_risk == 1000.0
    assert an_24h.kpis.active_recoveries == 1

    # 2. Test 7d Filter: Case A + Case B (₹1,000 + ₹2,000 = ₹3,000)
    dash_7d = dashboard_svc.get_dashboard_summary(time_range="7d", workspace_id=clean_workspace.id)
    assert dash_7d.metrics.revenue_at_risk == 3000.0
    assert dash_7d.metrics.active_recoveries == 2

    an_7d = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="7d"), workspace_id=clean_workspace.id)
    assert an_7d.kpis.revenue_at_risk == 3000.0
    assert an_7d.kpis.active_recoveries == 2

    # 3. Test 30d Filter: Case A + Case B + Case C (₹1,000 + ₹2,000 + ₹4,000 = ₹7,000)
    dash_30d = dashboard_svc.get_dashboard_summary(time_range="30d", workspace_id=clean_workspace.id)
    assert dash_30d.metrics.revenue_at_risk == 7000.0
    assert dash_30d.metrics.active_recoveries == 3

    an_30d = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="30d"), workspace_id=clean_workspace.id)
    assert an_30d.kpis.revenue_at_risk == 7000.0
    assert an_30d.kpis.active_recoveries == 3


def test_recovered_logic_requires_status_recovered(db_session: Session, clean_workspace: Workspace):
    """
    5. Count a case as recovered only when recovery is genuinely successful according to canonical status.
    Having an outcome record alone must NOT count as recovered if case.status != 'RECOVERED'.
    """
    dashboard_svc = DashboardService(db_session)
    analytics_svc = AnalyticsService(db_session)

    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        name="Outcome Test Customer",
        email="outcome@test.io",
        created_at=datetime.utcnow()
    )
    db_session.add(cust)
    db_session.commit()

    # Case 1: Status is IN_PROGRESS, but has an outcome record
    tx1 = Transaction(
        id=f"tx_rec1_{uuid.uuid4().hex[:6]}",
        workspace_id=clean_workspace.id,
        order_id="ord_rec_1",
        customer_id=cust.id,
        amount=5000.0,
        status="FAILED",
        created_at=datetime.utcnow()
    )
    db_session.add(tx1)
    db_session.commit()

    case_in_progress = RecoveryCase(
        id=f"case_rec1_{uuid.uuid4().hex[:6]}",
        workspace_id=clean_workspace.id,
        transaction_id=tx1.id,
        risk_amount=5000.0,
        failure_category="TECHNICAL_TIMEOUT",
        status="IN_PROGRESS",
        created_at=datetime.utcnow()
    )
    db_session.add(case_in_progress)
    db_session.commit()

    # Pre-mature outcome record exists (e.g., attempt failed or pending)
    outcome_pending = RecoveryOutcome(
        id=f"out_rec1_{uuid.uuid4().hex[:6]}",
        workspace_id=clean_workspace.id,
        recovery_case_id=case_in_progress.id,
        recovered_amount=5000.0,
        settled_at=datetime.utcnow()
    )
    db_session.add(outcome_pending)
    db_session.commit()

    # Check dashboard and analytics: MUST NOT be counted as recovered!
    dash = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)
    assert dash.metrics.revenue_recovered == 0.0
    assert dash.metrics.revenue_at_risk == 5000.0
    assert dash.metrics.active_recoveries == 1

    an = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="7d"), workspace_id=clean_workspace.id)
    assert an.kpis.revenue_recovered == 0.0
    assert an.kpis.revenue_at_risk == 5000.0

    # Now transition case to canonical RECOVERED status
    case_in_progress.status = "RECOVERED"
    db_session.commit()

    dash_after = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)
    assert dash_after.metrics.revenue_recovered == 5000.0
    assert dash_after.metrics.revenue_at_risk == 0.0
    assert dash_after.metrics.active_recoveries == 0

    an_after = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="7d"), workspace_id=clean_workspace.id)
    assert an_after.kpis.revenue_recovered == 5000.0
    assert an_after.kpis.revenue_at_risk == 0.0


def test_fake_category_hashing_removed(db_session: Session, clean_workspace: Workspace):
    """
    6. Remove fake merchant category assignment using hash(transaction_id).
    Use real stored category if available; if unavailable, use 'Unknown'.
    """
    analytics_svc = AnalyticsService(db_session)

    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        name="Category Test Customer",
        email="cat@test.io",
        created_at=datetime.utcnow()
    )
    db_session.add(cust)
    db_session.commit()

    # Seed 3 transactions without merchant_category
    for i in range(3):
        tx = Transaction(
            id=f"tx_cat_{i}_{uuid.uuid4().hex[:6]}",
            workspace_id=clean_workspace.id,
            order_id=f"ord_cat_{i}",
            customer_id=cust.id,
            amount=2000.0,
            status="FAILED",
            created_at=datetime.utcnow()
        )
        db_session.add(tx)
        db_session.commit()

        rc = RecoveryCase(
            id=f"case_cat_{i}_{uuid.uuid4().hex[:6]}",
            workspace_id=clean_workspace.id,
            transaction_id=tx.id,
            risk_amount=2000.0,
            failure_category="TECHNICAL_TIMEOUT",
            status="DETECTED",
            created_at=datetime.utcnow()
        )
        db_session.add(rc)
        db_session.commit()

    res = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="7d"), workspace_id=clean_workspace.id)
    cats = res.recovery_by_merchant_category
    assert len(cats) == 1
    # Must be 'Unknown', not hashed into E-Commerce / SaaS / Quick Commerce
    assert cats[0].category == "Unknown"
    assert cats[0].total_count == 3
    assert cats[0].at_risk_amount == 6000.0


def test_known_data_reconciliation_exact_match(db_session: Session, clean_workspace: Workspace):
    """
    7. Seed known deterministic cases.
    Calculate expected totals manually.
    Verify dashboard and analytics exactly match DB.
    """
    dashboard_svc = DashboardService(db_session)
    analytics_svc = AnalyticsService(db_session)

    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=clean_workspace.id,
        name="Reconciliation Customer",
        email="reconcile@test.io",
        created_at=datetime.utcnow()
    )
    db_session.add(cust)
    db_session.commit()

    # Case 1: ₹5,000 - FAILED (non-recovered risk = 5000)
    tx1 = Transaction(id=f"tx_m1_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, order_id="ord_m1", customer_id=cust.id, amount=5000.0, status="FAILED", created_at=datetime.utcnow())
    db_session.add(tx1)
    db_session.commit()
    rc1 = RecoveryCase(id=f"case_m1_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, transaction_id=tx1.id, risk_amount=5000.0, failure_category="TECHNICAL_TIMEOUT", status="FAILED", created_at=datetime.utcnow())
    db_session.add(rc1)

    # Case 2: ₹12,000 - RECOVERED (recovered = 12000, risk = 0)
    tx2 = Transaction(id=f"tx_m2_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, order_id="ord_m2", customer_id=cust.id, amount=12000.0, status="SUCCESS", created_at=datetime.utcnow())
    db_session.add(tx2)
    db_session.commit()
    rc2 = RecoveryCase(id=f"case_m2_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, transaction_id=tx2.id, risk_amount=12000.0, failure_category="AUTHENTICATION", status="RECOVERED", created_at=datetime.utcnow())
    db_session.add(rc2)
    db_session.commit()
    out2 = RecoveryOutcome(id=f"out_m2_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, recovery_case_id=rc2.id, recovered_amount=12000.0, settled_at=datetime.utcnow())
    db_session.add(out2)

    # Case 3: ₹3,500 - DETECTED (active = 1, non-recovered risk = 3500)
    tx3 = Transaction(id=f"tx_m3_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, order_id="ord_m3", customer_id=cust.id, amount=3500.0, status="FAILED", created_at=datetime.utcnow())
    db_session.add(tx3)
    db_session.commit()
    rc3 = RecoveryCase(id=f"case_m3_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, transaction_id=tx3.id, risk_amount=3500.0, failure_category="FINANCIAL_LIMIT", status="DETECTED", created_at=datetime.utcnow())
    db_session.add(rc3)

    # Case 4: ₹8,000 - STOPPED (non-recovered risk = 8000, active = 0)
    tx4 = Transaction(id=f"tx_m4_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, order_id="ord_m4", customer_id=cust.id, amount=8000.0, status="FAILED", created_at=datetime.utcnow())
    db_session.add(tx4)
    db_session.commit()
    rc4 = RecoveryCase(id=f"case_m4_{uuid.uuid4().hex[:6]}", workspace_id=clean_workspace.id, transaction_id=tx4.id, risk_amount=8000.0, failure_category="CUSTOMER_ACTION_REQUIRED", status="STOPPED", created_at=datetime.utcnow())
    db_session.add(rc4)
    db_session.commit()

    # Manual Expected Totals:
    # At Risk = 5000 + 3500 + 8000 = 16500.0
    # Recovered = 12000.0
    # Active = 1 (Case 3)
    # Recovery Rate = 12000 / (16500 + 12000) * 100 = 42.11%
    expected_at_risk = 16500.0
    expected_recovered = 12000.0
    expected_active = 1
    expected_rate = 42.11

    # Verify Dashboard
    dash = dashboard_svc.get_dashboard_summary(workspace_id=clean_workspace.id)
    assert dash.metrics.revenue_at_risk == expected_at_risk
    assert dash.metrics.revenue_recovered == expected_recovered
    assert dash.metrics.active_recoveries == expected_active
    assert dash.metrics.recovery_rate == expected_rate

    # Verify Analytics
    an = analytics_svc.get_financial_analytics(AnalyticsFilters(time_range="7d"), workspace_id=clean_workspace.id)
    assert an.kpis.revenue_at_risk == expected_at_risk
    assert an.kpis.revenue_recovered == expected_recovered
    assert an.kpis.active_recoveries == expected_active
    assert an.kpis.recovery_rate == expected_rate
