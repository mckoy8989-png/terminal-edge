// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3847';
const PAGES = [
  { name: 'index', url: '/', title: 'Terminal Edge' },
  { name: 'services', url: '/services.html', title: 'Services' },
  { name: 'work', url: '/work.html', title: 'Work' },
  { name: 'pricing', url: '/pricing.html', title: 'Pricing' },
  { name: 'contact', url: '/contact.html', title: 'Contact' },
  { name: 'faq', url: '/faq.html', title: 'FAQ' },
];

// ═══════════════════════════════════════════
// PHASE 1: PAGE LOAD & STRUCTURE TESTS
// ═══════════════════════════════════════════
test.describe('Page Load & Structure', () => {
  for (const page of PAGES) {
    test(`${page.name} loads successfully`, async ({ page: p }) => {
      const res = await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded' });
      expect(res.status()).toBe(200);
    });

    test(`${page.name} has correct meta tags`, async ({ page: p }) => {
      await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded' });
      const viewport = await p.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });

    test(`${page.name} has nav with logo`, async ({ page: p }) => {
      await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded' });
      await expect(p.locator('nav .logo')).toBeVisible();
    });

    test(`${page.name} has footer`, async ({ page: p }) => {
      await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded' });
      await expect(p.locator('footer')).toBeAttached();
    });

    test(`${page.name} has hero canvas`, async ({ page: p }) => {
      await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded' });
      await expect(p.locator('#heroCanvas')).toBeAttached();
    });
  }
});

