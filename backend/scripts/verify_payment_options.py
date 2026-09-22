import os
import sys
import json
import time
import subprocess

MCP_COMMAND = r"C:\Users\kawin\AppData\Roaming\npm\playwright-mcp.cmd"
CHROME_PATH = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://127.0.0.1:3000"
SCREENSHOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mcp_screenshots"))
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

class PlaywrightClient:
    def __init__(self):
        self.req_id = 0
        cmd = [MCP_COMMAND, "--executable-path", CHROME_PATH, "--headless"]
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

    def send_request(self, method: str, params: dict = None) -> dict:
        self.req_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self.req_id,
            "method": method,
            "params": params or {}
        }
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()

        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("Playwright MCP server exited.")
            try:
                data = json.loads(line)
                if data.get("id") == self.req_id:
                    return data
            except json.JSONDecodeError:
                continue

    def call_tool(self, name: str, arguments: dict = None) -> dict:
        return self.send_request("tools/call", {"name": name, "arguments": arguments or {}})

    def close(self):
        self.proc.terminate()

def run():
    client = PlaywrightClient()
    try:
        init_res = client.send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "payment-test-client", "version": "1.0.0"}
        })
        print("Init response:", init_res.get("result", {}).get("serverInfo", {}))

        # Navigate to demo-checkout
        nav_res = client.call_tool("browser_navigate", {"url": f"{BASE_URL}/demo-checkout"})
        print("Navigate:", nav_res)
        time.sleep(2)

        # Snapshot DOM to check for payment rails
        snap = client.call_tool("browser_snapshot")
        content = str(snap.get("result", {}).get("content", ""))
        print("Payment rails found in snapshot:")
        for rail in ["UPI Instant", "Credit / Debit Card", "Net Banking", "Wallets & PayLater"]:
            found = rail in content
            print(f" - {rail}: {'FOUND' if found else 'MISSING'}")

        # Take screenshot of Demo Checkout with Payment Options
        ss_path = os.path.join(SCREENSHOT_DIR, "demo_checkout_payment_rails.png")
        ss_res = client.call_tool("browser_take_screenshot", {"path": ss_path})
        print(f"Screenshot saved to: {ss_path}")

        # Click on 'Simulate Instant Bank Failure' button
        click_fail = client.call_tool("browser_click", {"selector": "text=Simulate Instant Bank Failure"})
        print("Click simulate failure:", click_fail)
        time.sleep(2)

        # Snapshot after failure simulation
        snap_fail = client.call_tool("browser_snapshot")
        content_fail = str(snap_fail.get("result", {}).get("content", ""))
        failure_escalated = "Payment Failed & Escalated to RecoverAI" in content_fail or "GATEWAY_TIMEOUT" in content_fail
        print(f"Failure Screen Escalation Triggered: {failure_escalated}")

        # Take screenshot of Failure / Escalation screen
        ss_fail_path = os.path.join(SCREENSHOT_DIR, "demo_checkout_failure_escalated.png")
        client.call_tool("browser_take_screenshot", {"path": ss_fail_path})
        print(f"Escalation screenshot saved to: {ss_fail_path}")

    finally:
        client.close()

if __name__ == "__main__":
    run()
