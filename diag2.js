const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  // Load LOCAL version (faster, has latest code)
  await page.goto('http://localhost:3847/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000); // Boot sequence

  // Check effects loaded
  const status = await page.evaluate(() => ({
    three: typeof THREE !== 'undefined',
    lenis: typeof Lenis !== 'undefined',
    mesh: !!document.getElementById('te-mesh'),
    heroCanvas: !!document.getElementById('te-hero-canvas'),
    ring: !!document.getElementById('te-ring'),
    glows: document.querySelectorAll('.te-glow').length,
    conns: document.querySelectorAll('.te-conn').length,
    chars: document.querySelectorAll('.te-char').length,
    scrollGlow: !!document.getElementById('te-scroll-glow'),
  }));
  console.log('\n=== STATUS ===');
  console.log(JSON.stringify(status, null, 2));

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach(e => console.log(e));
  } else {
    console.log('\nNo errors!');
  }

  // Screenshot hero area (after boot dismiss)
  await page.screenshot({ path: 'screenshots/v5-hero.png' });

  // Move mouse to see mesh + cursor
  await page.mouse.move(700, 450);
  await page.waitForTimeout(500);
  await page.mouse.move(750, 400);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/v5-mesh.png' });

  // Scroll to first content section
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-section1.png' });

  // Scroll deeper to see connectors + glows
  await page.evaluate(() => window.scrollTo(0, 2400));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-section2.png' });

  // Full page
  await page.screenshot({ path: 'screenshots/v5-full.png', fullPage: true });

  await browser.close();
  console.log('Screenshots saved.');
})();
