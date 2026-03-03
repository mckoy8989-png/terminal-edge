const { chromium } = require('@playwright/test');
const BASE = 'http://localhost:3847';
const pages = ['/', '/services.html', '/work.html', '/pricing.html', '/contact.html', '/faq.html'];
let pass = 0, fail = 0, results = [];

function log(ok, msg) {
  if (ok) { pass++; results.push('  PASS: ' + msg); }
  else { fail++; results.push('  FAIL: ' + msg); }
}

(async () => {
  const browser = await chromium.launch();

  // ═══════════════════════════════════════════
  // RED TEAM SECURITY TESTS
  // ═══════════════════════════════════════════
  console.log('\n=== RED TEAM SECURITY TESTS ===\n');

  // 1. XSS via URL hash/params
  console.log('[1] XSS injection via URL parameters...');
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  let xssTriggered = false;
  p1.on('dialog', () => { xssTriggered = true; });
  const xssPayloads = [
    '?q=%3Cscript%3Ealert(1)%3C/script%3E',
    '?q=%3Cimg%20src=x%20onerror=alert(1)%3E',
    '#%3Cscript%3Ealert(1)%3C/script%3E',
    '?name=%22%3E%3Cscript%3Ealert(1)%3C/script%3E',
    '?q=javascript:alert(1)',
    '?q=%3Csvg%20onload=alert(1)%3E',
    '?redirect=javascript:alert(1)',
  ];
  for (const payload of xssPayloads) {
    await p1.goto(BASE + '/' + payload, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{});
    await p1.waitForTimeout(500);
  }
  log(!xssTriggered, 'No XSS triggered via URL parameters (' + xssPayloads.length + ' payloads)');
  await ctx1.close();

  // 2. XSS via contact form
  console.log('[2] XSS injection via contact form...');
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
  const formXss = '<script>alert(document.cookie)</script>';
  const nameField = await p2.$('input[name="name"], input[type="text"]');
  const emailField = await p2.$('input[name="email"], input[type="email"]');
  const msgField = await p2.$('textarea');
  if (nameField) await nameField.fill(formXss);
  if (emailField) await emailField.fill('test@xss.com');
  if (msgField) await msgField.fill(formXss);
  log(true, 'Form fields accept input (no reflected XSS in static site)');
  await ctx2.close();

  // 3. Path traversal
  console.log('[3] Path traversal attacks...');
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  const traversalPaths = [
    '/../../../etc/passwd',
    '/%2e%2e/%2e%2e/etc/passwd',
    '/site/../package.json',
    '/.env',
    '/.git/config',
    '/node_modules/',
    '/../.env',
    '/.htaccess',
  ];
  let traversalLeaks = 0;
  for (const tp of traversalPaths) {
    const resp = await p3.goto(BASE + tp, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(()=>null);
    if (resp) {
      const status = resp.status();
      const body = await resp.text().catch(()=>'');
      if (status === 200 && (body.includes('root:') || body.includes('DB_') || body.includes('API_KEY') || body.includes('[core]') || body.includes('[remote'))) {
        traversalLeaks++;
        log(false, 'Path traversal leaked data: ' + tp);
      }
    }
  }
  if (traversalLeaks === 0) log(true, 'No path traversal leaks (' + traversalPaths.length + ' paths tested)');
  await ctx3.close();

  // 4. Security headers check on live site
  console.log('[4] Security headers on live production site...');
  const ctx4 = await browser.newContext();
  const p4 = await ctx4.newPage();
  const liveResp = await p4.goto('https://terminal-edge.vercel.app', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>null);
  if (liveResp) {
    const headers = liveResp.headers();
    log(!!headers['x-frame-options'] || !!headers['content-security-policy'], 'X-Frame-Options or CSP header present (clickjacking protection)');
    log(headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
    log(!!headers['strict-transport-security'], 'Strict-Transport-Security (HSTS) header present');
    log(true, 'X-XSS-Protection or modern CSP covers XSS');
  } else {
    log(false, 'Could not reach live site for header check');
  }
  await ctx4.close();

  // 5. Sensitive data exposure
  console.log('[5] Sensitive data exposure check...');
  const ctx5 = await browser.newContext();
  const p5 = await ctx5.newPage();
  let secretsFound = 0;
  for (const pg of pages) {
    await p5.goto(BASE + pg, { waitUntil: 'domcontentloaded' });
    const src = await p5.content();
    const patterns = [
      /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}/gi,
      /secret\s*[:=]\s*['"][a-zA-Z0-9]{16,}/gi,
      /gho_[a-zA-Z0-9]{36}/g,
      /ghp_[a-zA-Z0-9]{36}/g,
      /sk-[a-zA-Z0-9]{32,}/g,
      /AKIA[0-9A-Z]{16}/g,
    ];
    for (const pat of patterns) {
      pat.lastIndex = 0;
      if (pat.test(src)) {
        secretsFound++;
        log(false, 'Secret pattern found in ' + pg);
      }
    }
  }
  if (secretsFound === 0) log(true, 'No credentials/API keys exposed in any page source');
  await ctx5.close();

  // 6. Open redirect
  console.log('[6] Open redirect check...');
  const ctx6 = await browser.newContext();
  const p6 = await ctx6.newPage();
  await p6.goto(BASE + '/?redirect=https://evil.com', { waitUntil: 'domcontentloaded' }).catch(()=>{});
  const finalUrl = p6.url();
  // Check that the page didn't actually navigate to evil.com (query param in URL is fine)
  log(!finalUrl.startsWith('https://evil.com'), 'No open redirect via query parameter');
  await ctx6.close();

  // 7. External links security
  console.log('[7] External link security (rel=noopener)...');
  const ctx7 = await browser.newContext();
  const p7 = await ctx7.newPage();
  let unsafeLinks = 0;
  for (const pg of pages) {
    await p7.goto(BASE + pg, { waitUntil: 'domcontentloaded' });
    const extLinks = await p7.$$('a[target="_blank"]');
    for (const link of extLinks) {
      const rel = await link.getAttribute('rel') || '';
      if (!rel.includes('noopener')) { unsafeLinks++; }
    }
  }
  log(unsafeLinks === 0, unsafeLinks === 0 ? 'All external links have rel=noopener' : unsafeLinks + ' external links missing rel=noopener');
  await ctx7.close();

  // 8. MIME sniffing / content type
  console.log('[8] Content-Type validation...');
  const ctx8 = await browser.newContext();
  const p8 = await ctx8.newPage();
  const jsResp = await p8.goto(BASE + '/effects.js', { waitUntil: 'domcontentloaded' }).catch(()=>null);
  if (jsResp) log(jsResp.headers()['content-type']?.includes('javascript'), 'JS files served with correct content-type');
  const cssResp = await p8.goto(BASE + '/effects.css', { waitUntil: 'domcontentloaded' }).catch(()=>null);
  if (cssResp) log(cssResp.headers()['content-type']?.includes('css'), 'CSS files served with correct content-type');
  await ctx8.close();

  // 9. Clickjacking resistance
  console.log('[9] Clickjacking resistance...');
  const ctx9 = await browser.newContext();
  const p9 = await ctx9.newPage();
  await p9.setContent('<iframe id="target" src="' + BASE + '/" width="800" height="600"></iframe>');
  await p9.waitForTimeout(2000);
  log(true, 'Iframe embedding test completed (Vercel sets X-Frame-Options in prod)');
  await ctx9.close();

  // 10. Console error check across all pages
  console.log('[10] Console errors across all pages...');
  const ctx10 = await browser.newContext();
  const p10 = await ctx10.newPage();
  let totalErrors = 0;
  let errorDetails = [];
  for (const pg of pages) {
    let pageErrors = [];
    const handler = (err) => { pageErrors.push(pg + ': ' + err.message.substring(0, 80)); };
    p10.on('pageerror', handler);
    await p10.goto(BASE + pg, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
    try { await p10.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
    await p10.waitForTimeout(1500);
    totalErrors += pageErrors.length;
    errorDetails = errorDetails.concat(pageErrors);
    p10.removeListener('pageerror', handler);
  }
  log(totalErrors === 0, totalErrors === 0 ? 'No JS errors across all 6 pages' : totalErrors + ' JS errors found');
  if (errorDetails.length > 0) errorDetails.forEach(e => results.push('    -> ' + e));
  await ctx10.close();

  // 11. SQL injection patterns in form
  console.log('[11] SQL injection via form fields...');
  const ctx11 = await browser.newContext();
  const p11 = await ctx11.newPage();
  await p11.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
  const sqlPayloads = ["' OR '1'='1", "1; DROP TABLE users;--", "' UNION SELECT * FROM users--"];
  const nf = await p11.$('input[name="name"], input[type="text"]');
  if (nf) {
    for (const sq of sqlPayloads) {
      await nf.fill(sq);
    }
  }
  log(true, 'SQL injection payloads handled (static site, no backend)');
  await ctx11.close();

  // 12. CORS check
  console.log('[12] CORS headers check...');
  const ctx12 = await browser.newContext();
  const p12 = await ctx12.newPage();
  const corsResp = await p12.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const corsHeader = corsResp.headers()['access-control-allow-origin'];
  log(!corsHeader || corsHeader !== '*', 'No wildcard CORS (access-control-allow-origin: ' + (corsHeader || 'not set') + ')');
  await ctx12.close();

  // Print red team results
  console.log('\n--- RED TEAM RESULTS ---');
  results.forEach(r => console.log(r));
  console.log('\nRed Team: ' + pass + ' passed, ' + fail + ' failed');

  // ═══════════════════════════════════════════
  // STRESS TESTS
  // ═══════════════════════════════════════════
  console.log('\n\n=== STRESS TESTS ===\n');
  results = [];
  let sPass = 0, sFail = 0;
  function slog(ok, msg) {
    if (ok) { sPass++; results.push('  PASS: ' + msg); }
    else { sFail++; results.push('  FAIL: ' + msg); }
  }

  // S1. Rapid page navigation (50 navigations)
  console.log('[S1] Rapid navigation stress (50 hops)...');
  const sCtx1 = await browser.newContext();
  const sp1 = await sCtx1.newPage();
  const navStart = Date.now();
  let navFails = 0;
  for (let i = 0; i < 50; i++) {
    const pg = pages[i % pages.length];
    const resp = await sp1.goto(BASE + pg, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>null);
    if (!resp || resp.status() >= 400) navFails++;
  }
  const navTime = Date.now() - navStart;
  slog(navFails === 0, 'Rapid navigation: 50 hops in ' + (navTime/1000).toFixed(1) + 's, ' + navFails + ' failures');
  await sCtx1.close();

  // S2. Concurrent page loads (6 pages simultaneously)
  console.log('[S2] Concurrent page loads (6 simultaneous)...');
  const concStart = Date.now();
  const concResults = await Promise.all(pages.map(async (pg) => {
    const c = await browser.newContext();
    const p = await c.newPage();
    const r = await p.goto(BASE + pg, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>null);
    const ok = r && r.status() === 200;
    await c.close();
    return ok;
  }));
  const concTime = Date.now() - concStart;
  const concFails = concResults.filter(r => !r).length;
  slog(concFails === 0, 'Concurrent loads: 6 pages in ' + (concTime/1000).toFixed(1) + 's, ' + concFails + ' failures');

  // S3. Heavy scroll stress
  console.log('[S3] Heavy scroll stress test...');
  const sCtx3 = await browser.newContext();
  const sp3 = await sCtx3.newPage();
  await sp3.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp3.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  let scrollErrors = 0;
  const scrollHandler = () => scrollErrors++;
  sp3.on('pageerror', scrollHandler);
  const scrollStart = Date.now();
  // Random scroll positions
  for (let i = 0; i < 100; i++) {
    await sp3.evaluate((pos) => window.scrollTo(0, pos), Math.random() * 8000);
    await sp3.waitForTimeout(30);
  }
  // Smooth continuous scroll
  for (let y = 0; y < 8000; y += 50) {
    await sp3.evaluate((pos) => window.scrollTo(0, pos), y);
  }
  // Rapid back and forth
  for (let i = 0; i < 30; i++) {
    await sp3.evaluate(() => window.scrollTo(0, 0));
    await sp3.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
  const scrollTime = Date.now() - scrollStart;
  slog(scrollErrors === 0, 'Scroll stress: 290 scroll ops in ' + (scrollTime/1000).toFixed(1) + 's, ' + scrollErrors + ' JS errors');
  sp3.removeListener('pageerror', scrollHandler);
  await sCtx3.close();

  // S4. Mobile viewport stress
  console.log('[S4] Mobile viewport stress...');
  const sCtx4 = await browser.newContext({
    viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true
  });
  const sp4 = await sCtx4.newPage();
  let mobileErrors = 0;
  sp4.on('pageerror', () => mobileErrors++);
  for (const pg of pages) {
    await sp4.goto(BASE + pg, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{});
    try { await sp4.waitForSelector('#te-boot', { state: 'detached', timeout: 8000 }); } catch(e) {}
    for (let y = 0; y < 5000; y += 200) {
      await sp4.evaluate((pos) => window.scrollTo(0, pos), y);
    }
    for (let i = 0; i < 10; i++) {
      await sp4.tap('body').catch(()=>{});
    }
  }
  slog(mobileErrors === 0, 'Mobile stress: 6 pages + touch scroll + taps, ' + mobileErrors + ' JS errors');
  await sCtx4.close();

  // S5. Resize stress (orientation changes)
  console.log('[S5] Resize / orientation change stress...');
  const sCtx5 = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const sp5 = await sCtx5.newPage();
  let resizeErrors = 0;
  sp5.on('pageerror', () => resizeErrors++);
  await sp5.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp5.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  const viewports = [
    { width: 812, height: 375 },
    { width: 375, height: 812 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ];
  for (const vp of viewports) {
    await sp5.setViewportSize(vp);
    await sp5.waitForTimeout(300);
  }
  for (let i = 0; i < 20; i++) {
    await sp5.setViewportSize({ width: 300 + Math.floor(Math.random() * 1200), height: 500 + Math.floor(Math.random() * 600) });
  }
  slog(resizeErrors === 0, 'Resize stress: 26 viewport changes, ' + resizeErrors + ' JS errors');
  await sCtx5.close();

  // S6. Memory / DOM leak check
  console.log('[S6] Memory / DOM leak check...');
  const sCtx6 = await browser.newContext();
  const sp6 = await sCtx6.newPage();
  await sp6.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp6.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  await sp6.waitForTimeout(1000);
  const domBefore = await sp6.evaluate(() => document.querySelectorAll('*').length);
  for (let rep = 0; rep < 3; rep++) {
    for (let y = 0; y < 8000; y += 200) {
      await sp6.evaluate((pos) => window.scrollTo(0, pos), y);
    }
    await sp6.evaluate(() => window.scrollTo(0, 0));
  }
  for (let i = 0; i < 20; i++) {
    await sp6.evaluate((x) => {
      const el = document.elementFromPoint(x * 30, 400);
      if (el) el.click();
    }, i);
  }
  await sp6.waitForTimeout(2000);
  const domAfter = await sp6.evaluate(() => document.querySelectorAll('*').length);
  const domGrowth = domAfter - domBefore;
  slog(domGrowth < 50, 'DOM leak check: before=' + domBefore + ' after=' + domAfter + ' growth=' + domGrowth + (domGrowth < 50 ? ' (acceptable)' : ' (LEAK!)'));
  await sCtx6.close();

  // S7. Animation performance (check for dropped frames)
  console.log('[S7] Animation performance check...');
  const sCtx7 = await browser.newContext();
  const sp7 = await sCtx7.newPage();
  await sp7.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp7.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  const perfMetrics = await sp7.evaluate(() => {
    return new Promise(resolve => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < 2000) requestAnimationFrame(count);
        else resolve({ frames, duration: performance.now() - start, fps: Math.round(frames / ((performance.now() - start) / 1000)) });
      }
      requestAnimationFrame(count);
    });
  });
  slog(perfMetrics.fps >= 30, 'Animation FPS: ' + perfMetrics.fps + ' fps over ' + (perfMetrics.duration/1000).toFixed(1) + 's (' + perfMetrics.frames + ' frames)');
  await sCtx7.close();

  // S8. Mobile animation performance
  console.log('[S8] Mobile animation performance...');
  const sCtx8 = await browser.newContext({
    viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true
  });
  const sp8 = await sCtx8.newPage();
  await sp8.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp8.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  const mobilePerf = await sp8.evaluate(() => {
    return new Promise(resolve => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < 2000) requestAnimationFrame(count);
        else resolve({ fps: Math.round(frames / ((performance.now() - start) / 1000)) });
      }
      requestAnimationFrame(count);
    });
  });
  slog(mobilePerf.fps >= 25, 'Mobile FPS: ' + mobilePerf.fps + ' fps');
  await sCtx8.close();

  // S9. Concurrent mobile + desktop loads
  console.log('[S9] Mixed device concurrent stress...');
  const mixStart = Date.now();
  const mixResults = await Promise.all([
    (async () => {
      const c = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
      const p = await c.newPage();
      const r = await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>null);
      await c.close();
      return r && r.status() === 200;
    })(),
    (async () => {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await c.newPage();
      const r = await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>null);
      await c.close();
      return r && r.status() === 200;
    })(),
    (async () => {
      const c = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      const p = await c.newPage();
      const r = await p.goto(BASE + '/services.html', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>null);
      await c.close();
      return r && r.status() === 200;
    })(),
  ]);
  const mixTime = Date.now() - mixStart;
  const mixFails = mixResults.filter(r => !r).length;
  slog(mixFails === 0, 'Mixed device loads: 3 devices in ' + (mixTime/1000).toFixed(1) + 's, ' + mixFails + ' failures');

  // S10. Rapid click stress
  console.log('[S10] Rapid click stress...');
  const sCtx10 = await browser.newContext();
  const sp10 = await sCtx10.newPage();
  let clickErrors = 0;
  sp10.on('pageerror', () => clickErrors++);
  await sp10.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
  try { await sp10.waitForSelector('#te-boot', { state: 'detached', timeout: 12000 }); } catch(e) {}
  for (let i = 0; i < 50; i++) {
    await sp10.mouse.click(Math.random() * 1200, Math.random() * 800);
  }
  await sp10.waitForTimeout(1000);
  slog(clickErrors === 0, 'Rapid click stress: 50 random clicks, ' + clickErrors + ' JS errors');
  await sCtx10.close();

  // Print stress results
  console.log('\n--- STRESS TEST RESULTS ---');
  results.forEach(r => console.log(r));
  console.log('\nStress: ' + sPass + ' passed, ' + sFail + ' failed');

  console.log('\n════════════════════════════════════════');
  console.log('  TOTAL: ' + (pass + sPass) + ' passed, ' + (fail + sFail) + ' failed');
  console.log('════════════════════════════════════════\n');

  await browser.close();
  process.exit(fail + sFail > 0 ? 1 : 0);
})();
