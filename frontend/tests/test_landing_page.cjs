const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const BASE_URL = 'http://127.0.0.1:5173';

async function runTest() {
  console.log('Testing with Chrome at:', CHROME_PATH);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });
  
  const results = {
    landingPage: false,
    desktop: false,
    mobile: false,
    navigation: false,
    ctaRouting: false,
    errors: []
  };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[Browser Error]', msg.text());
      results.errors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    console.warn('[Request Failed URL]:', req.url(), req.failure()?.errorText);
  });

  try {
    // 1. Desktop Initial Load
    console.log('1. Loading landing page on Desktop (1440x900)...');
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Recover revenue.', { timeout: 5000 });
    console.log('  ✓ Hero headline rendered');
    results.landingPage = true;

    // Verify Brand
    const brand = await page.locator('text=RecoverAI').first().isVisible();
    console.log('  ✓ Brand visible:', brand);

    // Verify Product Preview
    await page.waitForSelector('text=Revenue At Risk', { timeout: 5000 });
    const riskVal = await page.locator('text=₹6,81,400').first().isVisible();
    const recVal = await page.locator('text=₹4,59,840').first().isVisible();
    const rateVal = await page.locator('text=67.48%').first().isVisible();
    const upiSwitch = await page.locator('text=UPI Switch').first().isVisible();
    console.log(`  ✓ Preview metrics: Risk=${riskVal}, Rec=${recVal}, Rate=${rateVal}, Strategy=${upiSwitch}`);

    // Verify Scroll Anchors
    console.log('2. Testing navbar scroll anchors...');
    await page.click('button:has-text("How it Works")');
    await page.waitForTimeout(500);
    const howItWorksVisible = await page.locator('#how-it-works').isVisible();
    console.log('  ✓ Scrolled to #how-it-works:', howItWorksVisible);

    await page.click('button:has-text("Safety")');
    await page.waitForTimeout(500);
    const safetyVisible = await page.locator('#safety').isVisible();
    console.log('  ✓ Scrolled to #safety:', safetyVisible);

    await page.click('button:has-text("Impact")');
    await page.waitForTimeout(500);
    const impactVisible = await page.locator('#impact').isVisible();
    console.log('  ✓ Scrolled to #impact:', impactVisible);
    results.navigation = howItWorksVisible && safetyVisible && impactVisible;

    // Verify CTA Routing: Sign In
    console.log('3. Testing CTA routing: Sign In...');
    await page.goto(BASE_URL + '/');
    await page.click('a:has-text("Sign In")');
    await page.waitForURL('**/login', { timeout: 4000 });
    console.log('  ✓ Navigated to /login');
    const loginHeader = await page.locator('text=Sign In to Your Workspace').isVisible();
    console.log('  ✓ Login page verified:', loginHeader);

    // Return to home
    await page.click('text=Return to Public Homepage');
    await page.waitForURL(BASE_URL + '/', { timeout: 4000 });

    // Verify CTA Routing: Get Started
    console.log('4. Testing CTA routing: Get Started...');
    await page.click('a:has-text("Get Started")');
    await page.waitForURL('**/signup', { timeout: 4000 });
    console.log('  ✓ Navigated to /signup');
    const signupHeader = await page.locator('text=Create RecoverAI Workspace').isVisible();
    console.log('  ✓ Signup page verified:', signupHeader);

    results.ctaRouting = loginHeader && signupHeader;
    results.desktop = true;

    // 5. Mobile Responsiveness Test (390x844)
    console.log('5. Testing Mobile Viewport (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    // Check mobile hamburger button
    const menuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
    const menuVisible = await menuBtn.isVisible();
    console.log('  ✓ Hamburger button visible on mobile:', menuVisible);
    
    await menuBtn.click();
    await page.waitForTimeout(300);
    const mobileProductLink = await page.locator('div.md\\:hidden button:has-text("Product")').isVisible();
    console.log('  ✓ Mobile menu drawer opened and contains Product link:', mobileProductLink);
    
    // Check mobile hero rendering
    const mobileHero = await page.locator('text=Recover revenue.').isVisible();
    console.log('  ✓ Mobile hero headline visible:', mobileHero);
    
    results.mobile = menuVisible && mobileProductLink && mobileHero;

    console.log('\n--- VERIFICATION RESULTS ---');
    console.log('Landing Page:', results.landingPage ? 'PASS' : 'FAIL');
    console.log('Desktop:', results.desktop ? 'PASS' : 'FAIL');
    console.log('Mobile:', results.mobile ? 'PASS' : 'FAIL');
    console.log('Navigation:', results.navigation ? 'PASS' : 'FAIL');
    console.log('CTA routing:', results.ctaRouting ? 'PASS' : 'FAIL');
    console.log('Errors:', results.errors.length);

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await browser.close();
  }
}

runTest();
