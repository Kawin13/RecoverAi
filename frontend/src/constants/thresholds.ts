/**
 * RecoverAI - Canonical Business & Guardrail Thresholds
 * 
 * HUMAN_APPROVAL_THRESHOLD (₹10,000):
 * Fintech guardrail safety threshold requiring supervisor sign-off before
 * automated recovery dispatch can proceed.
 * 
 * URGENT_HIGH_VALUE_THRESHOLD (₹25,000):
 * Operational risk tiering threshold for urgent queue prioritization
 * and critical at-risk revenue triage.
 */

export const HUMAN_APPROVAL_THRESHOLD = 10000.0
export const URGENT_HIGH_VALUE_THRESHOLD = 25000.0
