const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3847/', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for boot to finish and overlay to be removed
  console.log('Waiting for boot sequence to complete...');
  await page.waitForFunction(() => !document.getElementById('te-boot'), { timeout: 15000 });
  await page.waitForTimeout(1000); // Let animations settle
  console.log('Boot complete!');

  // Screenshot the HERO after boot
  await page.screenshot({ path: 'screenshots/v5-hero-real.png' });

  // Move mouse around to show Three.js + mesh
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(400 + i * 30, 300 + Math.sin(i) * 100);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v5-hero-interactive.png' });

  // Scroll to stats section
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-stats.png' });

  // Scroll to features with text reveals
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-features.png' });

  // Scroll to process + connectors
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-process.png' });

  // Scroll to tech/showcase
  await page.evaluate(() => window.scrollTo(0, 5000));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v5-showcase.png' });

  if (errors.length) {
    console.log('ERRORS:', errors.join('\n'));
  } else {
    console.log('No JS errors!');
  }

  await browser.close();
  console.log('Done.');
})();
