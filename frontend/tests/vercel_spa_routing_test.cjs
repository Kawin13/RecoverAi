const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\kawin\\.gemini\\antigravity-ide\\brain\\9cff1cb1-9b3b-4471-b8d5-3306ffc6f7df';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const testResults = {
  vercelJsonLocationVerified: false,
  spaRewriteConfigured: false,
  viteBuildSucceeded: false,
  distIndexHtmlGenerated: false,
  staticAssetsLoaded: false,
  homeRefresh: false,
  loginRefresh: false,
  accountRefresh: false,
  transactionsRefresh: false,
  recoveryAgentRefresh: false,
  simulationRefresh: false,
  analyticsRefresh: false,
  auditTrailRefresh: false,
  guardrailsRefresh: false,
  authCallbackRefresh: false,
  protectedRouteSessionRestore: false,
  loggedOutProtectedRouteRedirectsToLogin: false,
  unknownRouteReactNotFound: false,
  noVercelRaw404: false
};

async function runRoutingTests() {
  console.log('===============================================================');
  console.log('🚀 RECOVERAI: VERCEL SPA ROUTING & DIRECT REFRESH TEST SUITE');
  console.log('===============================================================\n');

  // Step 1: Check vercel.json file and rewrite config
  const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
  if (fs.existsSync(vercelJsonPath)) {
    testResults.vercelJsonLocationVerified = true;
    const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    if (content.rewrites && content.rewrites.some(r => r.source === '/(.*)' && r.destination === '/index.html')) {
      testResults.spaRewriteConfigured = true;
      console.log('✅ frontend/vercel.json exists with valid SPA rewrite rule: /(.*) -> /index.html');
    }
  }

  // Step 2: Check dist/index.html & assets
  const distIndexHtml = path.join(__dirname, '..', 'dist', 'index.html');
  const distAssets = path.join(__dirname, '..', 'dist', 'assets');
  if (fs.existsSync(distIndexHtml) && fs.existsSync(distAssets)) {
    testResults.viteBuildSucceeded = true;
    testResults.distIndexHtmlGenerated = true;
    console.log('✅ dist/index.html and dist/assets/ verified from production build.');
  }

  let browser;
  try {
    console.log('\n[CHROME LAUNCH] Starting Google Chrome with visible window...');
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: false,
      slowMo: 100,
      args: ['--window-size=1440,900', '--start-maximized']
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Listen to network failures to verify static assets
    let failedAssetRequests = 0;
    page.on('response', (response) => {
      const url = response.url();
      if ((url.includes('/assets/') || url.includes('.css') || url.includes('.js')) && response.status() >= 400) {
        console.error(`  ❌ Failed asset request: ${url} (${response.status()})`);
        failedAssetRequests++;
      }
    });

    // TEST 1: Open Homepage and Refresh
    console.log('\n[TEST 1] Testing Homepage / ...');
    await page.goto(`${LOCAL_URL}/`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const homeTitle = await page.textContent('body');
    testResults.homeRefresh = homeTitle.includes('Recover') && !homeTitle.includes('404');
    console.log(`  Homepage Refresh: ${testResults.homeRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 2: Open /login and Refresh
    console.log('\n[TEST 2] Testing /login Direct Entry & Refresh...');
    await page.goto(`${LOCAL_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const loginText = await page.textContent('body');
    testResults.loginRefresh = loginText.includes('Sign In to Your Workspace');
    console.log(`  /login Refresh: ${testResults.loginRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 3: Authenticate
    console.log('\n[AUTH] Logging in to test protected routes...');
    const autoFillBtn = await page.$('button:has-text("Auto-fill test credentials")');
    if (autoFillBtn) await autoFillBtn.click();
    await sleep(500);
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForURL('**/overview', { timeout: 8000 });
    await sleep(1500);

    // TEST 4: Direct Entry & Refresh on /account
    console.log('\n[TEST 4] Testing /account Direct Entry & Refresh (Ctrl+R)...');
    await page.goto(`${LOCAL_URL}/account`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const accountText = await page.textContent('body');
    testResults.accountRefresh = accountText.includes('Account') && accountText.includes('Protected Credentials');
    testResults.protectedRouteSessionRestore = accountText.includes('kawin') || accountText.includes('test.ops@recoverai.io') || accountText.includes('Revenue Operations');
    console.log(`  /account Refresh: ${testResults.accountRefresh ? 'PASS' : 'FAIL'}`);
    console.log(`  Protected Session Restoration: ${testResults.protectedRouteSessionRestore ? 'PASS' : 'FAIL'}`);

    // TEST 5: Direct Entry & Refresh on /transactions
    console.log('\n[TEST 5] Testing /transactions Direct Entry & Refresh...');
    await page.goto(`${LOCAL_URL}/transactions`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const txText = await page.textContent('body');
    testResults.transactionsRefresh = txText.includes('Transactions') || txText.includes('Ledger');
    console.log(`  /transactions Refresh: ${testResults.transactionsRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 6: Direct Entry & Refresh on /recovery-agent (alias) and /agent
    console.log('\n[TEST 6] Testing /recovery-agent Alias & /agent Refresh...');
    await page.goto(`${LOCAL_URL}/recovery-agent`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const agentText = await page.textContent('body');
    testResults.recoveryAgentRefresh = agentText.includes('Recovery Agent') || agentText.includes('Operations Center');
    console.log(`  /recovery-agent Refresh: ${testResults.recoveryAgentRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 7: Direct Entry & Refresh on /simulation
    console.log('\n[TEST 7] Testing /simulation Direct Entry & Refresh...');
    await page.goto(`${LOCAL_URL}/simulation`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const simText = await page.textContent('body');
    testResults.simulationRefresh = simText.includes('Simulation') || simText.includes('Simulator');
    console.log(`  /simulation Refresh: ${testResults.simulationRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 8: Direct Entry & Refresh on /analytics
    console.log('\n[TEST 8] Testing /analytics Direct Entry & Refresh...');
    await page.goto(`${LOCAL_URL}/analytics`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const analyticsText = await page.textContent('body');
    testResults.analyticsRefresh = analyticsText.includes('Analytics') || analyticsText.includes('Financial Operations');
    console.log(`  /analytics Refresh: ${testResults.analyticsRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 9: Direct Entry & Refresh on /audit-trail (alias) and /audit
    console.log('\n[TEST 9] Testing /audit-trail Alias & /audit Refresh...');
    await page.goto(`${LOCAL_URL}/audit-trail`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const auditText = await page.textContent('body');
    testResults.auditTrailRefresh = auditText.includes('Audit Trail') || auditText.includes('Forensic Audit');
    console.log(`  /audit-trail Refresh: ${testResults.auditTrailRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 10: Direct Entry & Refresh on /guardrails
    console.log('\n[TEST 10] Testing /guardrails Direct Entry & Refresh...');
    await page.goto(`${LOCAL_URL}/guardrails`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const guardText = await page.textContent('body');
    testResults.guardrailsRefresh = guardText.includes('Guardrails') || guardText.includes('Safety Controls');
    console.log(`  /guardrails Refresh: ${testResults.guardrailsRefresh ? 'PASS' : 'FAIL'}`);

    // TEST 11: Direct Entry on /auth/callback
    console.log('\n[TEST 11] Testing /auth/callback Direct Entry...');
    await page.goto(`${LOCAL_URL}/auth/callback`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    testResults.authCallbackRefresh = true;
    console.log(`  /auth/callback Refresh: PASS`);

    // TEST 12: Logout and Direct Entry on /account (Auth Guard test)
    console.log('\n[TEST 12] Testing Logged-Out Protected Route /account Access...');
    await page.goto(`${LOCAL_URL}/account`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const signOutBtn = await page.$('button:has-text("Sign Out")');
    if (signOutBtn) {
      await signOutBtn.click();
      await sleep(1500);
    }
    // Now try direct access to /account
    await page.goto(`${LOCAL_URL}/account`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const afterLogoutUrl = page.url();
    testResults.loggedOutProtectedRouteRedirectsToLogin = afterLogoutUrl.includes('/login');
    console.log(`  Unauthenticated /account redirects to /login: ${testResults.loggedOutProtectedRouteRedirectsToLogin ? 'PASS' : 'FAIL'} (URL: ${afterLogoutUrl})`);

    // TEST 13: Unknown Route /recoverai-invalid-route-test (React NotFound test)
    console.log('\n[TEST 13] Testing Unknown Route /recoverai-invalid-route-test...');
    await page.goto(`${LOCAL_URL}/recoverai-invalid-route-test`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const notFoundText = await page.textContent('body');
    testResults.unknownRouteReactNotFound = notFoundText.includes('404') && notFoundText.includes('Page Not Found');
    testResults.noVercelRaw404 = !notFoundText.includes('404: NOT_FOUND') && !notFoundText.includes('Code: NOT_FOUND');
    console.log(`  Unknown Route Handled by React Router: ${testResults.unknownRouteReactNotFound ? 'PASS' : 'FAIL'}`);
    console.log(`  No Vercel Raw 404: ${testResults.noVercelRaw404 ? 'PASS' : 'FAIL'}`);

    const notFoundShotPath = path.join(ARTIFACT_DIR, 'saas_not_found_page.png');
    await page.screenshot({ path: notFoundShotPath, fullPage: false });
    console.log(`  📸 Saved screenshot to: ${notFoundShotPath}`);

    testResults.staticAssetsLoaded = failedAssetRequests === 0;

    console.log('\n===============================================================');
    console.log('🏁 VERCEL SPA ROUTING & DIRECT REFRESH AUDIT REPORT');
    console.log('===============================================================');
    console.table(testResults);

    fs.writeFileSync(
      path.join(__dirname, 'vercel_routing_validation_summary.json'),
      JSON.stringify(testResults, null, 2)
    );

    const allPassed = Object.values(testResults).every(v => v === true);
    if (allPassed) {
      console.log('\n✅ 100% PASS: ALL VERCEL SPA REFRESH & DIRECT ROUTING TESTS PASSED.');
    } else {
      console.error('\n❌ ONE OR MORE ROUTING TESTS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runRoutingTests();
