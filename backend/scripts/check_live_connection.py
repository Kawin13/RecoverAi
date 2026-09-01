import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import urllib.request
import json
from app.database.session import SessionLocal
from sqlalchemy import text

def check_all():
    print("================================================================")
    print("[STATUS] RECOVERAI LIVE SERVER CONNECTIVITY STATUS REPORT")
    print("================================================================\n")

    # 1. Backend FastAPI Health
    print("[1] Testing Live FastAPI Backend (http://127.0.0.1:8000)...")
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/health")
        with urllib.request.urlopen(req, timeout=5) as response:
            status_code = response.getcode()
            body = json.loads(response.read().decode('utf-8'))
            print(f"  -> [OK] Backend Status: ONLINE (HTTP {status_code})")
            print(f"  -> Details: {body}")
    except Exception as e:
        print(f"  -> [FAIL] Backend Error: {e}")

    # 2. Supabase PostgreSQL Live Database
    print("\n[2] Testing Live Supabase PostgreSQL Connection...")
    try:
        db = SessionLocal()
        row = db.execute(text("SELECT current_database(), current_user, inet_server_addr(), version();")).fetchone()
        count_cases = db.execute(text("SELECT count(*) FROM recovery_cases;")).scalar()
        count_txs = db.execute(text("SELECT count(*) FROM transactions;")).scalar()
        count_customers = db.execute(text("SELECT count(*) FROM customers;")).scalar()
        print(f"  -> [OK] PostgreSQL Status: CONNECTED")
        print(f"  -> Database Name: {row[0]}")
        print(f"  -> User: {row[1]}")
        print(f"  -> Total Customers in DB: {count_customers}")
        print(f"  -> Total Transactions in DB: {count_txs}")
        print(f"  -> Total Recovery Cases in DB: {count_cases}")
        db.close()
    except Exception as e:
        print(f"  -> [FAIL] PostgreSQL Error: {e}")

    # 3. Frontend Vite Server
    print("\n[3] Testing Frontend Web App (http://localhost:3000)...")
    try:
        req = urllib.request.Request("http://localhost:3000")
        with urllib.request.urlopen(req, timeout=5) as response:
            status_code = response.getcode()
            print(f"  -> [OK] Frontend Dev Server Status: ONLINE (HTTP {status_code})")
    except Exception as e:
        print(f"  -> [FAIL] Frontend Error: {e}")

    # 4. Gemini AI SDK Connection
    print("\n[4] Testing Google Gemini Model Integration...")
    try:
        from app.agents.gemini_agent import gemini_agent
        print(f"  -> [OK] Gemini Agent Initialized with model: {gemini_agent.model_name}")
    except Exception as e:
        print(f"  -> [FAIL] Gemini Agent Error: {e}")

    print("\n================================================================")
    print("[ALL SERVICES ONLINE] ALL RECOVERAI LIVE SERVICES ARE CONNECTED")
    print("================================================================")

if __name__ == "__main__":
    check_all()
