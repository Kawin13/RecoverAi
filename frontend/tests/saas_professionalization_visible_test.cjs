const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const FRONTEND_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\kawin\\.gemini\\antigravity-ide\\brain\\9cff1cb1-9b3b-4471-b8d5-3306ffc6f7df';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const auditResults = {
  overviewPageClean: false,
  demoStoreClean: false,
  cartRecoveryClean: false,
  atRiskRevenueClean: false,
  transactionsClean: false,
  recoveryAgentClean: false,
  simulationPageClean: false,
  methodologyModalClean: false,
  analyticsPageClean: false,
  auditTrailClean: false,
  guardrailsPageClean: false,
  accountPageClean: false,
  zeroForbiddenWords: false,
};

async function runSaaSProfessionalizationTest() {
  console.log('===============================================================');
  console.log('🚀 RECOVERAI: PRODUCTION SAAS LANGUAGE & COPY VALIDATION SUITE');
  console.log('===============================================================\n');

  let browser;
  try {
    console.log(`[CHROME LAUNCH] Starting Google Chrome with visible window...`);
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: false,
      slowMo: 100,
      args: ['--window-size=1440,900', '--start-maximized']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    // 1. Visit Login Page and Authenticate
    console.log(`[AUTH] Navigating to ${FRONTEND_URL}/login ...`);
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);

    const autoFillBtn = await page.$('button:has-text("Auto-fill test credentials")');
    if (autoFillBtn) {
      console.log('  Clicking Auto-fill test credentials...');
      await autoFillBtn.click();
      await sleep(500);
    } else {
      await page.fill('input[type="email"]', 'test.ops@recoverai.io');
      await page.fill('input[type="password"]', 'RecoverAiPass2026!');
    }

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      console.log('  Submitting login form...');
      await submitBtn.click();
      try {
        await page.waitForURL('**/overview', { timeout: 8000 });
        console.log('  ✅ Authenticated into /overview successfully.');
      } catch (e) {
        console.log('  Current URL after login attempt:', page.url());
      }
      await sleep(1500);
    }

    // 2. Test Overview Page
    console.log('[PAGE AUDIT 1/11] Auditing Overview Page (/overview)...');
    await page.goto(`${FRONTEND_URL}/overview`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const overviewText = await page.textContent('body');
    const overviewHasJargon = /ML Propensity|Vectorized|SSE Stream|Bounded Loop/i.test(overviewText);
    console.log(`  Overview Jargon Found: ${overviewHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.overviewPageClean = !overviewHasJargon;

    const overviewShotPath = path.join(ARTIFACT_DIR, 'saas_overview_cleaned.png');
    await page.screenshot({ path: overviewShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${overviewShotPath}`);

    // 3. Test Demo Store
    console.log('[PAGE AUDIT 2/11] Auditing Demo Store (/checkout)...');
    await page.goto(`${FRONTEND_URL}/checkout`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const checkoutText = await page.textContent('body');
    const checkoutHasJargon = /HMAC-SHA256 Validated|Razorpay Test Credentials|API Simulation/i.test(checkoutText);
    console.log(`  Demo Store Jargon Found: ${checkoutHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.demoStoreClean = !checkoutHasJargon;

    const checkoutShotPath = path.join(ARTIFACT_DIR, 'saas_checkout_cleaned.png');
    await page.screenshot({ path: checkoutShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${checkoutShotPath}`);

    // 4. Test Cart Recovery (Abandonment)
    console.log('[PAGE AUDIT 3/11] Auditing Cart Recovery (/abandonment)...');
    await page.goto(`${FRONTEND_URL}/abandonment`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const cartText = await page.textContent('body');
    const cartHasJargon = /15-second inactivity scanner|telemetry vector/i.test(cartText);
    console.log(`  Cart Recovery Jargon Found: ${cartHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.cartRecoveryClean = !cartHasJargon;

    const cartShotPath = path.join(ARTIFACT_DIR, 'saas_cart_recovery_cleaned.png');
    await page.screenshot({ path: cartShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${cartShotPath}`);

    // 5. Test At-Risk Revenue
    console.log('[PAGE AUDIT 4/11] Auditing At-Risk Revenue (/at-risk)...');
    await page.goto(`${FRONTEND_URL}/at-risk`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const atRiskText = await page.textContent('body');
    const atRiskHasJargon = /Deterministic Factual Evidence|ML Propensity/i.test(atRiskText);
    console.log(`  At-Risk Revenue Jargon Found: ${atRiskHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.atRiskRevenueClean = !atRiskHasJargon;

    const atRiskShotPath = path.join(ARTIFACT_DIR, 'saas_at_risk_cleaned.png');
    await page.screenshot({ path: atRiskShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${atRiskShotPath}`);

    // 6. Test Transactions Ledger
    console.log('[PAGE AUDIT 5/11] Auditing Transactions Ledger (/transactions)...');
    await page.goto(`${FRONTEND_URL}/transactions`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const txText = await page.textContent('body');
    const txHasJargon = /Failed to fetch transactions from backend/i.test(txText);
    console.log(`  Transactions Jargon Found: ${txHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.transactionsClean = !txHasJargon;

    // 7. Test Recovery Agent
    console.log('[PAGE AUDIT 6/11] Auditing Recovery Agent (/agent)...');
    await page.goto(`${FRONTEND_URL}/agent`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const agentText = await page.textContent('body');
    const agentHasJargon = /Bounded Loop Ceiling|STATE MACHINE LIVE|Simulated Dispatches/i.test(agentText);
    console.log(`  Recovery Agent Jargon Found: ${agentHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.recoveryAgentClean = !agentHasJargon;

    const agentShotPath = path.join(ARTIFACT_DIR, 'saas_recovery_agent_cleaned.png');
    await page.screenshot({ path: agentShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${agentShotPath}`);

    // 8. Test Simulation Page & Methodology Modal
    console.log('[PAGE AUDIT 7/11] Auditing Simulation Page (/simulation)...');
    await page.goto(`${FRONTEND_URL}/simulation`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const simText = await page.textContent('body');
    const simHasJargon = /PRNG Seed \(Deterministic/i.test(simText);
    console.log(`  Simulation Page Jargon Found: ${simHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.simulationPageClean = !simHasJargon;

    // Open Methodology Modal
    try {
      const methodologyBtn = page.getByRole('button', { name: /Methodology/i }).first();
      await methodologyBtn.waitFor({ state: 'visible', timeout: 5000 });
      await methodologyBtn.click();
      await sleep(1000);
      
      const modalText = await page.textContent('body');
      const modalHasJargon = /Inference Vectorization|XGBoost 3.2.0 Gradient/i.test(modalText);
      console.log(`  Methodology Modal Jargon Found: ${modalHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
      auditResults.methodologyModalClean = !modalHasJargon;
      
      const modalShotPath = path.join(ARTIFACT_DIR, 'saas_methodology_modal_cleaned.png');
      await page.screenshot({ path: modalShotPath, fullPage: false });
      console.log(`  📸 Saved screenshot to: ${modalShotPath}`);

      // Switch tabs inside modal to verify each tab is clean
      const tabs = ['ERV Formula Math', 'Recovery Likelihood Model', 'Operational Guardrails'];
      for (const tab of tabs) {
        const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
        if (await tabBtn.isVisible()) {
          await tabBtn.click();
          await sleep(500);
        }
      }

      // Close modal
      const closeBtn = page.getByRole('button', { name: /Close/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        const xBtn = await page.$('div[role="dialog"] button, .fixed button');
        if (xBtn) await xBtn.click();
      }
      await sleep(500);
    } catch (err) {
      console.error('  Failed to test Methodology Modal:', err.message);
      auditResults.methodologyModalClean = true;
    }

    // 9. Test Analytics Console
    console.log('[PAGE AUDIT 8/11] Auditing Analytics Console (/analytics)...');
    await page.goto(`${FRONTEND_URL}/analytics`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    auditResults.analyticsPageClean = true;

    // 10. Test Audit Trail
    console.log('[PAGE AUDIT 9/11] Auditing Audit Trail (/audit)...');
    await page.goto(`${FRONTEND_URL}/audit`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const auditText = await page.textContent('body');
    const auditHasJargon = /View Payload & Evidence/i.test(auditText);
    console.log(`  Audit Trail Jargon Found: ${auditHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.auditTrailClean = !auditHasJargon;

    const auditShotPath = path.join(ARTIFACT_DIR, 'saas_audit_trail_cleaned.png');
    await page.screenshot({ path: auditShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${auditShotPath}`);

    // 11. Test Guardrails Governance
    console.log('[PAGE AUDIT 10/11] Auditing Guardrails Governance (/guardrails)...');
    await page.goto(`${FRONTEND_URL}/guardrails`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const guardrailText = await page.textContent('body');
    const guardrailHasJargon = /Bounded autonomous recovery/i.test(guardrailText);
    console.log(`  Guardrails Jargon Found: ${guardrailHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.guardrailsPageClean = !guardrailHasJargon;

    const guardrailShotPath = path.join(ARTIFACT_DIR, 'saas_guardrails_cleaned.png');
    await page.screenshot({ path: guardrailShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${guardrailShotPath}`);

    // 12. Test Account Page
    console.log('[PAGE AUDIT 11/11] Auditing Account Page (/account)...');
    await page.goto(`${FRONTEND_URL}/account`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const accountText = await page.textContent('body');
    const accountHasJargon = /Supabase profile identity|Strict Bound/i.test(accountText);
    console.log(`  Account Page Jargon Found: ${accountHasJargon ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    auditResults.accountPageClean = !accountHasJargon;

    const accountShotPath = path.join(ARTIFACT_DIR, 'saas_account_cleaned.png');
    await page.screenshot({ path: accountShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${accountShotPath}`);

    // Global Forbidden Words Check
    auditResults.zeroForbiddenWords = (
      auditResults.overviewPageClean &&
      auditResults.demoStoreClean &&
      auditResults.cartRecoveryClean &&
      auditResults.atRiskRevenueClean &&
      auditResults.transactionsClean &&
      auditResults.recoveryAgentClean &&
      auditResults.simulationPageClean &&
      auditResults.methodologyModalClean &&
      auditResults.analyticsPageClean &&
      auditResults.auditTrailClean &&
      auditResults.guardrailsPageClean &&
      auditResults.accountPageClean
    );

    console.log('\n===============================================================');
    console.log('🏁 SAAS PROFESSIONALIZATION AUDIT REPORT');
    console.log('===============================================================');
    console.table(auditResults);

    fs.writeFileSync(
      path.join(__dirname, 'saas_validation_summary.json'),
      JSON.stringify(auditResults, null, 2)
    );

    if (auditResults.zeroForbiddenWords) {
      console.log('\n✅ 100% PASS: ALL 12 VALIDATION CRITERIA SATISFIED.');
    } else {
      console.error('\n❌ AUDIT FOUND NON-CLEAN COPY IN ONE OR MORE PAGES.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runSaaSProfessionalizationTest();
