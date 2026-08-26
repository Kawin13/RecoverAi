from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id = Column(String(64), primary_key=True, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id"), nullable=False, unique=True, index=True)
    risk_amount = Column(Float, nullable=False)
    failure_category = Column(String(64), nullable=False)
    recovery_probability = Column(Float, default=0.0)
    selected_strategy = Column(String(64), default="SMART_PAYLINK_1CLICK")
    expected_recovery_value = Column(Float, default=0.0)
    status = Column(String(32), default="DETECTED")  # DETECTED, ANALYZED, STRATEGY_SELECTED, GUARDRAIL_CHECKED, ACTION_SCHEDULED, ACTION_EXECUTED, WAITING_FOR_CUSTOMER, RECOVERED, FAILED, NEXT_STRATEGY, ESCALATED, STOPPED
    current_step = Column(String(64), default="DETECTED")
    max_attempts = Column(Integer, default=3)
    attempt_count = Column(Integer, default=1)
    channel = Column(String(32), default="IN_APP")  # IN_APP, EMAIL_SIMULATION, SMS_SIMULATION, WHATSAPP_SIMULATION
    scheduled_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    execution_payload = Column(String(2048), nullable=True)
    checkout_session_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    recovered_at = Column(DateTime, nullable=True)

    # Relationships
    transaction = relationship("Transaction", back_populates="recovery_case")
    recovery_actions = relationship("RecoveryAction", back_populates="recovery_case", cascade="all, delete-orphan")
    payment_links = relationship("PaymentLink", back_populates="recovery_case", cascade="all, delete-orphan")
    agent_decisions = relationship("AgentDecision", back_populates="recovery_case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="recovery_case")
    guardrail_events = relationship("GuardrailEvent", back_populates="recovery_case")
    recovery_outcome = relationship("RecoveryOutcome", back_populates="recovery_case", uselist=False, cascade="all, delete-orphan")
