from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.core.datetime_utils import to_utc

from app.models.recovery_cases import RecoveryCase
from app.models.recovery_outcomes import RecoveryOutcome
from app.models.transactions import Transaction
from app.models.customers import Customer
from app.models.workspaces import DEFAULT_WORKSPACE_ID
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardMetrics,
    TrendPoint,
    StrategyMetric,
    PaymentBreakdown,
    FailureReasonBreakdown,
    RecentAgentActivity
)

class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_summary(
        self,
        time_range: str = "7d",
        workspace_id: Optional[str] = None
    ) -> DashboardResponse:
        now = datetime.now(timezone.utc)
        tr = (time_range or "7d").lower()

        # 1. Genuine Time Window Determination
        if tr in ("24h", "today"):
            start_time = now - timedelta(hours=24)
            num_trend_points = 6
        elif tr == "30d":
            start_time = now - timedelta(days=30)
            num_trend_points = 10
        else:  # default 7d
            start_time = now - timedelta(days=7)
            num_trend_points = 7
        end_time = now

        # 2. Base Query with strictly bound time filters and workspace isolation
        case_query = (
            self.db.query(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .outerjoin(RecoveryOutcome, RecoveryCase.id == RecoveryOutcome.recovery_case_id)
            .filter(
                RecoveryCase.created_at >= start_time,
                RecoveryCase.created_at <= end_time
            )
        )
        if workspace_id:
            case_query = case_query.filter(RecoveryCase.workspace_id == workspace_id)

        cases = case_query.all()

        # 3. Calculate genuine operational totals (Zero hardcoded additions)
        total_at_risk = 0.0
        total_recovered = 0.0
        active_count = 0

        strategy_stats: Dict[str, Dict[str, Any]] = {}
        payment_stats: Dict[str, Dict[str, Any]] = {}
        failure_stats: Dict[str, Dict[str, Any]] = {}

        is_demo_dataset = False
        is_simulation_dataset = False

        for case in cases:
            risk = float(case.risk_amount or 0.0)
            outcome = case.recovery_outcome
            # Canonical recovery logic: Status MUST be RECOVERED
            is_rec = (case.status == "RECOVERED")
            rec_amt = float(outcome.recovered_amount) if (outcome and outcome.recovered_amount is not None) else (risk if is_rec else 0.0)

            # Check provenance tags
            if case.channel and "SIMULATION" in case.channel.upper():
                is_simulation_dataset = True
            if case.transaction and case.transaction.customer_id in ["cust_771", "cust_802", "cust_419", "cust_901", "cust_112"]:
                is_demo_dataset = True

            if is_rec:
                total_recovered += rec_amt
            else:
                total_at_risk += risk

            if case.status in [
                "DETECTED", "ANALYZED", "STRATEGY_SELECTED", "GUARDRAIL_CHECKED",
                "ACTION_SCHEDULED", "ACTION_EXECUTED", "WAITING_FOR_CUSTOMER", "IN_PROGRESS",
                "PENDING_APPROVAL", "ATTEMPTING", "MANUAL_ESCALATION"
            ]:
                active_count += 1

            # Strategy breakdown
            strat_key = (case.selected_strategy or "SMART_PAYLINK_1CLICK").upper()
            if strat_key not in strategy_stats:
                strategy_stats[strat_key] = {
                    "attempts": 0,
                    "success": 0,
                    "recovered": 0.0,
                    "total_time": 0
                }
            strategy_stats[strat_key]["attempts"] += 1
            if is_rec:
                strategy_stats[strat_key]["success"] += 1
                strategy_stats[strat_key]["recovered"] += rec_amt
                strategy_stats[strat_key]["total_time"] += (outcome.time_to_recover_seconds if outcome else 240)

            # Payment method breakdown
            method_name = (case.transaction.method if case.transaction else "UPI").capitalize()
            if method_name not in payment_stats:
                payment_stats[method_name] = {"volume": 0, "recovered": 0.0, "loss": 0.0}
            payment_stats[method_name]["volume"] += 1
            if is_rec:
                payment_stats[method_name]["recovered"] += rec_amt
            else:
                payment_stats[method_name]["loss"] += risk

            # Failure category breakdown
            fail_cat = (case.failure_category or "TECHNICAL_TIMEOUT").upper()
            if fail_cat not in failure_stats:
                failure_stats[fail_cat] = {"count": 0, "total": 0.0, "recovered": 0.0}
            failure_stats[fail_cat]["count"] += 1
            failure_stats[fail_cat]["total"] += risk
            if is_rec:
                failure_stats[fail_cat]["recovered"] += rec_amt

        recovery_rate = (
            round((total_recovered / (total_at_risk + total_recovered) * 100), 2)
            if (total_at_risk + total_recovered) > 0
            else 0.0
        )

        metrics = DashboardMetrics(
            revenue_at_risk=round(total_at_risk, 2),
            revenue_recovered=round(total_recovered, 2),
            recovery_rate=recovery_rate,
            active_recoveries=active_count,
            at_risk_delta_percent=0.0,
            recovered_delta_percent=0.0,
            recovery_rate_delta_percent=0.0,
            active_delta_count=0
        )

        # 4. Generate dynamic trend points across the selected time range
        trend_data: List[TrendPoint] = []
        step_seconds = (end_time - start_time).total_seconds() / max(1, num_trend_points)
        for i in range(num_trend_points):
            bucket_start = start_time + timedelta(seconds=i * step_seconds)
            bucket_end = bucket_start + timedelta(seconds=step_seconds)
            b_at_risk = 0.0
            b_rec = 0.0
            for c in cases:
                c_dt = to_utc(c.created_at)
                if c_dt and bucket_start <= c_dt < bucket_end:
                    r = float(c.risk_amount or 0.0)
                    if c.status == "RECOVERED":
                        b_rec += float(c.recovery_outcome.recovered_amount) if (c.recovery_outcome and c.recovery_outcome.recovered_amount is not None) else r
                    else:
                        b_at_risk += r
            label = bucket_start.strftime("%b %d" if tr != "24h" else "%H:%M")
            trend_data.append(TrendPoint(
                date=label,
                at_risk=round(b_at_risk, 2),
                recovered=round(b_rec, 2),
                target=round(b_at_risk * 0.70, 2)
            ))

        # 5. Build Strategy Performance from genuine cases
        strategy_labels = {
            "SMART_PAYLINK_1CLICK": "Dynamic 1-Click Paylink",
            "UPI_INTENT_FALLBACK": "UPI Intent Instant Fallback",
            "TIMED_SMART_RETRY": "Timed Smart Retry (Off-Peak/Salary)",
            "INCENTIVIZED_DUNNING": "AI Incentivized Dunning Email",
            "WHATSAPP_CONCIERGE": "WhatsApp Payment Concierge",
            "RETRY_NOW": "Direct Instant Gateway Retry"
        }
        strategy_performance: List[StrategyMetric] = []
        for skey, sdata in strategy_stats.items():
            att = sdata["attempts"]
            succ = sdata["success"]
            rec_val = round(sdata["recovered"], 2)
            s_rate = round((succ / att * 100) if att > 0 else 0.0, 2)
            avg_time = round((sdata["total_time"] / (succ * 60)) if succ > 0 else 0.0, 1)
            strategy_performance.append(StrategyMetric(
                strategy=strategy_labels.get(skey, skey.replace("_", " ").title()),
                strategy_key=skey,
                attempts=att,
                success_count=succ,
                recovery_rate=s_rate,
                recovered_amount=rec_val,
                avg_recovery_time_minutes=avg_time
            ))
        strategy_performance.sort(key=lambda x: x.recovered_amount, reverse=True)

        # 6. Build Payment Breakdown from genuine cases
        payment_breakdown: List[PaymentBreakdown] = []
        for p_method, p_data in payment_stats.items():
            vol = p_data["volume"]
            r_amt = round(p_data["recovered"], 2)
            l_amt = round(p_data["loss"], 2)
            p_rate = round((r_amt / (r_amt + l_amt) * 100) if (r_amt + l_amt) > 0 else 0.0, 2)
            payment_breakdown.append(PaymentBreakdown(
                method=p_method,
                volume=vol,
                recovered_amount=r_amt,
                loss_amount=l_amt,
                recovery_rate=p_rate
            ))
        payment_breakdown.sort(key=lambda x: x.recovered_amount, reverse=True)

        # 7. Build Failure Reasons from genuine cases
        failure_reasons: List[FailureReasonBreakdown] = []
        for f_cat, f_data in failure_stats.items():
            tot = round(f_data["total"], 2)
            rec = round(f_data["recovered"], 2)
            fr_rate = round((rec / tot * 100) if tot > 0 else 0.0, 2)
            failure_reasons.append(FailureReasonBreakdown(
                category=f_cat,
                label=f_cat.replace("_", " ").title(),
                count=f_data["count"],
                total_amount=tot,
                recovered_amount=rec,
                recovery_rate=fr_rate
            ))
        failure_reasons.sort(key=lambda x: x.total_amount, reverse=True)

        # 8. Recent Agent Decisions from DB (Scoped by workspace)
        recent_cases_q = (
            self.db.query(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .join(Customer, Transaction.customer_id == Customer.id)
            .order_by(desc(RecoveryCase.created_at))
        )
        if workspace_id:
            recent_cases_q = recent_cases_q.filter(RecoveryCase.workspace_id == workspace_id)
        recent_cases = recent_cases_q.limit(5).all()

        recent_activities: List[RecentAgentActivity] = []
        for rc in recent_cases:
            customer_name = (
                rc.transaction.customer.name
                if rc.transaction and rc.transaction.customer
                else "Valued Merchant Customer"
            )
            recent_activities.append(
                RecentAgentActivity(
                    id=f"act_{rc.id}",
                    timestamp=rc.created_at.isoformat() if rc.created_at else "",
                    transaction_id=rc.transaction_id,
                    customer_name=customer_name,
                    amount=rc.risk_amount,
                    action=rc.selected_strategy or "NO_ACTION",
                    status="SUCCESS" if rc.status == "RECOVERED" else "EXECUTED",
                    erv=rc.expected_recovery_value or 0.0,
                    explanation=f"Autonomous diagnosis for {rc.failure_category.replace('_', ' ').title()}. Selected {rc.selected_strategy} with ERV ₹{rc.expected_recovery_value:,.0f}."
                )
            )

        # 9. Explicit Data Mode Determination
        if is_demo_dataset:
            data_mode = "Demo Dataset"
        elif is_simulation_dataset:
            data_mode = "SIMULATED DATA"
        else:
            data_mode = "LIVE TEST DATA"

        return DashboardResponse(
            metrics=metrics,
            trend_data=trend_data,
            strategy_performance=strategy_performance,
            payment_breakdown=payment_breakdown,
            failure_reasons=failure_reasons,
            recent_activities=recent_activities,
            data_mode=data_mode,
            workspace_id=workspace_id
        )
