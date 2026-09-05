const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots_landing');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const consoleErrors = [];
  const pageErrors = [];

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    console.log('Navigating to', URL);
    await page.goto(URL, { waitUntil: 'networkidle' });

    // 1. Desktop Verification (1280x900)
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const footerText = await footer.innerText();
    console.log('\n--- FOOTER CONTENT SCAN ---');

    // Required headings check
    const requiredHeadings = [
      'Core Capabilities',
      'Safety & Governance',
      'Operations Workspace',
      'Integrations'
    ];
    for (const h of requiredHeadings) {
      if (footerText.includes(h)) {
        console.log(`PASS: Required heading "${h}" is present.`);
      } else {
        console.error(`FAILED: Required heading "${h}" is missing!`);
      }
    }

    // Required brand copy check
    if (footerText.includes('RecoverAI helps digital commerce businesses recover lost revenue from failed payments and abandoned checkouts')) {
      console.log('PASS: Brand description is present and exact.');
    } else {
      console.error('FAILED: Brand description missing or mismatch!');
    }

    // Status card check
    if (footerText.includes('Recovery Engine Active') && footerText.includes('Real-time monitoring, prioritization, and recovery workflows')) {
      console.log('PASS: Status card "Recovery Engine Active" & secondary text present.');
    } else {
      console.error('FAILED: Status card copy mismatch!');
    }

    // Trust badges check
    const trustBadges = ['Secure Payment Flows', 'Human Approval Controls', 'Audit Ready'];
    for (const tb of trustBadges) {
      if (footerText.includes(tb)) {
        console.log(`PASS: Trust badge "${tb}" present.`);
      } else {
        console.error(`FAILED: Trust badge "${tb}" missing!`);
      }
    }

    // Column 1 check
    const col1 = ['Failed Payment Detection', 'Recovery Scoring', 'Expected Recovery Value (ERV)', 'Smart Payment Links', 'Customer Recovery Messaging', 'Cart Recovery Flows'];
    for (const item of col1) {
      if (footerText.includes(item)) {
        console.log(`PASS: Col 1 item "${item}" present.`);
      } else {
        console.error(`FAILED: Col 1 item "${item}" missing!`);
      }
    }

    // Column 2 check
    const col2 = ['Policy Rules & Limits', 'Human Approval Queue', 'Frequency Caps & Quiet Hours', 'Full Audit Trail', 'Role-Based Access Control', 'Duplicate & Replay Protection'];
    for (const item of col2) {
      if (footerText.includes(item)) {
        console.log(`PASS: Col 2 item "${item}" present.`);
      } else {
        console.error(`FAILED: Col 2 item "${item}" missing!`);
      }
    }

    // Column 3 check
    const col3 = ['Executive Overview', 'At-Risk Revenue Queue', 'Recovery Agent Console', 'Demo Store Checkout', 'Recovery Analytics', 'Simulation & Forecasting'];
    for (const item of col3) {
      if (footerText.includes(item)) {
        console.log(`PASS: Col 3 item "${item}" present.`);
      } else {
        console.error(`FAILED: Col 3 item "${item}" missing!`);
      }
    }

    // Column 4 check
    const col4 = ['Razorpay', 'UPI', 'Cards & NetBanking', 'Supabase', 'Gemini AI', 'API-Ready Architecture'];
    for (const item of col4) {
      if (footerText.includes(item)) {
        console.log(`PASS: Col 4 item "${item}" present.`);
      } else {
        console.error(`FAILED: Col 4 item "${item}" missing!`);
      }
    }

    // Bottom row check
    if (footerText.includes('RecoverAI Technologies') &&
        footerText.includes('Autonomous Revenue Recovery for Digital Commerce') &&
        footerText.includes('Privacy Policy') &&
        footerText.includes('Terms of Service') &&
        footerText.includes('Security & Compliance') &&
        footerText.includes('System Status')) {
      console.log('PASS: Bottom row text and legal/status links present.');
    } else {
      console.error('FAILED: Bottom row text missing or mismatch!');
    }

    // Check horizontal scrolling on desktop
    const desktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Desktop horizontal scroll: ${desktopOverflow ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);

    const desktopScreenshot = path.join(SCREENSHOT_DIR, 'desktop_footer.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: false });
    console.log('Saved screenshot:', desktopScreenshot);

    // 2. Tablet Verification (768x1024)
    console.log('\n--- TABLET VERIFICATION (768x1024) ---');
    await page.setViewportSize({ width: 768, height: 1024 });
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Tablet horizontal scroll: ${tabletOverflow ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);

    const tabletScreenshot = path.join(SCREENSHOT_DIR, 'tablet_footer.png');
    await page.screenshot({ path: tabletScreenshot, fullPage: false });
    console.log('Saved screenshot:', tabletScreenshot);

    // 3. Mobile Verification (375x812)
    console.log('\n--- MOBILE VERIFICATION (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Mobile horizontal scroll: ${mobileOverflow ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);

    const mobileScreenshot = path.join(SCREENSHOT_DIR, 'mobile_footer.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: false });
    console.log('Saved screenshot:', mobileScreenshot);

    // Report errors
    console.log('\n--- CONSOLE & PAGE ERRORS ---');
    console.log(`Console errors (${consoleErrors.length}):`, consoleErrors);
    console.log(`Page errors (${pageErrors.length}):`, pageErrors);

  } finally {
    await browser.close();
  }
}

verify().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
