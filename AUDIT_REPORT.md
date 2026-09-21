# RecoverAI — Complete Repository Audit Report (Phase 0)

**Date**: 2026-09-21  
**Auditor**: Antigravity AI Engineering  
**Repository**: [https://github.com/Kawin13/RecoverAi.git](https://github.com/Kawin13/RecoverAi.git)  
**Target Milestone**: RecoverAI Product V1 — Multi-Merchant AI Revenue Recovery SaaS  

---

## 1. Executive Baseline Validation Summary

Before applying any source code modifications, a comprehensive baseline verification was executed on the current repository state:

### 1.1 Backend Baseline Validation
- **Command**: `python -m pytest`
- **Collected**: 243 items
- **Baseline Result**: **238 passed, 5 failed** in 55.10s
- **Primary Failure Modes**:
  1. `tests/test_phase10_admin_quality.py` (5 failures):
     - `test_provider_accuracy_gmail_password_is_email`
     - `test_provider_accuracy_workspace_domain_google_oauth`
     - `test_last_sign_in_real_and_never_profile_updated_at`
     - `test_status_safe_derivation`
     - `test_concurrent_last_admin_demotion_race`
     - **Root Cause**: `get_current_user` in `backend/app/core/auth.py` enforces multi-tenant workspace membership (`resolve_user_workspace`). These 5 tests created test `Profile` entries but omitted `WorkspaceMember` records, causing `resolve_user_workspace` to raise `403 Forbidden` (`NO_WORKSPACE_MEMBERSHIP`) when testing the `/api/v1/admin/users` endpoints.
  2. `backend/app/core/auth.py`: Path parameter extraction bug where `{id}` was treated as `workspace_id`. This was previously removed, fixing 11 entity endpoint 403 errors across transactions, recovery cases, and decisions.

### 1.2 Frontend Baseline Validation
- **Command**: `npm ci`
  - **Result**: **SUCCESS** (Exit code 0, 190 packages audited in 28s)
- **Command**: `npm run build` (`tsc -b && vite build`)
  - **Result**: **SUCCESS** (Exit code 0, 2466 modules transformed in 12.15s)
  - **Warning**: Monolithic chunk `dist/assets/index-BHtJb8gs.js` is **1,279.26 kB** (Vite warning >500kB). All routes and heavy packages (Recharts) are statically bundled in `App.tsx`.
- **Command**: `npm run lint` (`tsc -b`)
  - **Result**: **SUCCESS** (Exit code 0, clean TypeScript check)

### 1.3 Database Migration Baseline
- **Command**: `python -m alembic check`
  - **Result**: **FAILED (New upgrade operations detected)**
  - **Root Cause**: Live PostgreSQL database schema is missing columns `integration_id`, `provider_event_id`, and constraints on `webhook_events` from models, plus `customer_messages` table for Phase 32 email notifications does not yet exist.

---

## 2. Detailed Findings & Vulnerability Matrix

| ID | Severity | File | Function / Component | Problem | Impact | Proposed Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | `backend/app/core/auth.py` | `get_current_user` (L228-232) | Route parameter `{id}` was previously treated as `requested_workspace_id`. | Any route taking `/entity/{id}` (transactions, cases, audit logs) checked membership in workspace ID equal to entity ID, causing false `403 Forbidden` errors across the platform. | Restrict workspace path parameter extraction strictly to `workspace_id` or explicit `X-Workspace-Id` header. Never parse generic `{id}`. |
| **SEC-02** | **CRITICAL** | `backend/app/models/*.py` | Multiple ORM Models (`transactions`, `recovery_cases`, `customers`, etc.) | Operational models define `default=DEFAULT_WORKSPACE_ID` on `workspace_id`. | Entities created without explicit workspace context silently contaminate the demo workspace instead of failing closed. | Remove `default=DEFAULT_WORKSPACE_ID` on production operational models. Enforce `nullable=False` and require explicit workspace assignment across all business routes. |
| **SEC-03** | **CRITICAL** | `backend/app/main.py` | `CORSMiddleware` (L86-90) | `allow_origins=settings.CORS_ORIGINS or ["*"]` combined with `allow_credentials=True`. | Security vulnerability and invalid CORS spec: wildcard origin `["*"]` with credentials permits cross-site credential leakage and browser security rejection. | Enforce explicit origin whitelist in production (Vercel domain). Reject wildcard `["*"]` when credentials are permitted. |
| **SEC-04** | **CRITICAL** | `backend/app/api/v1/endpoints/webhooks.py` | `razorpay_webhook_receiver` (L602) | Default webhook endpoint `/api/v1/webhooks/razorpay` silently processes events under `DEFAULT_WORKSPACE_ID`. | In production, webhook traffic directed to the generic path could cross-contaminate the demo workspace. | In production (`ENVIRONMENT == 'production'`), reject unmapped webhooks; require explicit merchant endpoint ID `/webhooks/razorpay/{endpoint_id}`. |
| **SEC-05** | **HIGH** | `frontend/src/services/api.ts` | Fallback catch blocks (L348-358) | When backend API requests fail, `api.ts` checks `if (ENV.DEMO_MODE)` and returns `mockMetrics`, `mockTransactions`, `mockAuditLogs`. | In production environments with demo mode enabled or network errors, users see fabricated financial data instead of honest loading/empty/error states. | Completely remove silent mock substitution from production API methods. Throw explicit errors to let React Query transition to `ErrorState` / `EmptyState`. |
| **SEC-06** | **HIGH** | `frontend/src/services/api.ts` | Full file (1,583 lines) | Monolithic API service handles auth, transactions, workspaces, analytics, settings, payments, and simulations in a single file. | Maintenance bottleneck, code duplication, large bundle size, and coupling between unrelated domains. | Refactor into modular domain clients: `authApi.ts`, `workspaceApi.ts`, `dashboardApi.ts`, `transactionApi.ts`, `recoveryApi.ts`, `paymentApi.ts`, `analyticsApi.ts`, `guardrailsApi.ts`, `auditApi.ts`, `notificationApi.ts`. |
| **SEC-07** | **HIGH** | `backend/app/api/v1/endpoints/events.py` | `verify_cryptographic_ticket` (L33, L70-75) | Consumed stream ticket tracking uses an in-memory Python dictionary `_consumed_tickets`. | In horizontal scaling (multiple Render/Kubernetes backend workers), tickets consumed on one instance can be replayed on another within the 60-second window. | Persist ticket consumption with database table or distributed cache with 60-second TTL. |
| **SEC-08** | **HIGH** | `backend/app/services/notification_service.py` | `send_recovery_notification` (L17-21, L81) | Notifications use simulated channels (`EMAIL_SIMULATION`) and unconditionally mark status as `DELIVERED`. | Violates strict product rule: claiming delivery without real provider confirmation. No real customer recovery emails are sent. | Implement real `NotificationService` with `EmailAdapter` using Resend REST API (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`), store in `customer_messages` table with real delivery lifecycle (`QUEUED`, `SENT`, `DELIVERED`, `FAILED`). |
| **SEC-09** | **HIGH** | `backend/app/services/workspace_service.py` | `configure_razorpay_integration` (L242-251) | `if cleaned_key_id.startswith("rzp_live_")` check is positioned after `if not cleaned_key_id.startswith("rzp_test_")`. | Live keys receive generic "Invalid Key ID" rather than explicit "LIVE MODE REJECTED" security notice. | Reorder checks to explicitly block and log any `rzp_live_` key submission before generic format validation. |
| **SEC-10** | **HIGH** | `backend/alembic/versions/` & live database | Alembic Schema Drift | `alembic check` reports missing columns and indices on `webhook_events` and missing `customer_messages` table. | Fresh DB migration or live deployment will fail checks or miss required notification tracking. | Create migration `f7a2b3c4d5e6_add_customer_messages_and_sync_schema.py` to add `customer_messages` and align constraints. |
| **SEC-11** | **MEDIUM** | `backend/app/core/config_validator.py` | `validate_startup_config` | Missing production validations for `DEBUG=False`, `USE_SQLITE=False`, `SEED_DEMO_DATA=False`, `APP_ENCRYPTION_KEY`, and Resend settings. | In production, misconfigured debug flags or fallback keys can slip through startup undetected. | Add strict checks for all Phase 42 variables in `validate_startup_config`. |
| **SEC-12** | **MEDIUM** | `frontend/src/App.tsx` | Route definitions | All application pages and heavy chart libraries (Recharts) are statically imported in `App.tsx`. | Initial bundle size is **1,279.26 kB** (Vite warning >500kB), slowing initial page load. | Implement route-level code splitting using `React.lazy()` and `Suspense`, plus Rollup manual chunking. |
| **SEC-13** | **MEDIUM** | `backend/app/api/v1/endpoints/health.py` | Route registration | Health probes are registered only at `/health` and `/readiness`. | Reverse proxies or clients expecting `/api/health` or `/api/readiness` (per Phase 41 spec) receive 404. | Mount health and readiness routes at both `/health`, `/readiness` and `/api/health`, `/api/readiness`, `/api/v1/health`, `/api/v1/readiness`. |
| **SEC-14** | **LOW** | `frontend/src/pages/DemoCheckout.tsx` | UI Text (L357) | Mentions "(Local Mock Mode)" in banner. | Confuses merchants testing genuine Razorpay Test Mode. | Update copy to "Razorpay Test Mode Active (Sandbox Rail)". |

---

## 3. Systematic Action Plan (Phases 1 to 54)

See the comprehensive [implementation_plan.md](file:///C:/Users/kawin/.gemini/antigravity-ide/brain/97fd539a-f6d7-433a-b0b5-8154ec299ae5/implementation_plan.md) for the phased execution roadmap.
