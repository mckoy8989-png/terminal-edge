const { chromium } = require('playwright');
const BASE = 'http://localhost:8090';
const PAGES = ['index.html','services.html','work.html','pricing.html','faq.html','contact.html'];

(async () => {
  const browser = await chromium.launch();
  console.log('\n══════════════════════════════════════');
  console.log(' DEEP COMPONENT AUDIT — ALL PAGES');
  console.log('══════════════════════════════════════\n');

  const allIssues = [];

  for (const pg of PAGES) {
    console.log(`\n━━ ${pg.toUpperCase()} ━━`);
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    // Track failed network requests
    const failedRequests = [];
    const slowRequests = [];
    page.on('requestfailed', req => {
      failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
    });
    page.on('response', res => {
      if (res.status() >= 400) {
        failedRequests.push({ url: res.url(), error: `HTTP ${res.status()}` });
      }
    });

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const t0 = Date.now();
    await page.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle', timeout: 20000 });
    const loadTime = Date.now() - t0;
    console.log(`  Load time: ${loadTime}ms`);

    // Trigger all animations
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // 1. Check ALL images/SVGs
    const imageIssues = await page.evaluate(() => {
      const issues = [];
      // Check <img> tags
      document.querySelectorAll('img').forEach((img, i) => {
        const rect = img.getBoundingClientRect();
        if (!img.complete || img.naturalWidth === 0) {
          issues.push(`img[${i}] broken: src="${img.src}"`);
        }
        if (img.src && !img.alt) {
          issues.push(`img[${i}] missing alt: src="${img.src}"`);
        }
      });
      // Check background images
      document.querySelectorAll('*').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(') && !bg.includes('data:') && !bg.includes('gradient')) {
          issues.push(`bg-image: ${bg.substring(0, 80)} on ${el.tagName}.${el.className.substring(0,20)}`);
        }
      });
      // Check SVGs render (non-zero size)
      document.querySelectorAll('svg').forEach((svg, i) => {
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          const parent = svg.parentElement;
          const parentVisible = parent ? getComputedStyle(parent).display !== 'none' : true;
          if (parentVisible) {
            issues.push(`svg[${i}] zero-size in ${parent?.className?.substring(0,30) || parent?.tagName}`);
          }
        }
      });
      return issues;
    });

    // 2. Check all sections/components visible
    const hiddenComponents = await page.evaluate(() => {
      const issues = [];
      const sections = document.querySelectorAll('section, .page-hero, .sec, .ctn');
      sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();
        const style = getComputedStyle(sec);
        if (rect.height < 1 && style.display !== 'none') {
          issues.push(`zero-height: ${sec.tagName}.${sec.className.substring(0, 40)}`);
        }
      });
      // Check cards
      document.querySelectorAll('.card, .svc-card, .show-card, .price-card, .test-card, .feat-card, .tech-i, .faq-it, .con-m, [class*="card"]').forEach(card => {
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        if (rect.height < 1 && style.display !== 'none' && style.visibility !== 'hidden') {
          issues.push(`zero-height card: .${card.className.substring(0, 40)}`);
        }
      });
      return issues;
    });

    // 3. Check GSAP animations actually resolved (opacity > 0)
    const stuckAnimations = await page.evaluate(() => {
      const issues = [];
      document.querySelectorAll('.gs-hide, .gs-left, .gs-right, .gs-scale').forEach(el => {
        const style = getComputedStyle(el);
        const opacity = parseFloat(style.opacity);
        const rect = el.getBoundingClientRect();
        // Only flag if element is in viewport area (was supposed to animate)
        if (opacity < 0.1 && rect.top < window.innerHeight * 3) {
          issues.push(`stuck invisible: .${el.className.substring(0,40)} opacity=${opacity}`);
        }
      });
      return issues;
    });

    // 4. Check layout/overflow issues
    const layoutIssues = await page.evaluate(() => {
      const issues = [];
      const bodyW = document.body.scrollWidth;
      const winW = window.innerWidth;
      if (bodyW > winW + 5) {
        issues.push(`horizontal overflow: body=${bodyW} window=${winW}`);
        // Find the overflowing element
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winW + 10 && rect.width > 50) {
            issues.push(`  overflows: ${el.tagName}.${el.className.substring(0,30)} right=${Math.round(rect.right)}`);
          }
        });
      }
      return issues;
    });

    // 5. Check all links point somewhere valid
    const brokenLinks = await page.evaluate(() => {
      const issues = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!href || href === '#' || href === '') {
          issues.push(`empty link: "${a.textContent.trim().substring(0, 30)}"`);
        }
        if (href && href.startsWith('#') && href.length > 1) {
          const target = document.querySelector(href);
          if (!target) {
            issues.push(`broken anchor: ${href} (text: "${a.textContent.trim().substring(0, 30)}")`);
          }
        }
      });
      return issues;
    });

    // 6. Check fonts loaded
    const fontsLoaded = await page.evaluate(() => {
      const body = getComputedStyle(document.body).fontFamily;
      return body;
    });

    // 7. Check nav & footer integrity
    const navFooter = await page.evaluate(() => {
      const issues = [];
      const nav = document.querySelector('nav');
      if (!nav) issues.push('missing nav');
      const logo = document.querySelector('a.logo');
      if (!logo) issues.push('missing logo');
      const navLinks = document.querySelectorAll('.nav-links a');
      if (navLinks.length < 4) issues.push(`nav only ${navLinks.length} links`);
      const footer = document.querySelector('footer');
      if (!footer) issues.push('missing footer');
      const footerLinks = document.querySelectorAll('footer a');
      if (footerLinks.length < 4) issues.push(`footer only ${footerLinks.length} links`);
      return issues;
    });

    // 8. Performance metrics
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: Math.round(nav?.domContentLoadedEventEnd || 0),
        domComplete: Math.round(nav?.domComplete || 0),
        resources: performance.getEntriesByType('resource').length,
        domNodes: document.querySelectorAll('*').length,
        jsHeap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : -1,
      };
    });

    // 9. Mobile check (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const mobileIssues = await page.evaluate(() => {
      const issues = [];
      const bodyW = document.body.scrollWidth;
      const winW = window.innerWidth;
      if (bodyW > winW + 5) issues.push(`mobile overflow: body=${bodyW} win=${winW}`);
      // Check text not too small
      document.querySelectorAll('h1, h2, h3, p').forEach(el => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 10) issues.push(`tiny text (${size}px): ${el.tagName} "${el.textContent.substring(0,20)}"`);
      });
      // Burger visible
      const burger = document.querySelector('.burger');
      if (burger && getComputedStyle(burger).display === 'none') issues.push('burger hidden on mobile');
      return issues;
    });

    // Take screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/audit-${pg.replace('.html','')}.png`, fullPage: true });

    // Report
    const allPageIssues = [
      ...imageIssues.map(i => `[IMAGE] ${i}`),
      ...hiddenComponents.map(i => `[HIDDEN] ${i}`),
      ...stuckAnimations.map(i => `[ANIM] ${i}`),
      ...layoutIssues.map(i => `[LAYOUT] ${i}`),
      ...brokenLinks.map(i => `[LINK] ${i}`),
      ...navFooter.map(i => `[NAV/FOOTER] ${i}`),
      ...mobileIssues.map(i => `[MOBILE] ${i}`),
      ...failedRequests.map(r => `[NETWORK] Failed: ${r.url} (${r.error})`),
      ...consoleErrors.map(e => `[CONSOLE] ${e.substring(0, 100)}`),
    ];

    console.log(`  DOM nodes: ${perf.domNodes} | Resources: ${perf.resources} | Heap: ${perf.jsHeap}MB`);
    console.log(`  Font: ${fontsLoaded.substring(0, 50)}`);

    if (allPageIssues.length === 0) {
      console.log(`  ✅ No issues found`);
    } else {
      allPageIssues.forEach(i => console.log(`  ❌ ${i}`));
      allIssues.push(...allPageIssues.map(i => `[${pg}] ${i}`));
    }

    await page.close();
  }

  // ═══ SUMMARY ═══
  console.log('\n══════════════════════════════════════');
  if (allIssues.length === 0) {
    console.log(' ✅ ALL PAGES CLEAN — 0 ISSUES');
  } else {
    console.log(` ❌ TOTAL ISSUES: ${allIssues.length}`);
    allIssues.forEach(i => console.log(`  ${i}`));
  }
  console.log('══════════════════════════════════════\n');

  await browser.close();
})();
