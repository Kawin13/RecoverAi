# RecoverAI Product V1 - Deployment Checklist & Guide

This document outlines the requirements and manual steps to deploy RecoverAI to production environments (e.g., Vercel for Frontend, Render/Fly.io for Backend, and Supabase for Managed Database).

---

## 1. Environment Variable Reference

### Backend (`backend/.env`)
| Variable | Description | Example / Note |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Runtime mode | `production` |
| `DEBUG` | Enable debug logs/tracebacks | `False` |
| `DATABASE_URL` | Supabase / PostgreSQL URI | `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres` |
| `SUPABASE_URL` | Supabase Project URL | `https://[PROJECT_ID].supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase Service Role Key | `[SERVICE_ROLE_SECRET]` (Never expose to client) |
| `FRONTEND_URL` | Production Frontend Origin | `https://your-domain.vercel.app` |
| `FRONTEND_PUBLIC_URL` | Public Frontend Origin for payment redirect URLs | `https://your-domain.vercel.app` |
| `RAZORPAY_KEY_ID` | Test Mode Public Key | `rzp_test_...` (**TEST MODE ONLY**) |
| `RAZORPAY_KEY_SECRET` | Test Mode Secret Key | `...` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret | `...` |
| `RESEND_API_KEY` | Resend email provider key | `re_...` |
| `EMAIL_FROM` | Verified sender email | `support@yourdomain.com` |
| `GEMINI_API_KEY` | Google Gemini API Key | `...` |

### Frontend (`frontend/.env.production`)
| Variable | Description | Example / Note |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Production Backend API URL | `https://api.yourdomain.com` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://[PROJECT_ID].supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Key | `eyJ...` (Safe for browser) |
| `VITE_RAZORPAY_KEY_ID` | Test Mode Key ID | `rzp_test_...` |
| `VITE_DEMO_MODE` | Simulated demo data mode | `false` (Strict truthfulness in production) |

---

## 2. External Dashboard Actions (MANUAL ACTION REQUIRED)

> [!IMPORTANT]
> The following configurations must be performed directly within your provider dashboards:

### A. Supabase Dashboard
1. **Authentication Redirect URLs:**
   - Go to **Authentication** → **URL Configuration**.
   - Set **Site URL** to: `https://your-domain.vercel.app`
   - Add Redirect URLs:
     - `https://your-domain.vercel.app/auth/callback`
     - `https://your-domain.vercel.app/invite/**`
2. **Google OAuth Provider (Optional for Social Login):**
   - In **Authentication** → **Providers** → **Google**, enable Google provider.
   - Enter your Google Cloud Client ID and Secret.

### B. Resend Dashboard
1. **Domain Verification:**
   - Navigate to **Resend** → **Domains** → **Add Domain**.
   - Add the DKIM and SPF TXT records provided by Resend to your DNS registrar (Cloudflare, GoDaddy, etc.).
   - Ensure the domain status shows **Verified** before sending live notification emails.

### C. Razorpay Dashboard
1. **Test Mode Confirmation:**
   - Log in to your Razorpay Dashboard.
   - Ensure the environment toggle in the top-left is set to **Test Mode**.
   - Never generate or supply Live Mode credentials (`rzp_live_*`).

---

## 3. Deployment Steps

### Backend (Render / Fly.io / Docker)
1. **Database Migration:**
   Ensure the database is migrated before starting the application:
   ```bash
   alembic upgrade head
   ```
2. **Start Backend Web Server:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
   ```
3. **Start Background Recovery Worker (Autonomous 24/7):**
   Run as a standalone background worker service:
   ```bash
   python -m app.worker
   ```

### Frontend (Vercel)
1. Set Root Directory to: `frontend`
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Configure required environment variables (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
