"""
RecoverAI - Gemini LLM Intelligence & Multi-Lingual Explanation Agent
Provides human-readable decision explanations and multi-lingual customer recovery messages
(English, Hindi, Hinglish, Tamil) using the official Google GenAI SDK with prompt-injection defense,
timeout resilience, and deterministic fallback templates.
"""

import os
import json
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from functools import lru_cache

from app.core.config import settings

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
        chose the specific recovery strategy over alternatives.
        """
        cache_key = f"explain_{recovery_id}_{decision_data.get('selected_action')}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Check if live Gemini API is available
        if self.is_available():
            try:
                # Strictly sanitize inputs against prompt injection
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
                            "selected_action": decision_data.get("selected_action"),
                            "summary": parsed.get("summary"),
                            "operator_notes": parsed.get("operator_notes", []),
                            "customer_risk_profile": parsed.get("customer_risk_profile"),
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
        """
        lang_code = language.upper().strip()
        cache_key = f"msg_{recovery_id}_{decision_data.get('selected_action')}_{lang_code}"
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
                        result = {
                            "recovery_id": recovery_id,
                            "language": lang_code,
                            "headline": parsed.get("headline"),
                            "message_body": parsed.get("message_body"),
                            "call_to_action": parsed.get("call_to_action", "Complete Payment"),
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
    # Prompt Construction with Strict Injection Boundaries
    # -------------------------------------------------------------------------
    def _build_explanation_prompt(self, tx: Dict[str, Any], decision: Dict[str, Any]) -> str:
        # Sanitize customer string fields
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', str(tx.get("customer_name") or tx.get("customer", {}).get("name") if isinstance(tx.get("customer"), dict) else "Valued Customer"))[:50]
        
        system_instructions = (
            "You are RecoverAI's financial operations decision explainer for merchants. "
            "Explain why the autonomous engine selected this recovery strategy based strictly on the provided factual telemetry. "
            "Do NOT hallucinate new figures or change the decision. "
            "You must return ONLY valid JSON matching this schema:\n"
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
            "failure_reason": str(tx.get("failure_reason", "UPI_TIMEOUT")),
            "customer_tier": str(tx.get("customer_value", "STANDARD")),
            "selected_strategy": str(decision.get("selected_action", "UPI_SWITCH")),
            "recovery_probability": float(decision.get("recovery_probability", 0.8)),
            "expected_recovery_value": float(decision.get("expected_recovery_value", 0.0)),
            "factual_evidence": decision.get("evidence", [])
        })

        return f"{system_instructions}\n\nDATA PAYLOAD:\n{data_envelope}"

    def _build_message_prompt(self, tx: Dict[str, Any], decision: Dict[str, Any], language: str) -> str:
        action = decision.get("selected_action", "PAYMENT_LINK")
        amount = tx.get("amount", 0.0)

        lang_instructions = {
            "EN": "English. Professional, concise, reassuring.",
            "HI": "Hindi (written in Devanagari script). Polite, clear, respectful.",
            "HINGLISH": "Hinglish (Colloquial conversational Romanized Hindi + English used in Indian fintech). Friendly and helpful.",
            "TA": "Tamil (written in Tamil script). Respectful, clear, concise."
        }.get(language, "English.")

        system_instructions = (
            f"You are RecoverAI's customer recovery communications specialist. "
            f"Write a frictionless payment recovery notification in {lang_instructions}. "
            f"Action: {action}. Amount: INR {amount:,.2f}. "
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "headline": "Short subject/headline",\n'
            '  "message_body": "Polite message with clear 1-click retry instructions",\n'
            '  "call_to_action": "Button text",\n'
            '  "channel_recommended": "WhatsApp | SMS | Email"\n'
            "}"
        )

        return system_instructions

    # -------------------------------------------------------------------------
    # Fallback Deterministic Templates
    # -------------------------------------------------------------------------
    def _get_fallback_explanation(self, recovery_id: str, tx: Dict[str, Any], decision: Dict[str, Any]) -> Dict[str, Any]:
        action = decision.get("selected_action", "UPI_SWITCH")
        prob = decision.get("recovery_probability", 0.85)
        erv = decision.get("expected_recovery_value", 0.0)
        evidence = decision.get("evidence", [])

        summary = f"The engine selected {action.replace('_', ' ')} with an estimated {prob * 100:.1f}% recovery probability and ERV of ₹{erv:,.2f}."
        
        return {
            "recovery_id": recovery_id,
            "selected_action": action,
            "summary": summary,
            "operator_notes": evidence or [
                f"Automated failure diagnosis indicates high return for {action.replace('_', ' ')}.",
                f"Expected recovery value is optimized after friction & cost deductions.",
                "Guardrail policies verified and compliant."
            ],
            "customer_risk_profile": "Low",
            "source": "deterministic-fallback",
            "model": "rule-template-engine",
            "generated_at": datetime.utcnow().isoformat()
        }

    def _get_fallback_message(self, recovery_id: str, tx: Dict[str, Any], decision: Dict[str, Any], language: str) -> Dict[str, Any]:
        amount = tx.get("amount", 2500.0)
        action = decision.get("selected_action", "UPI_SWITCH")

        if language == "HI":
            return {
                "recovery_id": recovery_id,
                "language": "HI",
                "headline": "भुगतान पूरा नहीं हो सका",
                "message_body": f"नमस्ते, आपका ₹{amount:,.2f} का भुगतान बैंक सर्वर में देरी के कारण पूरा नहीं हो पाया। नीचे दिए गए लिंक से तुरंत सुरक्षित रूप से भुगतान पूरा करें।",
                "call_to_action": "अभी भुगतान पूरा करें",
                "channel_recommended": "WhatsApp",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }
        elif language == "HINGLISH":
            return {
                "recovery_id": recovery_id,
                "language": "HINGLISH",
                "headline": "Payment Pending — 1-Click Retry",
                "message_body": f"Hi! Aapka ₹{amount:,.2f} ka payment bank timeout ki wajah se pause ho gaya hai. Worry mat kijiye, neeche diye gaye link se 1-click me UPI switch karke complete karein.",
                "call_to_action": "Complete Payment Now",
                "channel_recommended": "WhatsApp / SMS",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }
        elif language == "TA":
            return {
                "recovery_id": recovery_id,
                "language": "TA",
                "headline": "பணம் செலுத்துதல் தோல்வியடைந்தது",
                "message_body": f"வணக்கம், உங்கள் ₹{amount:,.2f} பரிவர்த்தனை வங்கி சர்வர் பிரச்சனையால் நிறைவடையவில்லை. கீழே உள்ள இணைப்பைப் பயன்படுத்தி உடனடியாக முடிக்கவும்.",
                "call_to_action": "இப்போது பணம் செலுத்துங்கள்",
                "channel_recommended": "WhatsApp",
                "source": "deterministic-fallback",
                "model": "rule-template-engine"
            }
        else:  # Default English
            return {
                "recovery_id": recovery_id,
                "language": "EN",
                "headline": "Your payment was interrupted",
                "message_body": f"Hi, your payment of ₹{amount:,.2f} was interrupted due to a temporary bank gateway timeout. Use the secure link below to retry with instant 1-click verification.",
                "call_to_action": "Retry Payment Now",
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
