# RecoverAI — Synthetic Indian Digital Payments Dataset Specification

## 1. Overview & Objectives

This specification documents the **35,000-record synthetic Indian digital payment transaction dataset** generated for RecoverAI. The dataset captures realistic failure distributions, customer tier behaviors, gateway downtime mechanics, and autonomous recovery intervention dynamics across India's digital payment ecosystem (UPI, Credit/Debit Cards, NetBanking, Digital Wallets, and E-NACH/UPI Autopay Mandates).

---

## 2. Statistical Profile & Key Metrics

| Metric | Measured Value | Target / Reference Range |
| :--- | :--- | :--- |
| **Total Rows** | `35,000` | $\ge 30,000$ |
| **Mean Transaction Amount** | `₹16,526.48` | Multi-tier Indian commerce |
| **Median Transaction Amount** | `₹6,900.22` | Realistic log-normal skew |
| **Overall Recovery Success Rate** | `76.55%` | High-intent merchant traffic |
| **Target Class Balance (`recovery_success`)**| `76.55% (1) / 23.45% (0)` | Balanced for ranking & propensity ML |
| **Total Recovered Value Ingested** | `₹46,98,12,464.56` | $46.98$ Crores INR |

---

## 3. Distribution Breakdown

### 3.1 Payment Method Distribution
| Payment Method | Percentage | Real-World Alignment |
| :--- | :--- | :--- |
| **UPI** | `52.71%` | Dominant consumer rail (PhonePe, GPay, Paytm) |
| **CARD** | `27.80%` | Visa, Mastercard, RuPay credit/debit cards |
| **NET_BANKING** | `9.79%` | Corporate and high-ticket consumer checkout |
| **WALLET** | `4.95%` | Stored-value mobile wallets |
| **MANDATE** | `4.75%` | E-NACH & UPI Autopay subscription renewals |

### 3.2 Failure Categories & Root Causes
- **Technical Timeouts (`31.04%`)**: `UPI_TIMEOUT` (14.53%), `BANK_SERVER_DOWN` (10.52%), `BANK_TIMEOUT` (5.99%).
- **Financial & Card Limits (`25.57%`)**: `INSUFFICIENT_FUNDS` (11.05%), `CARD_DECLINED` (6.03%), `BANK_DECLINED` (4.67%), `TRANSACTION_LIMIT` (3.83%).
- **Authentication Failures (`21.81%`)**: `UPI_PIN_FAILED` (8.86%), `OTP_FAILED` (8.13%), `AUTHENTICATION_FAILED` (4.83%).
- **Intent Abandonment (`13.35%`)**: `USER_CANCELLED` (6.70%), `CHECKOUT_ABANDONED` (4.62%), `SESSION_TIMEOUT` (2.03%).
- **Invalid Instrument (`5.12%`)**: `EXPIRED_CARD` (3.25%), `INVALID_CARD` (1.87%).
- **Mandate Issues (`3.11%`)**: `MANDATE_FAILED` (2.17%), `MANDATE_CANCELLED` (0.94%).

---

## 4. Probabilistic Physics & Behavioral Assumptions

The recovery likelihood ($P_{\text{recovery}}$) is derived from a calibrated logistic model:

1. **Customer Tier & LTV Affinity**:
   - `VIP`: **87.46%** recovery rate
   - `ENTERPRISE`: **84.80%** recovery rate
   - `GROWTH`: **80.55%** recovery rate
   - `STANDARD`: **70.86%** recovery rate
2. **Failure & Action Synergy**:
   - **Transient UPI/Bank Outages**: `UPI_INTENT_FALLBACK` & `SMART_PAYLINK_1CLICK` deliver **77.6%–82.2%** recovery by routing around faulty PSP switches.
   - **Expired Cards**: `CARD_UPDATE_PROMPT` achieves **71.8%** recovery, whereas naive immediate same-card retries fail.
   - **Cart Drops**: Recent checkout drop-offs (< 45s) recover at **75%+** when engaged via WhatsApp or 1-Click Paylinks.
   - **Repeated Attempt Fatigue**: Each subsequent retry attempt imposes a $-0.55$ logit decay penalty.

---

## 5. Dataset Files & Partitions

```text
data/
├── raw/
│   └── synthetic_transactions.csv   # Complete 35,000-row dataset (includes post-outcome telemetry)
└── processed/
    ├── training_data.csv            # Clean, leakage-free feature set (35,000 rows)
    ├── train.csv                    # 70% Training Partition (24,500 rows)
    ├── val.csv                      # 15% Validation Partition (5,250 rows)
    └── test.csv                     # 15% Test Partition (5,250 rows)
```

---

## 6. Data Leakage Prevention

- `recovery_delay_minutes` and `recovered_amount` are strictly treated as **post-outcome telemetry** and are excluded from `training_data.csv`, `train.csv`, `val.csv`, and `test.csv`.
- Machine learning models are trained exclusively on point-in-time features known at the precise millisecond of payment failure.
