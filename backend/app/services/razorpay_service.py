import hmac
import hashlib
import time
import uuid
from typing import Optional, Dict, Any
from datetime import datetime
import httpx
from app.core.config import settings
from app.core.logging import logger

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

class RazorpayService:
    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None
    ):
        self.key_id = key_id or settings.RAZORPAY_KEY_ID
        self.key_secret = key_secret or settings.RAZORPAY_KEY_SECRET

    @property
    def is_configured(self) -> bool:
        """
        Determines whether genuine Razorpay credentials are configured.
        Placeholders like 'test_secret_placeholder' or empty keys are considered unconfigured.
        """
        if not self.key_id or not self.key_secret:
            return False
        if "placeholder" in self.key_secret.lower() or "placeholder" in self.key_id.lower():
            return False
        return True

    def create_order(
        self,
        amount_paise: int,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Creates a genuine Razorpay order server-side via POST /v1/orders.
        Strictly fails closed: if Razorpay API fails or is unreachable, does NOT
        generate a fake order_* fallback. Raises RuntimeError with safe message.
        """
        if not self.is_configured:
            logger.error("Razorpay order creation aborted: Gateway credentials are not configured.")
            raise RuntimeError("Payment service temporarily unavailable.")

        receipt = receipt or f"rcpt_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {}
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{RAZORPAY_API_BASE}/orders",
                    auth=(self.key_id, self.key_secret),
                    json=payload
                )
                if resp.status_code in (200, 201):
                    order_data = resp.json()
                    logger.info(f"Razorpay order successfully created via Gateway API: {order_data.get('id')}")
                    return order_data
                else:
                    logger.error(
                        f"Razorpay API rejected order creation with status {resp.status_code}: {resp.text}"
                    )
                    raise RuntimeError("Payment service temporarily unavailable.")
        except httpx.HTTPError as exc:
            logger.error(f"Failed to communicate with Razorpay API during order creation: {exc}")
            raise RuntimeError("Payment service temporarily unavailable.")
        except RuntimeError:
            raise
        except Exception as exc:
            logger.error(f"Unexpected error communicating with Razorpay API: {exc}")
            raise RuntimeError("Payment service temporarily unavailable.")

    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """
        Cryptographically verifies the Razorpay payment signature using HMAC SHA-256.
        Formula: HMAC-SHA256(order_id + "|" + payment_id, secret) == signature
        Uses constant-time comparison (hmac.compare_digest) to prevent timing attacks.
        """
        if not self.key_secret:
            logger.error("Signature verification failed: RAZORPAY_KEY_SECRET is not configured.")
            return False

        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            logger.warning("Signature verification rejected: Missing required identifier or signature.")
            return False

        message = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
        secret_bytes = self.key_secret.encode("utf-8")

        generated_signature = hmac.new(
            secret_bytes,
            message,
            hashlib.sha256
        ).hexdigest()

        is_valid = hmac.compare_digest(generated_signature, razorpay_signature)
        if not is_valid:
            logger.warning(
                f"Signature verification mismatch for Order {razorpay_order_id} & Payment {razorpay_payment_id}."
            )
        else:
            logger.info(f"Payment signature verified successfully for Order {razorpay_order_id}")

        return is_valid

    def fetch_payment_details(self, razorpay_payment_id: str) -> Dict[str, Any]:
        """
        Fetches payment attributes directly from Razorpay (GET /v1/payments/{id}).
        Strictly fails closed: if Razorpay API is unreachable or returns error,
        it does NOT fabricate status='captured'. Returns status='unverified' so
        the caller rejects unverified payments.
        """
        if not self.is_configured:
            logger.error(f"Cannot fetch payment {razorpay_payment_id}: Razorpay credentials unconfigured.")
            return {
                "id": razorpay_payment_id,
                "status": "unverified",
                "error": "Gateway credentials unconfigured",
                "amount": 0,
                "currency": "INR"
            }

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(
                    f"{RAZORPAY_API_BASE}/payments/{razorpay_payment_id}",
                    auth=(self.key_id, self.key_secret)
                )
                if resp.status_code == 200:
                    return resp.json()
                logger.warning(
                    f"Fetch payment {razorpay_payment_id} returned HTTP {resp.status_code}: {resp.text}"
                )
                return {
                    "id": razorpay_payment_id,
                    "status": "unverified",
                    "error": f"Gateway returned status {resp.status_code}",
                    "amount": 0,
                    "currency": "INR"
                }
        except Exception as e:
            logger.error(f"Error fetching payment details from Razorpay: {e}")
            return {
                "id": razorpay_payment_id,
                "status": "unverified",
                "error": str(e),
                "amount": 0,
                "currency": "INR"
            }

    def verify_webhook_signature(
        self,
        raw_body: bytes,
        signature: str,
        secret: Optional[str] = None
    ) -> bool:
        """
        Cryptographically verifies Razorpay webhook signature over the exact raw body bytes.
        Formula: HMAC-SHA256(raw_body_bytes, webhook_secret) == signature
        Never logs secrets.
        """
        webhook_secret = secret or settings.RAZORPAY_WEBHOOK_SECRET
        if not webhook_secret:
            logger.error("Webhook signature verification failed: RAZORPAY_WEBHOOK_SECRET is not configured.")
            return False

        secret_bytes = webhook_secret.encode("utf-8")
        generated_signature = hmac.new(
            secret_bytes,
            raw_body,
            hashlib.sha256
        ).hexdigest()

        is_valid = hmac.compare_digest(generated_signature, signature)
        if not is_valid:
            logger.warning("Webhook HMAC signature mismatch. Request untrusted.")
        return is_valid

    def create_payment_link(
        self,
        amount_paise: int,
        customer_name: str,
        customer_email: str,
        customer_contact: Optional[str] = None,
        description: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None,
        reference_id: Optional[str] = None,
        is_live_demo: bool = True
    ) -> Dict[str, Any]:
        """
        Creates a genuine Razorpay Test Payment Link via POST /v1/payment_links.
        Strictly requires valid Razorpay response (id starting with plink_, short_url starting with https://rzp.io/).
        Never constructs a fake rzp.io short URL locally.
        """
        desc = description or "RecoverAI payment recovery"
        ref_id = reference_id or f"rcov_{uuid.uuid4().hex[:10]}_{int(time.time())}"

        # Clean customer details
        cust_payload: Dict[str, Any] = {
            "name": (customer_name or "Valued Customer").strip()
        }
        if customer_email and "@" in customer_email:
            cust_payload["email"] = customer_email.strip()
        if customer_contact:
            # Keep digits and + sign
            clean_phone = "".join(c for c in customer_contact if c.isdigit() or c == "+")
            if len(clean_phone) >= 10:
                cust_payload["contact"] = clean_phone

        merged_notes = dict(notes or {})
        merged_notes.setdefault("environment", "test")

        payload: Dict[str, Any] = {
            "amount": int(amount_paise),
            "currency": "INR",
            "accept_partial": False,
            "reference_id": ref_id,
            "description": desc[:255],
            "customer": cust_payload,
            "notify": {
                "sms": False,
                "email": False
            },
            "reminder_enable": False,
            "notes": merged_notes
        }

        last_error = None

        if self.is_configured and is_live_demo:
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        f"{RAZORPAY_API_BASE}/payment_links",
                        auth=(self.key_id, self.key_secret),
                        json=payload
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        plink_id = data.get("id") or ""
                        short_url = data.get("short_url") or ""
                        status = data.get("status") or ""

                        # Strict validation of Razorpay response fields
                        if (
                            plink_id.startswith("plink_")
                            and short_url.startswith("https://rzp.io/")
                            and status == "created"
                        ):
                            logger.info(f"Genuine Razorpay Test Payment Link created: {plink_id} -> {short_url}")
                            created_ts = data.get("created_at", int(time.time()))
                            return {
                                "success": True,
                                "payment_link_id": plink_id,
                                "short_url": short_url,
                                "amount": float(data.get("amount", amount_paise)) / 100.0,
                                "status": status,
                                "reference_id": data.get("reference_id", ref_id),
                                "created_at": datetime.utcfromtimestamp(created_ts),
                                "is_live_demo": True,
                                "raw_response": data
                            }
                        else:
                            last_error = f"Invalid response from Razorpay: id={plink_id}, short_url={short_url}, status={status}"
                            logger.error(last_error)
                    else:
                        try:
                            err_body = resp.json().get("error", {})
                            safe_desc = err_body.get("description") or err_body.get("reason") or f"HTTP {resp.status_code}"
                        except Exception:
                            safe_desc = f"HTTP {resp.status_code}"
                        last_error = f"Razorpay Payment Link API error ({resp.status_code}): {safe_desc}"
                        logger.warning(last_error)
            except Exception as exc:
                last_error = f"Failed to reach Razorpay Payment Link API: {exc}"
                logger.error(last_error)

        if is_live_demo:
            # If live demo was requested but failed, raise exception so caller handles safely without fake URL
            raise RuntimeError(last_error or "Razorpay Gateway credentials unconfigured or unreachable")

        # Explicit local simulation fallback (only when is_live_demo is False)
        fallback_id = f"demo_plink_{uuid.uuid4().hex[:10]}"
        base_url = settings.FRONTEND_PUBLIC_URL.rstrip('/')
        fallback_url = f"{base_url}/demo-checkout?payment_link_id={fallback_id}&amount={round(amount_paise / 100.0, 2)}"
        logger.info(f"Generated local demo Payment Link: {fallback_id} -> {fallback_url}")
        return {
            "success": True,
            "payment_link_id": fallback_id,
            "short_url": fallback_url,
            "amount": round(amount_paise / 100.0, 2),
            "status": "created",
            "reference_id": ref_id,
            "created_at": datetime.utcnow(),
            "is_live_demo": False,
            "raw_response": {"id": fallback_id, "short_url": fallback_url}
        }

    def fetch_payment_link(self, payment_link_id: str) -> Dict[str, Any]:
        """
        Fetches payment link status and details directly from Razorpay.
        """
        if self.is_configured and payment_link_id.startswith("plink_"):
            try:
                with httpx.Client(timeout=8.0) as client:
                    resp = client.get(
                        f"{RAZORPAY_API_BASE}/payment_links/{payment_link_id}",
                        auth=(self.key_id, self.key_secret)
                    )
                    if resp.status_code == 200:
                        return resp.json()
                    logger.warning(f"Fetch payment link {payment_link_id} returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error fetching payment link from Razorpay: {e}")

        return {
            "id": payment_link_id,
            "status": "created",
            "amount": 0
        }

razorpay_service = RazorpayService()
