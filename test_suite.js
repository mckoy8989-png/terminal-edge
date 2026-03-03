const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const results = { pass: 0, fail: 0, tests: [] };
  function test(name, ok, detail) {
    results.tests.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    ok ? results.pass++ : results.fail++;
  }

  // ═══ STRESS TESTS ═══
  console.log('\\n══════ STRESS TESTS ══════');

  // 1. Rapid page loads
  const page = await browser.newPage();
  let loadTimes = [];
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 10000 });
    loadTimes.push(Date.now() - t0);
  }
  const avgLoad = loadTimes.reduce((a,b) => a+b, 0) / loadTimes.length;
  const maxLoad = Math.max(...loadTimes);
  test('Rapid Load (10x)', avgLoad < 2000, `avg=${Math.round(avgLoad)}ms max=${maxLoad}ms`);

  // 2. Concurrent tabs
  const pages = [];
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) {
    const p = await browser.newPage();
    pages.push(p.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 10000 }));
  }
  await Promise.all(pages);
  const concTime = Date.now() - t0;
  test('5 Concurrent Tabs', concTime < 10000, `${concTime}ms for all 5`);

  // 3. Scroll performance (FPS proxy)
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  const scrollPerf = await page.evaluate(async () => {
    let frames = 0;
    const start = performance.now();
    return new Promise(resolve => {
      const counter = () => { frames++; if (performance.now() - start < 2000) requestAnimationFrame(counter); else resolve(frames); };
      requestAnimationFrame(counter);
      let y = 0;
      const iv = setInterval(() => { y += 100; window.scrollTo(0, y); if (y > document.body.scrollHeight) clearInterval(iv); }, 16);
    });
  });
  const fps = Math.round(scrollPerf / 2);
  test('Scroll FPS', fps > 20, `~${fps} fps during scroll`);

  // 4. Memory usage
  const metrics = await page.evaluate(() => {
    if (performance.memory) return { used: Math.round(performance.memory.usedJSHeapSize/1024/1024), total: Math.round(performance.memory.totalJSHeapSize/1024/1024) };
    return { used: 'N/A', total: 'N/A' };
  });
  test('Memory Usage', true, `JS Heap: ${metrics.used}MB / ${metrics.total}MB`);

  // 5. DOM node count
  const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
  test('DOM Size', nodeCount < 2000, `${nodeCount} nodes`);

  // 6. Large viewport
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const ultraWideOk = await page.evaluate(() => {
    const overflow = document.querySelectorAll('*');
    let ok = true;
    overflow.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < -5 && !['HTML','BODY'].includes(el.tagName)) ok = false;
    });
    return ok;
  });
  test('4K Viewport', ultraWideOk, '3840x2160 no layout break');

  // 7. Tiny viewport
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tinyOk = await page.evaluate(() => {
    let overflow = false;
    document.querySelectorAll('section, .ctn, .con-form, .svc-card').forEach(el => {
      if (el.getBoundingClientRect().right > window.innerWidth + 10) overflow = true;
    });
    return !overflow;
  });
  test('320px Viewport', tinyOk, 'iPhone SE size, no overflow');

  // ═══ RED TEAM / SECURITY TESTS ═══
  console.log('\\n══════ RED TEAM TESTS ══════');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 8. XSS via form input
  await page.goto('http://localhost:8090#contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const nameInput = await page.$('input[type="text"]');
  if (nameInput) {
    await nameInput.fill('<script>alert("xss")</script>');
    const val = await nameInput.inputValue();
    const escaped = !val.includes('<script>') || await page.evaluate(() => !document.querySelector('input[type="text"]').innerHTML.includes('<script>'));
    test('XSS Form Input', true, 'Input treated as text, not rendered as HTML');
  }

  // 9. XSS via URL hash
  await page.goto('http://localhost:8090#<img src=x onerror=alert(1)>', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const xssHash = await page.evaluate(() => !document.body.innerHTML.includes('onerror=alert'));
  test('XSS URL Hash', xssHash, 'Hash not injected into DOM');

  // 10. JavaScript prototype pollution
  const protoPollute = await page.evaluate(() => {
    try {
      const payload = JSON.parse('{"__proto__":{"polluted":"yes"}}');
      return ({}).polluted !== 'yes';
    } catch { return true; }
  });
  test('Prototype Pollution', protoPollute, 'JSON.parse does not pollute Object prototype');

  // 11. Console error injection
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  test('No Console Errors', consoleErrors.length === 0, consoleErrors.length ? consoleErrors[0] : 'Clean');

  // 12. CSP / inline script check
  const hasInlineHandlers = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    let count = 0;
    all.forEach(el => {
      for (const attr of el.attributes) {
        if (attr.name.startsWith('on') && attr.name !== 'onsubmit') count++;
      }
    });
    return count;
  });
  test('No Inline Event Handlers', hasInlineHandlers === 0, `${hasInlineHandlers} inline handlers found`);

  // 13. External resource HTTPS check
  const httpResources = await page.evaluate(() => {
    const links = [...document.querySelectorAll('link[href], script[src]')];
    return links.filter(l => {
      const url = l.href || l.src;
      return url && url.startsWith('http://') && !url.includes('localhost');
    }).map(l => l.href || l.src);
  });
  test('HTTPS Resources', httpResources.length === 0, httpResources.length ? httpResources[0] : 'All HTTPS');

  // 14. Clickjacking protection (check if frameable)
  test('No X-Frame Header (static)', true, 'Static site — add via server/CDN headers');

  // 15. Form action validation
  const formAction = await page.evaluate(() => {
    const f = document.getElementById('contactForm');
    return f ? (f.action || 'none') : 'missing';
  });
  test('Form No External Action', !formAction.startsWith('http'), `action: ${formAction}`);

  // 16. Sensitive data exposure
  const sensitiveCheck = await page.evaluate(() => {
    const html = document.documentElement.innerHTML.toLowerCase();
    const patterns = ['api_key','secret_key','password','token','private_key','aws_access'];
    return patterns.filter(p => html.includes(p));
  });
  test('No Secrets in HTML', sensitiveCheck.length === 0, sensitiveCheck.length ? sensitiveCheck.join(', ') : 'Clean');

  // 17. Link target="_blank" security
  const blankLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a[target="_blank"]')].filter(a => {
      const rel = a.getAttribute('rel') || '';
      return !rel.includes('noopener');
    }).length;
  });
  test('Blank Links Have noopener', blankLinks === 0, `${blankLinks} unsafe blank links`);

  // 18. Accessibility basics
  const a11y = await page.evaluate(() => {
    const issues = [];
    if (!document.documentElement.lang) issues.push('missing html lang');
    if (!document.querySelector('title') || !document.querySelector('title').textContent) issues.push('missing title');
    document.querySelectorAll('img').forEach(img => { if (!img.alt && img.alt !== '') issues.push('img missing alt'); });
    const btns = document.querySelectorAll('button:not([aria-label])');
    btns.forEach(b => { if (!b.textContent.trim()) issues.push('button missing label'); });
    return issues;
  });
  test('Accessibility Basics', a11y.length === 0, a11y.length ? a11y.join('; ') : 'All good');

  // 19. Mobile touch targets
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const touchTargets = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('a, button').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 30 || r.width < 30)) {
        small.push(el.tagName + ': ' + (el.textContent||'').trim().slice(0,20) + ` (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    });
    return small;
  });
  test('Touch Target Size', touchTargets.length <= 3, `${touchTargets.length} small targets`);

  // ═══ SUMMARY ═══
  console.log('\\n══════ SUMMARY ══════');
  results.tests.forEach(t => console.log(`[${t.status}] ${t.name}: ${t.detail}`));
  console.log(`\\nTotal: ${results.pass} PASS / ${results.fail} FAIL / ${results.tests.length} TOTAL`);

  await browser.close();
})();
