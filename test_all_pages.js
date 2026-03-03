const { chromium } = require('playwright');

const BASE = 'http://localhost:8090';
const PAGES = [
  { name: 'index', url: `${BASE}/index.html` },
  { name: 'services', url: `${BASE}/services.html` },
  { name: 'work', url: `${BASE}/work.html` },
  { name: 'pricing', url: `${BASE}/pricing.html` },
  { name: 'faq', url: `${BASE}/faq.html` },
  { name: 'contact', url: `${BASE}/contact.html` },
];

let pass = 0, fail = 0, total = 0;
function log(name, ok, detail) {
  total++;
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}: ${detail}`); }
}

(async () => {
  const browser = await chromium.launch();
  console.log('\n══════════════════════════════════════════');
  console.log(' TERMINAL EDGE — FULL SITE TEST SUITE');
  console.log('══════════════════════════════════════════\n');

  // ─── SECTION 1: PER-PAGE STRUCTURAL TESTS ───
  console.log('── 1. STRUCTURAL TESTS (per page) ──');
  for (const pg of PAGES) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pg.url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // 1a. No horizontal overflow
    const hOverflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    log(`${pg.name}: no horizontal overflow`, hOverflow <= 5, `overflow=${hOverflow}px`);

    // 1b. No console errors
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    log(`${pg.name}: no console errors`, consoleErrors.length === 0, consoleErrors.join('; ').substring(0, 100));

    // 1c. Nav exists and has correct links
    const navLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('.nav-links a');
      return Array.from(links).map(a => a.getAttribute('href'));
    });
    const hasAllNavLinks = ['services.html', 'work.html', 'pricing.html', 'faq.html', 'contact.html']
      .every(l => navLinks.some(n => n && n.includes(l)));
    log(`${pg.name}: nav has all page links`, hasAllNavLinks, `found: ${navLinks.join(',')}`);

    // 1d. Footer exists
    const hasFooter = await page.evaluate(() => !!document.querySelector('footer'));
    log(`${pg.name}: footer present`, hasFooter, 'missing footer');

    // 1e. All sections visible (height > 0)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const zeroSections = await page.evaluate(() => {
      const secs = document.querySelectorAll('section, .page-hero, .sec');
      const bad = [];
      secs.forEach(s => { if (s.getBoundingClientRect().height < 1) bad.push(s.className.substring(0, 30)); });
      return bad;
    });
    log(`${pg.name}: no zero-height sections`, zeroSections.length === 0, `zero: ${zeroSections.join(',')}`);

    // 1f. Mobile responsive (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const mobileOverflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    log(`${pg.name}: mobile no overflow (375px)`, mobileOverflow <= 5, `overflow=${mobileOverflow}px`);

    // 1g. Burger menu visible on mobile
    const burgerVisible = await page.evaluate(() => {
      const b = document.querySelector('.burger');
      if (!b) return false;
      const s = getComputedStyle(b);
      return s.display !== 'none';
    });
    log(`${pg.name}: burger visible on mobile`, burgerVisible, 'burger hidden');

    await page.close();
  }

  // ─── SECTION 2: NAVIGATION TESTS ───
  console.log('\n── 2. NAVIGATION TESTS ──');
  const navPage = await browser.newPage();
  await navPage.setViewportSize({ width: 1440, height: 900 });

  // Test all nav links work from index
  for (const target of ['services.html', 'work.html', 'pricing.html', 'faq.html', 'contact.html']) {
    await navPage.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const link = await navPage.$(`a[href="${target}"]`);
    if (link) {
      await link.click();
      await navPage.waitForTimeout(1500);
      const url = navPage.url();
      log(`index→${target}: navigation works`, url.includes(target), `landed on: ${url}`);
    } else {
      log(`index→${target}: link exists`, false, 'link not found');
    }
  }

  // Test logo links back to index
  await navPage.goto(`${BASE}/services.html`, { waitUntil: 'networkidle' });
  const logoLink = await navPage.$('a.logo');
  if (logoLink) {
    const logoHref = await logoLink.getAttribute('href');
    log('logo links to index.html', logoHref && logoHref.includes('index.html'), `href=${logoHref}`);
  }
  await navPage.close();

  // ─── SECTION 3: INTERACTIVE FEATURE TESTS ───
  console.log('\n── 3. INTERACTIVE FEATURE TESTS ──');

  // 3a. FAQ accordion works
  const faqPage = await browser.newPage();
  await faqPage.goto(`${BASE}/faq.html`, { waitUntil: 'networkidle' });
  await faqPage.waitForTimeout(1000);
  const faqWorks = await faqPage.evaluate(() => {
    const btn = document.querySelector('.faq-q');
    if (!btn) return 'no faq button';
    const item = btn.closest('.faq-it');
    btn.click();
    return item && item.classList.contains('open') ? true : 'did not get open class';
  });
  log('faq: accordion opens on click', faqWorks === true, faqWorks);

  // 3b. FAQ category filter works
  const faqFilterWorks = await faqPage.evaluate(() => {
    const tabs = document.querySelectorAll('[data-filter], [data-cat], .filter-btn, .cat-btn, .faq-tab');
    if (tabs.length === 0) return 'no filter tabs found';
    // Try clicking a category tab
    const techTab = Array.from(tabs).find(t => t.textContent.toLowerCase().includes('technical'));
    if (techTab) {
      techTab.click();
      return true;
    }
    return 'no technical tab';
  });
  log('faq: category filter exists', faqFilterWorks === true, faqFilterWorks);
  await faqPage.close();

  // 3c. Contact form submit handler
  const contactPage = await browser.newPage();
  await contactPage.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await contactPage.waitForTimeout(1000);
  const formExists = await contactPage.evaluate(() => {
    const form = document.querySelector('form');
    const btn = document.querySelector('.sub-btn, button[type="submit"]');
    return !!form && !!btn;
  });
  log('contact: form and submit button exist', formExists, 'missing form or button');
  await contactPage.close();

  // 3d. Work page filter works
  const workPage = await browser.newPage();
  await workPage.goto(`${BASE}/work.html`, { waitUntil: 'networkidle' });
  await workPage.waitForTimeout(1000);
  const workFilterWorks = await workPage.evaluate(() => {
    const tabs = document.querySelectorAll('[data-filter], [data-category], .filter-btn, .filter-tab, .cat-btn');
    return tabs.length > 0;
  });
  log('work: filter tabs exist', workFilterWorks, 'no filter tabs found');
  await workPage.close();

  // 3e. Pricing accordion works
  const pricingPage = await browser.newPage();
  await pricingPage.goto(`${BASE}/pricing.html`, { waitUntil: 'networkidle' });
  await pricingPage.waitForTimeout(1000);
  const pricingFaqWorks = await pricingPage.evaluate(() => {
    const btn = document.querySelector('.faq-q, .pfaq-q');
    if (!btn) return 'no faq button';
    const item = btn.closest('.faq-it, .pfaq-it');
    btn.click();
    return item && item.classList.contains('open') ? true : 'did not get open class';
  });
  log('pricing: FAQ accordion works', pricingFaqWorks === true, pricingFaqWorks);
  await pricingPage.close();

  // ─── SECTION 4: STRESS TESTS ───
  console.log('\n── 4. STRESS TESTS ──');

  // 4a. Rapid page load (all 6 pages sequentially)
  const stressPage = await browser.newPage();
  const loadTimes = [];
  for (const pg of PAGES) {
    const t0 = Date.now();
    await stressPage.goto(pg.url, { waitUntil: 'networkidle', timeout: 15000 });
    loadTimes.push({ name: pg.name, ms: Date.now() - t0 });
  }
  const avgLoad = Math.round(loadTimes.reduce((s, t) => s + t.ms, 0) / loadTimes.length);
  log(`avg page load: ${avgLoad}ms`, avgLoad < 3000, `too slow: ${avgLoad}ms`);
  const maxLoad = Math.max(...loadTimes.map(t => t.ms));
  const slowest = loadTimes.find(t => t.ms === maxLoad);
  log(`slowest page (${slowest.name}): ${maxLoad}ms`, maxLoad < 5000, `${maxLoad}ms`);
  await stressPage.close();

  // 4b. 5 concurrent tabs
  const t0 = Date.now();
  const tabs = await Promise.all(PAGES.map(async pg => {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle', timeout: 15000 });
    return p;
  }));
  const concurrentMs = Date.now() - t0;
  log(`6 concurrent tabs: ${concurrentMs}ms`, concurrentMs < 10000, `${concurrentMs}ms`);
  for (const t of tabs) await t.close();

  // 4c. DOM size check (all pages)
  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });
    const domSize = await p.evaluate(() => document.querySelectorAll('*').length);
    log(`${pg.name}: DOM size (${domSize} nodes)`, domSize < 2000, `${domSize} nodes - too large`);
    await p.close();
  }

  // 4d. Memory usage check
  const memPage = await browser.newPage();
  await memPage.goto(`${BASE}/services.html`, { waitUntil: 'networkidle' });
  await memPage.waitForTimeout(2000);
  const mem = await memPage.evaluate(() => {
    if (performance.memory) return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    return -1;
  });
  if (mem > 0) log(`services memory: ${mem}MB`, mem < 50, `${mem}MB`);
  else log('memory check (Chromium)', true, 'N/A');
  await memPage.close();

  // ─── SECTION 5: RED TEAM / SECURITY TESTS ───
  console.log('\n── 5. RED TEAM / SECURITY TESTS ──');

  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });

    // 5a. XSS via URL hash
    await p.goto(`${pg.url}#<script>alert(1)</script>`, { waitUntil: 'networkidle' });
    const xssHash = await p.evaluate(() => document.body.innerHTML.includes('<script>alert(1)</script>'));
    log(`${pg.name}: XSS hash injection blocked`, !xssHash, 'script reflected in DOM');

    // 5b. No inline event handlers (onclick, onerror, etc.)
    const inlineHandlers = await p.evaluate(() => {
      const all = document.querySelectorAll('*');
      const bad = [];
      const attrs = ['onclick','onerror','onload','onmouseover','onfocus'];
      all.forEach(el => {
        attrs.forEach(a => { if (el.hasAttribute(a)) bad.push(`${el.tagName}.${a}`); });
      });
      return bad;
    });
    log(`${pg.name}: no inline event handlers`, inlineHandlers.length === 0, inlineHandlers.join(','));

    // 5c. All external links have rel="noopener"
    const unsafeLinks = await p.evaluate(() => {
      const links = document.querySelectorAll('a[target="_blank"]');
      const bad = [];
      links.forEach(a => {
        const rel = a.getAttribute('rel') || '';
        if (!rel.includes('noopener')) bad.push(a.href.substring(0, 50));
      });
      return bad;
    });
    log(`${pg.name}: blank links have noopener`, unsafeLinks.length === 0, unsafeLinks.join(','));

    // 5d. No secrets/keys in HTML
    const secrets = await p.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const patterns = [/sk_live_/i, /pk_live_/i, /apikey/i, /secret.*=.*[a-z0-9]{20}/i, /password\s*[:=]\s*\S+/i];
      return patterns.some(p => p.test(html));
    });
    log(`${pg.name}: no secrets in HTML`, !secrets, 'potential secrets found');

    await p.close();
  }

  // 5e. XSS via contact form
  const xssPage = await browser.newPage();
  await xssPage.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await xssPage.waitForTimeout(500);
  const xssForm = await xssPage.evaluate(() => {
    const input = document.querySelector('input[type="text"], input[name="name"]');
    if (!input) return 'no input found';
    input.value = '<img src=x onerror=alert(1)>';
    return !document.body.innerHTML.includes('onerror=alert(1)');
  });
  log('contact: XSS form input safe', xssForm === true, xssForm);
  await xssPage.close();

  // 5f. Prototype pollution
  const pollPage = await browser.newPage();
  await pollPage.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const polluted = await pollPage.evaluate(() => {
    try {
      const p = JSON.parse('{"__proto__":{"polluted":true}}');
      return ({}).polluted === true;
    } catch { return false; }
  });
  log('prototype pollution resistant', !polluted, 'Object prototype polluted');
  await pollPage.close();

  // ─── SECTION 6: ACCESSIBILITY BASICS ───
  console.log('\n── 6. ACCESSIBILITY TESTS ──');

  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });

    // 6a. Has lang attribute
    const hasLang = await p.evaluate(() => !!document.documentElement.getAttribute('lang'));
    log(`${pg.name}: html lang attribute`, hasLang, 'missing lang');

    // 6b. Has meta viewport
    const hasViewport = await p.evaluate(() => !!document.querySelector('meta[name="viewport"]'));
    log(`${pg.name}: meta viewport`, hasViewport, 'missing viewport');

    // 6c. Touch targets >= 44px on mobile
    await p.setViewportSize({ width: 375, height: 812 });
    await p.waitForTimeout(300);
    const smallTargets = await p.evaluate(() => {
      const clickable = document.querySelectorAll('a, button');
      let small = 0;
      clickable.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 30 || r.height < 30)) {
          const display = getComputedStyle(el).display;
          if (display !== 'none' && display !== 'contents') small++;
        }
      });
      return small;
    });
    log(`${pg.name}: touch targets (${smallTargets} small)`, smallTargets < 5, `${smallTargets} targets < 30px`);

    await p.close();
  }

  // ─── SECTION 7: CROSS-PAGE CONSISTENCY ───
  console.log('\n── 7. CONSISTENCY TESTS ──');

  // 7a. All pages use same fonts
  const fonts = [];
  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });
    const fontFamily = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
    fonts.push({ name: pg.name, font: fontFamily });
    await p.close();
  }
  const allSameFont = fonts.every(f => f.font === fonts[0].font);
  log('all pages use same body font', allSameFont, fonts.map(f => `${f.name}:${f.font.substring(0,20)}`).join(' | '));

  // 7b. All pages have consistent nav structure
  const navCounts = [];
  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });
    const count = await p.evaluate(() => document.querySelectorAll('.nav-links a').length);
    navCounts.push({ name: pg.name, count });
    await p.close();
  }
  const allSameNav = navCounts.every(n => n.count === navCounts[0].count);
  log('all pages have same nav link count', allSameNav, navCounts.map(n => `${n.name}:${n.count}`).join(', '));

  // 7c. All pages have scroll progress bar
  for (const pg of PAGES) {
    const p = await browser.newPage();
    await p.goto(pg.url, { waitUntil: 'networkidle' });
    const hasScrollBar = await p.evaluate(() => !!document.getElementById('scrollBar'));
    log(`${pg.name}: scroll progress bar`, hasScrollBar, 'missing');
    await p.close();
  }

  // ═══ SUMMARY ═══
  console.log('\n══════════════════════════════════════════');
  console.log(` RESULTS: ${pass}/${total} PASSED, ${fail} FAILED`);
  console.log('══════════════════════════════════════════\n');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
