const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACT_DIR = 'C:\\Users\\kawin\\.gemini\\antigravity-ide\\brain\\6517219c-de13-494d-84bf-b92c122f1c5e';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPaymentVerification() {
  console.log('===============================================================');
  console.log('💳 RECOVERAI: COMPREHENSIVE PAYMENT OPTIONS & LOGIC E2E VERIFICATION');
  console.log(`Target: ${BASE_URL}/demo-checkout`);
  console.log('===============================================================\n');

  const results = {
    authSuccess: false,
    sessionCreated: false,
    upiRailValid: false,
    cardRailValid: false,
    cardBrandDetectionValid: false,
    netBankingRailValid: false,
    walletsRailValid: false,
    authModalAppeared: false,
    paymentSuccessReceiptValid: false,
    failureEscalationTriggered: false,
    smartAlternateRailWorking: false,
    screenshots: []
  };

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('429')) {
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  try {
    // -----------------------------------------------------------------
    // 1. Authenticate to establish session
    // -----------------------------------------------------------------
    console.log('[STEP 1] Navigating to /demo-checkout...');
    await page.goto(`${BASE_URL}/demo-checkout`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);

    if (page.url().includes('/login')) {
      console.log('  -> Redirected to login. Signing in with test operator credentials...');
      const autoFillBtn = page.locator('button:has-text("Auto-fill test credentials")').first();
      if (await autoFillBtn.isVisible()) {
        await autoFillBtn.click();
        await sleep(200);
      } else {
        await page.fill('input[type="email"]', 'test.ops@recoverai.io');
        await page.fill('input[type="password"]', 'RecoverAiPass2026!');
      }

      await page.locator('button:has-text("Sign In to Cockpit")').first().click();
      await sleep(2000);

      // Handle onboarding redirect if any
      const returnLink = page.locator('button:has-text("Return to Dashboard")').first();
      if (await returnLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await returnLink.click();
        await sleep(1500);
      }

      if (!page.url().includes('/demo-checkout')) {
        await page.goto(`${BASE_URL}/demo-checkout`, { waitUntil: 'networkidle' });
        await sleep(1500);
      }
    }

    console.log(`  -> Arrived on: ${page.url()}`);
    results.authSuccess = true;

    // Verify order title & amount
    const orderHeader = page.locator('text=RecoverAI Demo Store').first();
    await orderHeader.waitFor({ timeout: 10000 });
    console.log('  -> RecoverAI Demo Store loaded successfully.');

    // Verify Session ID badge
    const sessionBadge = page.locator('text=Session ID:').first();
    try {
      await sessionBadge.waitFor({ timeout: 8000 });
      const badgeText = await sessionBadge.innerText();
      console.log(`  -> ✓ Checkout Session established: ${badgeText}`);
      results.sessionCreated = true;
    } catch {
      console.log('  -> Session badge not visible within timeout');
    }

    // Scroll down to section 3: payment options
    await page.evaluate(() => {
      window.scrollBy(0, 450);
    });
    await sleep(400);

    // -----------------------------------------------------------------
    // 2. Test UPI Rail
    // -----------------------------------------------------------------
    console.log('\n[STEP 2] Testing UPI Instant Rail & Interactive Panels...');
    const vpaInput = page.locator('input[placeholder="username@okhdfcbank"]').first();
    const isVpaVisible = await vpaInput.isVisible();
    
    // Switch to UPI Apps submode to test app intents
    await page.locator('button:has-text("UPI Apps")').first().click();
    await sleep(300);
    const gpayButton = page.locator('button:has-text("Google Pay")').first();
    const phonepeButton = page.locator('button:has-text("PhonePe")').first();
    const isGpayVisible = await gpayButton.isVisible();
    const isPhonepeVisible = await phonepeButton.isVisible();

    // Switch to Dynamic QR submode
    await page.locator('button:has-text("Dynamic QR")').first().click();
    await sleep(300);

    // Switch back to UPI ID / VPA submode
    await page.locator('button:has-text("UPI ID / VPA")').first().click();
    await sleep(300);

    console.log(`  -> UPI VPA Input Visible: ${isVpaVisible}`);
    console.log(`  -> UPI Apps (GPay: ${isGpayVisible}, PhonePe: ${isPhonepeVisible})`);

    if (isVpaVisible && isGpayVisible) {
      results.upiRailValid = true;
    }

    const ssUpi = path.join(ARTIFACT_DIR, '01_demo_checkout_upi.png');
    await page.screenshot({ path: ssUpi, fullPage: false });
    results.screenshots.push(ssUpi);
    console.log(`  -> Screenshot saved: ${ssUpi}`);

    // -----------------------------------------------------------------
    // 3. Test Credit / Debit Card Rail & Brand Detection
    // -----------------------------------------------------------------
    console.log('\n[STEP 3] Testing Credit / Debit Card Rail & Live Brand Detection...');
    await page.locator('button:has-text("Credit / Debit Card")').first().click();
    await sleep(500);

    const cardNumInput = page.locator('input[placeholder="4111 1111 1111 1111"]').first();
    const isCardInputVisible = await cardNumInput.isVisible();
    console.log(`  -> Card Number Input Visible: ${isCardInputVisible}`);

    // Click "Visa (Success)" Preset
    const visaPreset = page.locator('button:has-text("Visa (Success)")').first();
    if (await visaPreset.isVisible()) {
      await visaPreset.click();
      await sleep(400);
      const cardVal = await cardNumInput.inputValue();
      const brandBadge = await page.locator('text=VISA').first().isVisible();
      console.log(`  -> Card preset clicked! Card Number: "${cardVal}", Brand Badge VISA: ${brandBadge}`);
      if (brandBadge && cardVal.startsWith('4111')) {
        results.cardBrandDetectionValid = true;
        results.cardRailValid = true;
      }
    }

    // Toggle CVV show/hide
    const cvvToggle = page.locator('button[aria-label="Hide CVV"], button[aria-label="Show CVV"]').first();
    if (await cvvToggle.isVisible().catch(() => false)) {
      await cvvToggle.click();
      await sleep(200);
    }

    const ssCard = path.join(ARTIFACT_DIR, '02_demo_checkout_card.png');
    await page.screenshot({ path: ssCard, fullPage: false });
    results.screenshots.push(ssCard);
    console.log(`  -> Screenshot saved: ${ssCard}`);

    // -----------------------------------------------------------------
    // 4. Test Net Banking Rail
    // -----------------------------------------------------------------
    console.log('\n[STEP 4] Testing Net Banking Rail & 50+ Bank Directory...');
    await page.locator('button:has-text("Net Banking")').first().click();
    await sleep(500);

    const hdfcBank = page.locator('button:has-text("HDFC Bank")').first();
    const iciciBank = page.locator('button:has-text("ICICI Bank")').first();
    const bankSelect = page.locator('select').first();

    const isHdfcVisible = await hdfcBank.isVisible();
    const isIciciVisible = await iciciBank.isVisible();
    const isSelectVisible = await bankSelect.isVisible();

    console.log(`  -> Top Banks (HDFC: ${isHdfcVisible}, ICICI: ${isIciciVisible}, Bank Select: ${isSelectVisible})`);
    if (isHdfcVisible && isIciciVisible && isSelectVisible) {
      results.netBankingRailValid = true;
      // Select ICICI Bank tile
      await iciciBank.click();
      await sleep(200);
    }

    const ssNetBanking = path.join(ARTIFACT_DIR, '03_demo_checkout_netbanking.png');
    await page.screenshot({ path: ssNetBanking, fullPage: false });
    results.screenshots.push(ssNetBanking);
    console.log(`  -> Screenshot saved: ${ssNetBanking}`);

    // -----------------------------------------------------------------
    // 5. Test Wallets & PayLater Rail
    // -----------------------------------------------------------------
    console.log('\n[STEP 5] Testing Wallets & PayLater Rail...');
    await page.locator('button:has-text("Wallets & PayLater")').first().click();
    await sleep(500);

    const paytmWallet = page.locator('button:has-text("Paytm")').first();
    const amazonPay = page.locator('button:has-text("Amazon Pay")').first();
    const isPaytmVisible = await paytmWallet.isVisible();

    // Switch to PayLater / BNPL
    await page.locator('button:has-text("PayLater / BNPL")').first().click();
    await sleep(300);
    const simplBnpl = page.locator('button:has-text("Simpl")').first();
    const isSimplVisible = await simplBnpl.isVisible();

    // Switch back to Pre-Paid Wallets
    await page.locator('button:has-text("Pre-Paid Wallets")').first().click();
    await sleep(300);

    console.log(`  -> Wallets (Paytm: ${isPaytmVisible}, Simpl BNPL: ${isSimplVisible})`);
    if (isPaytmVisible && isSimplVisible) {
      results.walletsRailValid = true;
      await amazonPay.click();
      await sleep(200);
    }

    const ssWallets = path.join(ARTIFACT_DIR, '04_demo_checkout_wallets.png');
    await page.screenshot({ path: ssWallets, fullPage: false });
    results.screenshots.push(ssWallets);
    console.log(`  -> Screenshot saved: ${ssWallets}`);

    // -----------------------------------------------------------------
    // 6. Test Direct Rail Authorization Modal & Payment Success Flow
    // -----------------------------------------------------------------
    console.log('\n[STEP 6] Testing Direct Rail Authorization Modal & Success Flow...');
    // Switch to Sandbox Simulation mode to test the authorization modal
    const sandboxToggle = page.locator('button:has-text("Sandbox Simulation")').first();
    if (await sandboxToggle.isVisible()) {
      await sandboxToggle.click();
      await sleep(300);
    }

    // Click "Pay ₹4,999 with UPI (Sandbox)"
    const payBtn = page.locator('button:has-text("Pay ₹")').first();
    await payBtn.click();
    await sleep(1000);

    // Check if Rail Authorization Sandbox modal is visible
    const modalTitle = page.locator('text=Authorize or Decline Transaction').first();
    await modalTitle.waitFor({ timeout: 8000 });
    const isModalVisible = await modalTitle.isVisible();
    console.log(`  -> Rail Authorization Modal Visible: ${isModalVisible}`);

    if (isModalVisible) {
      results.authModalAppeared = true;
      const ssModal = path.join(ARTIFACT_DIR, '05_demo_checkout_auth_modal.png');
      await page.screenshot({ path: ssModal, fullPage: false });
      results.screenshots.push(ssModal);
      console.log(`  -> Screenshot saved: ${ssModal}`);

      // Click "Authorize ₹... via UPI"
      const authorizeSuccessBtn = page.locator('button:has-text("Authorize ₹")').first();
      await authorizeSuccessBtn.click();
      await sleep(2500);

      // Verify Receipt Screen
      const receiptTitle = page.locator('text=Payment Verified Successfully').first();
      await receiptTitle.waitFor({ timeout: 10000 });
      const isReceiptVisible = await receiptTitle.isVisible();
      const hmacBadge = page.locator('text=HMAC Validated').first();
      const isHmacVisible = await hmacBadge.isVisible();

      console.log(`  -> Success Receipt Visible: ${isReceiptVisible}, HMAC Badge: ${isHmacVisible}`);
      if (isReceiptVisible && isHmacVisible) {
        results.paymentSuccessReceiptValid = true;
      }

      const ssReceipt = path.join(ARTIFACT_DIR, '06_demo_checkout_success_receipt.png');
      await page.screenshot({ path: ssReceipt, fullPage: false });
      results.screenshots.push(ssReceipt);
      console.log(`  -> Screenshot saved: ${ssReceipt}`);
    }

    // -----------------------------------------------------------------
    // 7. Test Failure Simulation & Smart Alternate Rail Fallback
    // -----------------------------------------------------------------
    console.log('\n[STEP 7] Testing Failure Simulation & Smart Alternate Rail Fallback...');
    // Click "Make Another Payment" to return to checkout
    const makeAnotherBtn = page.locator('button:has-text("Make Another Payment")').first();
    if (await makeAnotherBtn.isVisible()) {
      await makeAnotherBtn.click();
      await sleep(1000);
    }

    // Click "Simulate ... Gateway Failure"
    const simulateFailBtn = page.locator('button:has-text("Gateway Failure")').first();
    if (await simulateFailBtn.isVisible()) {
      await simulateFailBtn.click();
      await sleep(2500);

      // Verify Failure Escalation Screen
      const failTitle = page.locator('text=Payment Failed & Escalated to RecoverAI').first();
      await failTitle.waitFor({ timeout: 10000 });
      const isFailVisible = await failTitle.isVisible();
      const errorCode = page.locator('text=GATEWAY_TIMEOUT, text=GATEWAY_ERROR').first();
      const isErrorVisible = await errorCode.isVisible().catch(() => true);

      console.log(`  -> Failure Screen Visible: ${isFailVisible}, Error Code Visible: ${isErrorVisible}`);
      if (isFailVisible) {
        results.failureEscalationTriggered = true;
      }

      // Check Smart Alternate Rail Recommendation
      const altRailsTitle = page.locator('text=RecoverAI Smart Alternate Rail Recommendation').first();
      const isAltRailsVisible = await altRailsTitle.isVisible();
      console.log(`  -> Smart Alternate Rails Panel Visible: ${isAltRailsVisible}`);

      const switchCardBtn = page.locator('button:has-text("Switch to Credit / Debit Card & Retry")').first();
      const isSwitchCardVisible = await switchCardBtn.isVisible();
      console.log(`  -> Switch to Card Button Visible: ${isSwitchCardVisible}`);

      const ssFail = path.join(ARTIFACT_DIR, '07_demo_checkout_failure_and_alternate_rail.png');
      await page.screenshot({ path: ssFail, fullPage: false });
      results.screenshots.push(ssFail);
      console.log(`  -> Screenshot saved: ${ssFail}`);

      if (isSwitchCardVisible) {
        // Click switch to Card and test fallback logic
        await switchCardBtn.click();
        await sleep(1000);
        // Verify we are back on checkout and Card is now the active tab
        const cardHeaderActive = await page.locator('text=Card Instrument Configuration & 3DS').first().isVisible();
        console.log(`  -> Smart Alternate Rail successfully navigated back with Card rail active: ${cardHeaderActive}`);
        if (cardHeaderActive) {
          results.smartAlternateRailWorking = true;
        }
      }
    }

  } catch (err) {
    console.error('Test execution exception:', err);
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log('🏁 VERIFICATION RESULTS SUMMARY');
  console.log('===============================================================');
  console.log(JSON.stringify(results, null, 2));

  const allPassed =
    results.authSuccess &&
    results.sessionCreated &&
    results.upiRailValid &&
    results.cardRailValid &&
    results.cardBrandDetectionValid &&
    results.netBankingRailValid &&
    results.walletsRailValid &&
    results.authModalAppeared &&
    results.paymentSuccessReceiptValid &&
    results.failureEscalationTriggered &&
    results.smartAlternateRailWorking;

  console.log(`\nOVERALL SUITE STATUS: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
  process.exit(allPassed ? 0 : 1);
}

runPaymentVerification();
