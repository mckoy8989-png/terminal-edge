const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Desktop view
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/desktop-hero.png', fullPage: false });
  await page.screenshot({ path: 'screenshots/desktop-full.png', fullPage: true });
  
  // Mobile view
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/mobile-hero.png', fullPage: false });
  await page.screenshot({ path: 'screenshots/mobile-full.png', fullPage: true });
  
  // Check for console errors
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Check broken elements
  const results = await page.evaluate(() => {
    const issues = [];
    
    // Check for elements overflowing viewport
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        issues.push(`OVERFLOW: ${el.tagName}.${el.className} overflows by ${Math.round(rect.right - window.innerWidth)}px`);
      }
    });
    
    // Check for overlapping text
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    headings.forEach(h => {
      if (h.offsetHeight === 0) issues.push(`HIDDEN: ${h.tagName} "${h.textContent.slice(0,30)}..." has 0 height`);
    });
    
    // Check images/icons loading
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
      if (!img.complete || img.naturalHeight === 0) issues.push(`BROKEN IMG: ${img.src}`);
    });
    
    // Check links
    const links = document.querySelectorAll('a[href]');
    const brokenLinks = [];
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' || href === '') brokenLinks.push(`DEAD LINK: "${a.textContent.trim().slice(0,30)}" -> ${href}`);
    });
    issues.push(...brokenLinks);
    
    // Check z-index stacking issues
    const nav = document.querySelector('.navbar');
    if (nav) {
      const navZ = window.getComputedStyle(nav).zIndex;
      issues.push(`NAV z-index: ${navZ}`);
    }
    
    // Check form functionality
    const form = document.querySelector('#contactForm');
    if (!form) issues.push('MISSING: Contact form not found');
    
    // Check mobile menu
    const mobileMenu = document.querySelector('.mobile-menu');
    if (!mobileMenu) issues.push('MISSING: Mobile menu not found');
    
    // Check sections exist
    ['#services', '#work', '#pricing', '#faq', '#contact'].forEach(id => {
      if (!document.querySelector(id)) issues.push(`MISSING SECTION: ${id}`);
    });
    
    // Check animation classes
    const reveals = document.querySelectorAll('.reveal:not(.visible)');
    issues.push(`UNREVEALED: ${reveals.length} elements still hidden (may need scroll)`);
    
    // Check terminal animation
    const terminal = document.getElementById('typeTarget');
    if (!terminal) issues.push('MISSING: Terminal typing animation target');
    
    // Check particle canvas
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) issues.push('MISSING: Hero canvas for particles');
    if (canvas && (canvas.width === 0 || canvas.height === 0)) issues.push('BUG: Canvas has 0 dimensions');
    
    // Check font loading
    const testEl = document.createElement('span');
    testEl.style.fontFamily = "'Space Grotesk'";
    testEl.textContent = 'test';
    document.body.appendChild(testEl);
    const fontLoaded = window.getComputedStyle(testEl).fontFamily.includes('Space Grotesk');
    document.body.removeChild(testEl);
    if (!fontLoaded) issues.push('FONT: Space Grotesk may not be loaded');
    
    return issues;
  });
  
  console.log('=== SITE AUDIT RESULTS ===');
  console.log('Console errors:', errors.length ? errors.join('\n') : 'None');
  console.log('---');
  results.forEach(r => console.log(r));
  console.log('=== END AUDIT ===');
  
  await browser.close();
})();
