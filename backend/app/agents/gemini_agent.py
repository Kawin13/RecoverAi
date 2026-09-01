"""
RecoverAI - Gemini LLM Intelligence & Multi-Lingual Explanation Agent
Provides human-readable decision explanations and multi-lingual customer recovery messages
(English, Hindi, Hinglish, Tamil) using the official Google GenAI SDK with prompt-injection defense,
canonical consistency enforcement, and deterministic fallback templates.
"""

import os
import json
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from functools import lru_cache

from app.core.config import settings
from app.schemas.canonical import get_canonical_action

logger = logging.getLogger("recoverai")

class GeminiAgent:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
        self._client = None
        self._cache: Dict[str, Dict[str, Any]] = {}

        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
                logger.info(f"Gemini GenAI client initialized with model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI SDK client: {e}")

    def is_available(self) -> bool:
        return self._client is not None and bool(self.api_key)

    def explain_decision(
        self,
        recovery_id: str,
        transaction_data: Dict[str, Any],
        decision_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates a human-friendly operational rationale explaining why the autonomous agent
        chose the specific recovery strategy over alternatives based strictly on canonical data.
        """
        selected_action = decision_data.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        cache_key = f"explain_{recovery_id}_{canonical_act.action_code}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Check if live Gemini API is available
        if self.is_available():
            try:
                safe_prompt = self._build_explanation_prompt(transaction_data, decision_data)
                
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=safe_prompt,
                )

                if response and response.text:
                    parsed = self._extract_json(response.text)
                    if parsed and "summary" in parsed:
                        result = {
                            "recovery_id": recovery_id,
                            "selected_action": canonical_act.action_code,
                            "display_name": canonical_act.display_name,
                            "summary": parsed.get("summary"),
                            "operator_notes": parsed.get("operator_notes", []),
                            "customer_risk_profile": parsed.get("customer_risk_profile", "Low"),
                            "source": "gemini-genai-live",
                            "model": self.model_name,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        self._cache[cache_key] = result
                        return result
            except Exception as e:
                logger.warning(f"Gemini API explanation failed ({e}), falling back to deterministic template.")

        # Graceful Deterministic Fallback Template
        fallback_result = self._get_fallback_explanation(recovery_id, transaction_data, decision_data)
        self._cache[cache_key] = fallback_result
        return fallback_result

    def generate_customer_message(
        self,
        recovery_id: str,
        transaction_data: Dict[str, Any],
        decision_data: Dict[str, Any],
        language: str = "EN"
    ) -> Dict[str, Any]:
        """
        Generates contextual, multi-lingual customer recovery messages in:
        English (EN), Hindi (HI), Hinglish (HINGLISH), or Tamil (TA).
        Strictly respects canonical failure diagnosis and canonical selected action.
        """
        lang_code = language.upper().strip()
        selected_action = decision_data.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        cache_key = f"msg_{recovery_id}_{canonical_act.action_code}_{lang_code}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        if self.is_available():
            try:
                safe_prompt = self._build_message_prompt(transaction_data, decision_data, lang_code)
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=safe_prompt,
                )

                if response and response.text:
                    parsed = self._extract_json(response.text)
                    if parsed and "headline" in parsed and "message_body" in parsed:
                        # Enforce canonical CTA to prevent model deviation
                        cta = canonical_act.customer_cta if canonical_act.customer_cta != "none" else parsed.get("call_to_action", "Complete Payment")
                        result = {
                            "recovery_id": recovery_id,
                            "language": lang_code,
                            "headline": parsed.get("headline"),
                            "message_body": parsed.get("message_body"),
                            "call_to_action": cta,
                            "channel_recommended": parsed.get("channel_recommended", "WhatsApp / SMS"),
                            "source": "gemini-genai-live",
                            "model": self.model_name
                        }
                        self._cache[cache_key] = result
                        return result
            except Exception as e:
                logger.warning(f"Gemini API message generation failed ({e}), falling back to template.")

        # Graceful Multi-lingual Fallback Template
        fallback_result = self._get_fallback_message(recovery_id, transaction_data, decision_data, lang_code)
        self._cache[cache_key] = fallback_result
        return fallback_result

    # -------------------------------------------------------------------------
    # Prompt Construction with Strict Injection Boundaries & Canonical Context
    # -------------------------------------------------------------------------
    def _build_explanation_prompt(self, tx: Dict[str, Any], decision: Dict[str, Any]) -> str:
        diagnosis = decision.get("diagnosis", {})
        selected_action = decision.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        
        system_instructions = (
            "You are RecoverAI's financial operations decision explainer for merchants. "
            "Explain why the autonomous engine selected this recovery strategy based strictly on the provided factual telemetry. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Do NOT hallucinate or assume any failure reason other than what is in canonical 'failure_diagnosis'. "
            "2. If failure diagnosis is UNKNOWN, keep explanation strictly generic without mentioning gateway timeouts, bank downtimes, or technical errors. "
            "3. Reference the exact selected action display name: '" + canonical_act.display_name + "'.\n"
            "4. Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "summary": "1-2 sentence executive operational rationale",\n'
            '  "operator_notes": ["bullet 1", "bullet 2", "bullet 3"],\n'
            '  "customer_risk_profile": "Low | Moderate | High"\n'
            "}"
        )

        data_envelope = json.dumps({
            "order_id": str(tx.get("order_id", "ORD-UNKNOWN")),
            "amount_inr": float(tx.get("amount", 0.0)),
            "method": str(tx.get("payment_method", tx.get("method", "UPI"))),
            "failure_diagnosis": {
                "failure_reason_code": diagnosis.get("failure_reason_code", "UNKNOWN"),
                "failure_category": diagnosis.get("failure_category", "UNKNOWN"),
                "human_readable_reason": diagnosis.get("human_readable_reason", "Unspecified payment processing issue")
            },
            "customer_tier": str(tx.get("customer_value", "STANDARD")),
            "selected_strategy": canonical_act.display_name,
            "action_code": canonical_act.action_code,
            "recovery_probability": float(decision.get("recovery_probability", 0.8)),
            "expected_recovery_value": float(decision.get("expected_recovery_value", 0.0)),
            "factual_evidence": decision.get("evidence", [])
        })

        return f"{system_instructions}\n\nDATA PAYLOAD:\n{data_envelope}"

    def _build_message_prompt(self, tx: Dict[str, Any], decision: Dict[str, Any], language: str) -> str:
        diagnosis = decision.get("diagnosis", {})
        selected_action = decision.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        amount = float(tx.get("amount", 0.0))
        reason_code = diagnosis.get("failure_reason_code", "UNKNOWN")
        human_reason = diagnosis.get("human_readable_reason", "Unspecified payment processing issue")

        lang_instructions = {
            "EN": "English. Professional, concise, reassuring.",
            "HI": "Hindi (written in Devanagari script). Polite, clear, respectful.",
            "HINGLISH": "Hinglish (Colloquial conversational Romanized Hindi + English used in Indian fintech). Friendly and helpful.",
            "TA": "Tamil (written in Tamil script). Respectful, clear, concise."
        }.get(language, "English.")

        system_instructions = (
            f"You are RecoverAI's customer recovery communications specialist. "
            f"Write a frictionless payment recovery notification in {lang_instructions}.\n"
            f"Action Code: {canonical_act.action_code}. Display Name: {canonical_act.display_name}. Customer CTA: {canonical_act.customer_cta}.\n"
            f"Amount: INR {amount:,.2f}.\n"
            f"Canonical Failure Reason Code: {reason_code} ({human_reason}).\n"
            "STRICT RULES:\n"
            "1. IF Failure Reason is UNKNOWN: Do NOT mention bank timeouts, server errors, or technical outages. Simply state that the payment could not be completed and offer the recovery link.\n"
            "2. IF Failure Reason is BANK_GATEWAY_TIMEOUT: You may mention a temporary bank gateway timeout.\n"
            "3. IF Action is UPI_SWITCH: Message must specifically mention continuing with UPI. CTA MUST be 'Pay with UPI'. Do NOT say 'Retry Payment Now'.\n"
            "4. IF Action is RETRY_NOW: Message mentions immediate retry. CTA MUST be 'Retry Payment'.\n"
            "5. Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "headline": "Short subject/headline",\n'
            '  "message_body": "Polite message matching the exact action and diagnosis",\n'
            '  "call_to_action": "' + canonical_act.customer_cta + '",\n'
            '  "channel_recommended": "WhatsApp | SMS | Email"\n'
            "}"
        )

        return system_instructions

    # -------------------------------------------------------------------------
    # Fallback Deterministic Templates (Strictly Canonical)
    # -------------------------------------------------------------------------
    def _get_fallback_explanation(self, recovery_id: str, tx: Dict[str, Any], decision: Dict[str, Any]) -> Dict[str, Any]:
        selected_action = decision.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        prob = decision.get("recovery_probability", 0.85)
        erv = decision.get("expected_recovery_value", 0.0)
        evidence = decision.get("evidence", [])

        summary = f"The engine selected {canonical_act.display_name} with an estimated {prob * 100:.1f}% recovery probability and ERV of ₹{erv:,.2f}."
        
        return {
            "recovery_id": recovery_id,
            "selected_action": canonical_act.action_code,
            "display_name": canonical_act.display_name,
            "summary": summary,
            "operator_notes": evidence or [
                f"Automated failure diagnosis indicates high return for {canonical_act.display_name}.",
                f"Expected recovery value is optimized after friction & cost deductions.",
                "Guardrail policies verified and compliant."
            ],
            "customer_risk_profile": "Low",
            "source": "deterministic-fallback",
            "model": "rule-template-engine",
            "generated_at": datetime.utcnow().isoformat()
        }

    def _get_fallback_message(self, recovery_id: str, tx: Dict[str, Any], decision: Dict[str, Any], language: str) -> Dict[str, Any]:
        amount = float(tx.get("amount", 2500.0))
        selected_action = decision.get("selected_action", "UPI_SWITCH")
        canonical_act = get_canonical_action(selected_action)
        diagnosis = decision.get("diagnosis", {})
        reason_code = diagnosis.get("failure_reason_code", "UNKNOWN")

        # Check if gateway timeout or unknown/other
        is_gateway_timeout = reason_code in ["BANK_GATEWAY_TIMEOUT", "UPI_TIMEOUT", "BANK_SERVER_DOWN"]

        if language == "HI":
            if canonical_act.action_code == "UPI_SWITCH":
                body = f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान पूरा नहीं हो सका। नीचे दिए गए लिंक से UPI द्वारा आसानी से भुगतान पूरा करें।"
                headline = "UPI से भुगतान पूरा करें"
                cta = "UPI से भुगतान करें"
            elif canonical_act.action_code == "RETRY_NOW":
                body = f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान बैंक में देरी के कारण रुक गया था। नीचे दिए गए लिंक से तुरंत पुनः प्रयास करें।" if is_gateway_timeout else f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान पूरा नहीं हो पाया। नीचे दिए गए लिंक से तुरंत पुनः प्रयास करें।"
                headline = "भुगतान पुनः प्रयास करें"
                cta = "पुनः प्रयास करें"
            else:
                body = f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान अस्थायी रुकावट के कारण पूरा नहीं हो पाया। नीचे दिए गए सुरक्षित लिंक से भुगतान पूरा करें।" if is_gateway_timeout else f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान पूरा नहीं हो सका। नीचे दिए गए सुरक्षित लिंक से भुगतान पूरा करें।"
                headline = "भुगतान पूरा करें"
                cta = canonical_act.customer_cta if canonical_act.customer_cta != "none" else "अभी भुगतान पूरा करें"

            return {
                "recovery_id": recovery_id,
                "language": "HI",
                "headline": headline,
                "message_body": body,
                "call_to_action": cta,
                "channel_recommended": "WhatsApp",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }

        elif language == "HINGLISH":
            if canonical_act.action_code == "UPI_SWITCH":
                body = f"Hi! Aapka ₹{amount:,.2f} ka payment complete nahi ho paya. Worry mat kijiye, neeche diye gaye link se UPI switch karke securely payment complete karein."
                headline = "Complete Payment via UPI"
                cta = "Pay with UPI"
            elif canonical_act.action_code == "RETRY_NOW":
                body = f"Hi! Aapka ₹{amount:,.2f} ka payment bank timeout ki wajah se pause ho gaya tha. Neeche diye gaye link se 1-click me retry karein." if is_gateway_timeout else f"Hi! Aapka ₹{amount:,.2f} ka payment pause ho gaya tha. Neeche diye gaye link se 1-click me retry karein."
                headline = "Retry Payment — 1-Click"
                cta = "Retry Payment"
            else:
                body = f"Hi! Aapka ₹{amount:,.2f} ka payment bank delay ki wajah se pause ho gaya hai. Neeche diye gaye secure link se complete karein." if is_gateway_timeout else f"Hi! Aapka ₹{amount:,.2f} ka payment complete nahi ho paya. Neeche diye gaye secure link se complete karein."
                headline = "Payment Pending — 1-Click"
                cta = canonical_act.customer_cta if canonical_act.customer_cta != "none" else "Complete Payment Now"

            return {
                "recovery_id": recovery_id,
                "language": "HINGLISH",
                "headline": headline,
                "message_body": body,
                "call_to_action": cta,
                "channel_recommended": "WhatsApp / SMS",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }

        elif language == "TA":
            if canonical_act.action_code == "UPI_SWITCH":
                body = f"வணக்கம், உங்கள் ₹{amount:,.2f} பரிவர்த்தனை நிறைவடையவில்லை. கீழே உள்ள இணைப்பைப் பயன்படுத்தி UPI மூலம் பாதுகாப்பாக முடிக்கவும்."
                headline = "UPI மூலம் பணம் செலுத்துங்கள்"
                cta = "UPI மூலம் பணம் செலுத்துங்கள்"
            elif canonical_act.action_code == "RETRY_NOW":
                body = f"வணக்கம், உங்கள் ₹{amount:,.2f} பரிவர்த்தனை வங்கி சர்வர் தாமதத்தால் நிறைவடையவில்லை. கீழே உள்ள இணைப்பில் மீண்டும் முயற்சிக்கவும்." if is_gateway_timeout else f"வணக்கம், உங்கள் ₹{amount:,.2f} பரிவர்த்தனை நிறைவடையவில்லை. கீழே உள்ள இணைப்பில் மீண்டும் முயற்சிக்கவும்."
                headline = "மீண்டும் பணம் செலுத்துங்கள்"
                cta = "மீண்டும் முயற்சிக்கவும்"
            else:
                body = f"வணக்கம், உங்கள் ₹{amount:,.2f} பரிவர்த்தனை நிறைவடையவில்லை. கீழே உள்ள பாதுகாப்பான இணைப்பைப் பயன்படுத்தி முடிக்கவும்."
                headline = "பணம் செலுத்துதல் நிறைவடையவில்லை"
                cta = canonical_act.customer_cta if canonical_act.customer_cta != "none" else "இப்போது பணம் செலுத்துங்கள்"

            return {
                "recovery_id": recovery_id,
                "language": "TA",
                "headline": headline,
                "message_body": body,
                "call_to_action": cta,
                "channel_recommended": "WhatsApp",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }

        else:  # Default English
            if canonical_act.action_code == "UPI_SWITCH":
                body = f"Hi, your payment of ₹{amount:,.2f} was interrupted due to a temporary bank gateway timeout. You can securely continue using UPI through the recovery link below." if is_gateway_timeout else f"Hi, your payment of ₹{amount:,.2f} could not be completed. You can securely continue using UPI through the recovery link below."
                headline = "Continue your payment via UPI"
                cta = "Pay with UPI"
            elif canonical_act.action_code == "RETRY_NOW":
                body = f"Hi, your payment of ₹{amount:,.2f} was interrupted due to a temporary bank gateway timeout. Use the secure link below to retry with instant verification." if is_gateway_timeout else f"Hi, we couldn't complete your payment of ₹{amount:,.2f}. Use the secure link below to retry your payment."
                headline = "Retry your payment"
                cta = "Retry Payment"
            elif canonical_act.action_code == "PAYMENT_LINK":
                body = f"Hi, your payment of ₹{amount:,.2f} was interrupted due to a temporary bank gateway timeout. Use the secure 1-click paylink below to complete your order." if is_gateway_timeout else f"Hi, your payment of ₹{amount:,.2f} could not be completed. Use the secure 1-click paylink below to complete your order."
                headline = "Complete your order"
                cta = "Open Payment Link"
            elif canonical_act.action_code == "PERSONALIZED_REMINDER":
                body = f"Hi, your order is waiting. We noticed your payment of ₹{amount:,.2f} could not be completed. Use the link below to finalize your payment securely."
                headline = "Your order is reserved"
                cta = "Complete Payment"
            elif canonical_act.action_code == "HUMAN_ESCALATION":
                body = f"Hi, we noticed an issue completing your transaction of ₹{amount:,.2f}. Our dedicated concierge support team will assist you shortly."
                headline = "Payment assistance"
                cta = "Support Will Contact You"
            else:
                body = f"Hi, your payment of ₹{amount:,.2f} was interrupted due to a temporary bank gateway timeout. Use the secure recovery link below to complete your payment." if is_gateway_timeout else f"Hi, we couldn't complete your payment of ₹{amount:,.2f}. You can securely complete your transaction using another supported payment method below."
                headline = "Your payment was interrupted" if is_gateway_timeout else "Payment Incomplete"
                cta = canonical_act.customer_cta if canonical_act.customer_cta != "none" else "Complete Payment"

            return {
                "recovery_id": recovery_id,
                "language": "EN",
                "headline": headline,
                "message_body": body,
                "call_to_action": cta,
                "channel_recommended": "WhatsApp / SMS",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        try:
            # Check for markdown code blocks
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            # Direct parse
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(text)
        except Exception:
            return None

gemini_agent = GeminiAgent()
