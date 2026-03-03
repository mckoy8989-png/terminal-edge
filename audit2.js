const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));

  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'screenshots/v2-desktop-hero.png', fullPage: false });

  // Scroll to trigger all GSAP animations
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-desktop-full.png', fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-mobile-hero.png', fullPage: false });
  await page.screenshot({ path: 'screenshots/v2-mobile-full.png', fullPage: true });

  // Test mobile menu
  await page.click('.burger');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-mobile-menu.png', fullPage: false });
  await page.click('[data-close]');
  await page.waitForTimeout(300);

  // Test FAQ
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8090#faq', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const faqBtns = await page.$$('.faq-q');
  if (faqBtns.length > 0) {
    await faqBtns[0].click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'screenshots/v2-faq-open.png', fullPage: false });

  // Audit
  const results = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 5 && !['HTML','BODY'].includes(el.tagName) && window.getComputedStyle(el).position !== 'fixed')
        issues.push('OVERFLOW: ' + el.tagName + '.' + (el.className||'').toString().slice(0,40) + ' +' + Math.round(r.right - window.innerWidth) + 'px');
    });
    // Check visibility of key sections
    ['#services','#work','#pricing','#faq','#contact'].forEach(id => {
      const el = document.querySelector(id);
      if (!el) { issues.push('MISSING: ' + id); return; }
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') issues.push('HIDDEN: ' + id);
    });
    // Check for still-hidden gs elements
    let hidden = 0;
    document.querySelectorAll('.gs-hide,.gs-left,.gs-right,.gs-scale').forEach(el => {
      if (parseFloat(window.getComputedStyle(el).opacity) < 0.1) hidden++;
    });
    issues.push('STILL_HIDDEN: ' + hidden + ' animated elements');
    // Dead links
    document.querySelectorAll('a[href="#"]').forEach(a => issues.push('DEAD_LINK: "' + a.textContent.trim().slice(0,25) + '"'));
    // Form check
    if (!document.getElementById('contactForm')) issues.push('MISSING: contactForm');
    return issues;
  });

  console.log('=== V2 AUDIT ===');
  console.log('JS Errors:', errors.length ? errors.join('; ') : 'NONE');
  results.forEach(r => console.log(r));
  console.log('=== END ===');

  await browser.close();
})();
