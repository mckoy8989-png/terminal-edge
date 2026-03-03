const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console messages and errors
  const logs = [];
  const errors = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  // Load the live site
  await page.goto('https://terminal-edge.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000); // Wait for boot sequence + effects

  // Check if effects.js loaded
  const effectsLoaded = await page.evaluate(() => {
    return {
      meshCanvas: !!document.getElementById('te-mesh'),
      cursorRing: !!document.getElementById('te-ring'),
      cursorDot: !!document.getElementById('te-dot'),
      glowElements: document.querySelectorAll('.te-glow').length,
      connectors: document.querySelectorAll('.te-conn').length,
      progressBar: document.querySelectorAll('.te-progress').length,
      sectionCount: document.querySelectorAll('.sec').length,
      effectsScript: !!document.querySelector('script[src="effects.js"]'),
      effectsCss: !!document.querySelector('link[href="effects.css"]'),
      bodyChildren: Array.from(document.body.children).map(c => c.tagName + (c.id ? '#'+c.id : '') + (c.className ? '.'+c.className.split(' ')[0] : '')).join(', '),
      gsapLoaded: typeof gsap !== 'undefined',
      computedBg: getComputedStyle(document.body).backgroundColor
    };
  });

  console.log('\n=== EFFECTS STATUS ===');
  console.log(JSON.stringify(effectsLoaded, null, 2));

  console.log('\n=== CONSOLE ERRORS ===');
  errors.forEach(e => console.log('ERROR: ' + e));
  logs.filter(l => l.startsWith('[error]')).forEach(l => console.log(l));

  if (errors.length === 0 && logs.filter(l => l.startsWith('[error]')).length === 0) {
    console.log('No JS errors detected');
  }

  // Take screenshots
  await page.screenshot({ path: 'screenshots/diag-full.png', fullPage: true });
  await page.screenshot({ path: 'screenshots/diag-hero.png' }); // viewport only

  // Scroll down and take more
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/diag-section1.png' });

  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/diag-section2.png' });

  // Move mouse to trigger mesh
  await page.mouse.move(700, 400);
  await page.waitForTimeout(500);
  await page.mouse.move(800, 350);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/diag-mesh.png' });

  // Check services page too
  await page.goto('https://terminal-edge.vercel.app/services.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/diag-services.png' });

  const svcStatus = await page.evaluate(() => ({
    meshCanvas: !!document.getElementById('te-mesh'),
    glowElements: document.querySelectorAll('.te-glow').length,
    connectors: document.querySelectorAll('.te-conn').length,
  }));
  console.log('\n=== SERVICES PAGE STATUS ===');
  console.log(JSON.stringify(svcStatus, null, 2));

  await browser.close();
  console.log('\nDone. Screenshots saved.');
})();