// ═══════════════════════════════════════════
// PHASE 2: NAVIGATION & LINK INTEGRITY
// ═══════════════════════════════════════════
test.describe('Navigation', () => {
  test('nav links are present and point to valid pages', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const navLinks = page.locator('.nav-links a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('burger menu toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const burger = page.locator('#burger');
    await expect(burger).toBeVisible();
    await burger.click();
    await page.waitForTimeout(500);
    const mobMenu = page.locator('#mobMenu');
    const isOpen = await mobMenu.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(true);
  });

  test('all internal links resolve to valid pages', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const internalLinks = await page.locator('a[href]').evaluateAll(links =>
      links
        .map(l => l.getAttribute('href'))
        .filter(h => h && !h.startsWith('http') && !h.startsWith('mailto:') && !h.startsWith('#') && !h.startsWith('javascript:'))
    );
    const unique = [...new Set(internalLinks)];
    for (const href of unique) {
      const res = await page.request.get(BASE + '/' + href.replace(/^\//, ''));
      expect(res.status(), `Link ${href} should return 200`).toBe(200);
    }
  });
});

// ═══════════════════════════════════════════
// PHASE 3: CONTACT FORM VALIDATION
// ═══════════════════════════════════════════
test.describe('Contact Form', () => {
  test('form has all required fields', async ({ page }) => {
    await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#cf-name')).toBeAttached();
    await expect(page.locator('#cf-email')).toBeAttached();
    await expect(page.locator('#cf-service')).toBeAttached();
    await expect(page.locator('#cf-budget')).toBeAttached();
    await expect(page.locator('#cf-timeline')).toBeAttached();
    await expect(page.locator('#cf-details')).toBeAttached();
    await expect(page.locator('#submitBtn')).toBeAttached();
  });

  test('form validates required fields', async ({ page }) => {
    await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#submitBtn').click();
    const nameValidity = await page.locator('#cf-name').evaluate(el => el.validity.valid);
    expect(nameValidity).toBe(false);
  });

  test('email field validates format', async ({ page }) => {
    await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#cf-email').fill('not-an-email');
    const emailValid = await page.locator('#cf-email').evaluate(el => el.validity.valid);
    expect(emailValid).toBe(false);
  });
});

// ═══════════════════════════════════════════
// PHASE 4: RESPONSIVE DESIGN
// ═══════════════════════════════════════════
test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`index renders at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      const body = page.locator('body');
      await expect(body).toBeVisible();
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(overflow, 'No horizontal scroll overflow').toBe(false);
    });
  }
});

// ═══════════════════════════════════════════
// PHASE 5: ACCESSIBILITY
// ═══════════════════════════════════════════
test.describe('Accessibility', () => {
  test('burger button has aria-label', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const ariaLabel = await page.locator('#burger').getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('FAQ buttons have aria-expanded', async ({ page }) => {
    await page.goto(BASE + '/faq.html', { waitUntil: 'domcontentloaded' });
    const faqBtns = page.locator('.faq-q[aria-expanded]');
    const count = await faqBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('all form inputs have labels', async ({ page }) => {
    await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input[id], select[id], textarea[id]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const label = page.locator(`label[for="${id}"]`);
      await expect(label, `Label for ${id}`).toBeAttached();
    }
  });
});

// ═══════════════════════════════════════════
// PHASE 6: SECURITY / RED TEAM
// ═══════════════════════════════════════════
test.describe('Security & Red Team', () => {
  test('no inline event handlers in HTML (XSS surface)', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const onclickElements = await page.locator('[onclick], [onerror], [onload], [onmouseover]').count();
    expect(onclickElements, 'No inline event handlers').toBe(0);
  });

  test('contact form resists XSS input', async ({ page }) => {
    await page.goto(BASE + '/contact.html', { waitUntil: 'domcontentloaded' });
    let dialogFired = false;
    page.on('dialog', () => { dialogFired = true; });
    const xssPayload = '<script>alert("xss")</script>';
    await page.locator('#cf-name').fill(xssPayload);
    await page.locator('#cf-email').fill('test@test.com');
    await page.locator('#cf-details').fill(xssPayload);
    await page.waitForTimeout(1000);
    expect(dialogFired, 'XSS payload should not trigger dialog').toBe(false);
  });

  test('external links use rel=noopener', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      expect(rel, 'External links should have rel=noopener').toContain('noopener');
    }
  });

  test('no exposed credentials in page source', async ({ page }) => {
    for (const pg of PAGES) {
      await page.goto(BASE + pg.url, { waitUntil: 'domcontentloaded' });
      const source = await page.content();
      expect(source).not.toMatch(/gho_[A-Za-z0-9]{30,}/);
      expect(source).not.toMatch(/ghp_[A-Za-z0-9]{30,}/);
      expect(source).not.toMatch(/sk-[A-Za-z0-9]{30,}/);
      expect(source).not.toMatch(/AKIA[A-Z0-9]{16}/);
    }
  });
});

// ═══════════════════════════════════════════
// PHASE 7: PERFORMANCE & STRESS TESTS
// ═══════════════════════════════════════════
test.describe('Performance & Stress', () => {
  test('page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('DOM element count is reasonable', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const count = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(count).toBeLessThan(5000);
  });

  test('no console errors on page load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e => !e.includes('net::ERR') && !e.includes('Failed to load'));
    expect(realErrors.length, `Console errors: ${realErrors.join(', ')}`).toBe(0);
  });

  test('rapid navigation stress test', async ({ page }) => {
    for (const pg of PAGES) {
      await page.goto(BASE + pg.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }
    expect(true).toBe(true);
  });

  test('scroll stress test on index', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(100);
    }
    await expect(page.locator('nav')).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// PHASE 8: INTERACTIVE ELEMENTS
// ═══════════════════════════════════════════
test.describe('Interactive Elements', () => {
  test('FAQ accordion opens on click', async ({ page }) => {
    await page.goto(BASE + '/faq.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const firstQ = page.locator('.faq-q').first();
    await firstQ.click();
    await page.waitForTimeout(500);
    const expanded = await firstQ.getAttribute('aria-expanded');
    expect(expanded).toBe('true');
  });

  test('FAQ filter tabs work', async ({ page }) => {
    await page.goto(BASE + '/faq.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const techTab = page.locator('.faq-tab[data-filter="technical"]');
    await techTab.click();
    await page.waitForTimeout(500);
    const isActive = await techTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('pricing FAQ accordion works', async ({ page }) => {
    await page.goto(BASE + '/pricing.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const firstQ = page.locator('.pfaq-q').first();
    await firstQ.click();
    await page.waitForTimeout(500);
    const parent = page.locator('.pfaq-it').first();
    const isOpen = await parent.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(true);
  });

  test('work page filter works', async ({ page }) => {
    await page.goto(BASE + '/work.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const aiFilter = page.locator('.filter-btn[data-filter="ai"]');
    await aiFilter.click();
    await page.waitForTimeout(500);
    const isActive = await aiFilter.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });
});

// ═══════════════════════════════════════════
// PHASE 9: CSS & STYLING
// ═══════════════════════════════════════════
test.describe('CSS & Styling', () => {
  test('shared styles.css loads', async ({ page }) => {
    await page.goto(BASE + '/services.html', { waitUntil: 'domcontentloaded' });
    const cssLink = page.locator('link[rel="stylesheet"][href*="styles"]');
    await expect(cssLink).toBeAttached();
  });

  test('CSS custom properties are defined', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    );
    expect(bgColor).toBeTruthy();
  });

  test('dark theme is applied', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });
});
