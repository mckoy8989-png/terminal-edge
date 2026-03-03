const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const pages = ['index.html', 'services.html', 'work.html', 'pricing.html', 'contact.html', 'faq.html'];
  
  console.log('=== PERFORMANCE BENCHMARK ===\n');
  
  for (const page of pages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await context.newPage();
    
    // Collect JS errors
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    
    const start = Date.now();
    await p.goto(`http://localhost:3847/${page}`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;
    
    // Measure DOM content loaded and resources
    const metrics = await p.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      let totalSize = 0;
      let scriptCount = 0;
      let scriptSize = 0;
      entries.forEach(e => {
        totalSize += e.transferSize || 0;
        if (e.initiatorType === 'script') {
          scriptCount++;
          scriptSize += e.transferSize || 0;
        }
      });
      return {
        domNodes: document.querySelectorAll('*').length,
        resources: entries.length,
        totalSizeKB: Math.round(totalSize / 1024),
        scriptCount,
        scriptSizeKB: Math.round(scriptSize / 1024),
        dcl: Math.round(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart),
        load: Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart)
      };
    });
    
    // FPS test - measure for 2 seconds
    const fps = await p.evaluate(() => {
      return new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        function count() {
          frames++;
          if (performance.now() - start < 2000) {
            requestAnimationFrame(count);
          } else {
            resolve(Math.round(frames / ((performance.now() - start) / 1000)));
          }
        }
        requestAnimationFrame(count);
      });
    });
    
    const status = errors.length === 0 ? '✅' : '❌';
    console.log(`${status} ${page}`);
    console.log(`   Load: ${loadTime}ms | DCL: ${metrics.dcl}ms | Full: ${metrics.load}ms`);
    console.log(`   Scripts: ${metrics.scriptCount} (${metrics.scriptSizeKB}KB) | Total: ${metrics.totalSizeKB}KB`);
    console.log(`   DOM: ${metrics.domNodes} nodes | FPS: ${fps}`);
    if (errors.length) console.log(`   ERRORS: ${errors.join('; ')}`);
    console.log('');
    
    await context.close();
  }
  
  // Mobile test
  console.log('--- MOBILE (iPhone 12) ---\n');
  const mCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  
  for (const page of ['index.html', 'services.html']) {
    const p = await mCtx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    
    const start = Date.now();
    await p.goto(`http://localhost:3847/${page}`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;
    
    const metrics = await p.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      let totalSize = 0;
      let scriptSize = 0;
      entries.forEach(e => {
        totalSize += e.transferSize || 0;
        if (e.initiatorType === 'script') scriptSize += e.transferSize || 0;
      });
      return {
        totalSizeKB: Math.round(totalSize / 1024),
        scriptSizeKB: Math.round(scriptSize / 1024),
        dcl: Math.round(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart)
      };
    });
    
    const fps = await p.evaluate(() => {
      return new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        function count() {
          frames++;
          if (performance.now() - start < 2000) requestAnimationFrame(count);
          else resolve(Math.round(frames / ((performance.now() - start) / 1000)));
        }
        requestAnimationFrame(count);
      });
    });
    
    const status = errors.length === 0 ? '✅' : '❌';
    console.log(`${status} ${page} (mobile)`);
    console.log(`   Load: ${loadTime}ms | DCL: ${metrics.dcl}ms`);
    console.log(`   Scripts: ${metrics.scriptSizeKB}KB | Total: ${metrics.totalSizeKB}KB | FPS: ${fps}`);
    if (errors.length) console.log(`   ERRORS: ${errors.join('; ')}`);
    console.log('');
    
    await p.close();
  }
  
  await mCtx.close();
  await browser.close();
  console.log('=== BENCHMARK COMPLETE ===');
})();
