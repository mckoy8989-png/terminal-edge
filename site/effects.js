/**
 * Terminal Edge — Advanced Interactive Effects Engine
 * Sophisticated scroll-driven creation, construction & interaction effects
 */
(function() {
  'use strict';

  const isMobile = window.innerWidth < 768;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return;

  /* ════════════════════════════════════════════════════════════
     1. BOOT SEQUENCE — Terminal-style page intro (index only)
     Full-screen overlay simulates system boot then reveals page
     ════════════════════════════════════════════════════════════ */
  function initBootSequence() {
    if (!document.getElementById('hero')) return;
    if (sessionStorage.getItem('te-booted')) return;
    sessionStorage.setItem('te-booted', '1');

    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'te-boot';
    overlay.innerHTML =
      '<div class="boot-terminal">' +
        '<div class="boot-header">' +
          '<span class="boot-dots"><span></span><span></span><span></span></span>' +
          '<span class="boot-title">terminal-edge-os v2.4.0</span>' +
        '</div>' +
        '<div class="boot-content" id="bootContent"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var content = document.getElementById('bootContent');

    var lines = [
      { text: '\u2588 TERMINAL EDGE SYSTEMS', cls: 'boot-cyan', delay: 200 },
      { text: '', cls: '', delay: 100 },
      { text: '> Initializing kernel...', cls: 'boot-dim', delay: 300 },
      { text: '  \u2713 Core runtime loaded', cls: 'boot-green', delay: 180 },
      { text: '  \u2713 GPU acceleration enabled', cls: 'boot-green', delay: 120 },
      { text: '', cls: '', delay: 80 },
      { text: '> Loading modules:', cls: 'boot-dim', delay: 200 },
      { text: '', cls: '', delay: 50, bar: { label: '  ui-engine', width: 100 } },
      { text: '', cls: '', delay: 50, bar: { label: '  scroll-physics', width: 100 } },
      { text: '', cls: '', delay: 50, bar: { label: '  particle-system', width: 100 } },
      { text: '', cls: '', delay: 50, bar: { label: '  animation-core', width: 100 } },
      { text: '  \u2713 All modules loaded (4/4)', cls: 'boot-green', delay: 200 },
      { text: '', cls: '', delay: 80 },
      { text: '> Compiling interface...', cls: 'boot-dim', delay: 250 },
      { text: '  \u2713 47 components rendered', cls: 'boot-green', delay: 140 },
      { text: '  \u2713 12 scroll triggers armed', cls: 'boot-green', delay: 120 },
      { text: '  \u2713 Interaction handlers bound', cls: 'boot-green', delay: 120 },
      { text: '', cls: '', delay: 80 },
      { text: '> Running diagnostics:', cls: 'boot-dim', delay: 200 },
      { text: '  Performance   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  98/100', cls: 'boot-green', delay: 150 },
      { text: '  Accessibility \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100/100', cls: 'boot-green', delay: 150 },
      { text: '  Security      \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  97/100', cls: 'boot-green', delay: 150 },
      { text: '', cls: '', delay: 100 },
      { text: '> System ready. Launching interface...', cls: 'boot-cyan boot-blink', delay: 600 }
    ];

    var li = 0;
    function addLine() {
      if (li >= lines.length) {
        setTimeout(function() {
          overlay.classList.add('boot-dismiss');
          document.body.style.overflow = '';
          setTimeout(function() { overlay.remove(); }, 1000);
        }, 300);
        return;
      }

      var line = lines[li];
      var el = document.createElement('div');
      el.className = 'boot-line ' + (line.cls || '');

      if (line.bar) {
        // Animated progress bar
        el.textContent = line.bar.label + '  ';
        content.appendChild(el);
        content.scrollTop = content.scrollHeight;
        var barEl = document.createElement('span');
        barEl.className = 'boot-bar';
        barEl.style.width = '0px';
        barEl.style.maxWidth = '120px';
        el.appendChild(barEl);
        var done = document.createElement('span');
        done.style.color = '#10b981';
        done.style.marginLeft = '8px';
        el.appendChild(done);

        var bw = 0;
        var barTimer = setInterval(function() {
          bw += 8;
          if (bw > line.bar.width) {
            clearInterval(barTimer);
            barEl.style.width = line.bar.width + 'px';
            done.textContent = '\u2713';
            li++;
            setTimeout(addLine, line.delay);
          } else {
            barEl.style.width = bw + 'px';
          }
        }, 12);
      } else if (line.text) {
        // Typing effect
        el.textContent = '';
        content.appendChild(el);
        content.scrollTop = content.scrollHeight;
        var ci = 0;
        var text = line.text;
        var typeTimer = setInterval(function() {
          ci++;
          el.textContent = text.substring(0, ci);
          if (ci >= text.length) {
            clearInterval(typeTimer);
            li++;
            setTimeout(addLine, line.delay);
          }
        }, 8);
      } else {
        el.innerHTML = '\u00A0';
        content.appendChild(el);
        content.scrollTop = content.scrollHeight;
        li++;
        setTimeout(addLine, line.delay);
      }
    }

    setTimeout(addLine, 400);
  }

  /* ════════════════════════════════════════════════════════════
     2. SECTION CONSTRUCTION REVEALS
     Each section gets a wireframe grid overlay + scan line
     that sweeps through to "build" the section as you scroll
     ════════════════════════════════════════════════════════════ */
  function initSectionConstruction() {
    var sections = document.querySelectorAll('.sec.pad, .svc-section');
    if (!sections.length) return;

    var labels = ['RENDERING', 'COMPILING', 'BUILDING', 'DEPLOYING', 'LOADING', 'ASSEMBLING'];

    sections.forEach(function(sec, idx) {
      sec.style.position = 'relative';

      // Create construction overlay
      var construct = document.createElement('div');
      construct.className = 'te-construct';

      // Grid pattern
      var grid = document.createElement('div');
      grid.className = 'te-construct-grid';

      // Scan line
      var scan = document.createElement('div');
      scan.className = 'te-construct-scan';

      // Label
      var label = document.createElement('div');
      label.className = 'te-construct-label';
      label.textContent = labels[idx % labels.length];

      // Corner brackets
      var corners = ['tl', 'tr', 'bl', 'br'];
      corners.forEach(function(pos) {
        var corner = document.createElement('div');
        corner.className = 'te-construct-corner ' + pos;
        construct.appendChild(corner);
      });

      construct.appendChild(grid);
      construct.appendChild(scan);
      construct.appendChild(label);
      sec.appendChild(construct);

      // Observe section entering viewport
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            observer.disconnect();

            // Phase 1: Show grid + corners + label
            grid.classList.add('active');
            label.classList.add('active');
            construct.querySelectorAll('.te-construct-corner').forEach(function(c) {
              c.classList.add('active');
            });

            // Phase 2: After brief pause, run scan line
            setTimeout(function() {
              scan.style.opacity = '1';
              scan.style.transition = 'top 1.2s cubic-bezier(.16,1,.3,1)';
              scan.style.top = '0';
              requestAnimationFrame(function() {
                scan.style.top = '100%';
              });

              // Phase 3: After scan completes, remove overlay
              setTimeout(function() {
                label.textContent = 'COMPLETE \u2713';
                label.style.color = '#10b981';
                setTimeout(function() {
                  construct.classList.add('te-built');
                  setTimeout(function() { construct.remove(); }, 800);
                }, 400);
              }, 1200);
            }, 300);
          }
        });
      }, { threshold: 0.15 });

      observer.observe(sec);
    });
  }

  /* ════════════════════════════════════════════════════════════
     3. CHARACTER-LEVEL TEXT REVEAL
     Headings split into individual characters that fly in
     with 3D rotation, stagger, and scale effects
     ════════════════════════════════════════════════════════════ */
  function initCharReveal() {
    var headings = document.querySelectorAll('.stitle, .page-hero h1');
    if (!headings.length) return;

    headings.forEach(function(heading) {
      // Find gradient spans within heading
      var gradSpans = heading.querySelectorAll('.gt, .gt2, .gt3, .gt4');
      gradSpans.forEach(function(span) {
        var text = span.textContent;
        if (!text.trim()) return;

        // Store original for accessibility
        span.setAttribute('aria-label', text);
        span.innerHTML = '';

        // Split into individual character spans
        var chars = [];
        for (var i = 0; i < text.length; i++) {
          var charSpan = document.createElement('span');
          if (text[i] === ' ') {
            charSpan.className = 'te-char te-char-space';
            charSpan.innerHTML = '\u00A0';
          } else {
            charSpan.className = 'te-char';
            charSpan.textContent = text[i];
            // Randomize initial transform for variety
            var rx = (Math.random() - 0.5) * 40;
            var ry = 30 + Math.random() * 30;
            var rot = (Math.random() - 0.5) * 60;
            charSpan.style.transform = 'translateX(' + rx + 'px) translateY(' + ry + 'px) rotateX(90deg) rotateZ(' + rot + 'deg) scale(.3)';
          }
          // Stagger transition delay
          charSpan.style.transitionDelay = (i * 0.03) + 's';
          span.appendChild(charSpan);
          chars.push(charSpan);
        }

        // Observe and trigger
        var obs = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              obs.disconnect();
              // Small delay then reveal characters
              setTimeout(function() {
                chars.forEach(function(c) {
                  c.classList.add('te-char-visible');
                });
              }, 100);
            }
          });
        }, { threshold: 0.3 });
        obs.observe(span);
      });
    });
  }

  /* ════════════════════════════════════════════════════════════
     4. CLIP-PATH SECTION REVEALS
     Sections reveal through different clip-path animations:
     inset, circle, polygon wipe — each section gets a variation
     ════════════════════════════════════════════════════════════ */
  function initClipReveals() {
    var sections = document.querySelectorAll('.sec.pad, .svc-section');
    var clipTypes = ['te-clip-reveal', 'te-clip-circle', 'te-clip-wipe'];

    sections.forEach(function(sec, i) {
      var type = clipTypes[i % clipTypes.length];
      sec.classList.add(type);

      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            obs.disconnect();
            // Small delay for dramatic effect
            setTimeout(function() {
              sec.classList.add('te-revealed');
            }, 150);
          }
        });
      }, { threshold: 0.08 });
      obs.observe(sec);
    });
  }

  /* ════════════════════════════════════════════════════════════
     5. CODE RAIN BACKGROUND
     Matrix-style falling code characters behind select sections
     ════════════════════════════════════════════════════════════ */
  function initCodeRain() {
    if (isMobile) return;

    // Only on index page behind specific sections
    var targets = document.querySelectorAll('#services, #features, #tech');
    if (!targets.length) {
      // Sub-pages: pick first 2 sections
      targets = document.querySelectorAll('.sec.pad');
      if (targets.length > 2) {
        targets = [targets[0], targets[1]];
      }
    }

    targets.forEach(function(sec) {
      sec.style.position = 'relative';
      var canvas = document.createElement('canvas');
      canvas.className = 'te-code-rain';
      sec.insertBefore(canvas, sec.firstChild);

      var ctx = canvas.getContext('2d');
      var chars = '<>{}[]()=;:./\\|!@#$%^&*+-~`const function return async await class export import'.split('');
      var columns, drops;

      function resize() {
        canvas.width = sec.offsetWidth;
        canvas.height = sec.offsetHeight;
        columns = Math.floor(canvas.width / 18);
        drops = new Array(columns).fill(0).map(function() {
          return Math.random() * -100;
        });
      }
      resize();
      window.addEventListener('resize', resize, { passive: true });

      var active = false;
      var obs = new IntersectionObserver(function(entries) {
        active = entries[0].isIntersecting;
      }, { threshold: 0 });
      obs.observe(sec);

      function draw() {
        if (!active) { requestAnimationFrame(draw); return; }

        ctx.fillStyle = 'rgba(6,7,20,.06)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = '11px JetBrains Mono, monospace';

        for (var i = 0; i < columns; i++) {
          var ch = chars[Math.floor(Math.random() * chars.length)];
          var x = i * 18;
          var y = drops[i] * 14;

          // Vary brightness
          var brightness = Math.random();
          if (brightness > 0.95) {
            ctx.fillStyle = 'rgba(59,130,246,.4)';
          } else if (brightness > 0.9) {
            ctx.fillStyle = 'rgba(139,92,246,.3)';
          } else {
            ctx.fillStyle = 'rgba(59,130,246,.12)';
          }

          ctx.fillText(ch, x, y);
          drops[i] += 0.4 + Math.random() * 0.3;

          if (y > canvas.height + 100) {
            drops[i] = Math.random() * -50;
          }
        }

        requestAnimationFrame(draw);
      }
      draw();
    });
  }

  /* ════════════════════════════════════════════════════════════
     6. SCROLL PROGRESS BAR (Enhanced)
     Segmented progress bar on the right side that shows
     which section is active and which are "complete"
     ════════════════════════════════════════════════════════════ */
  function initScrollProgress() {
    var sections = document.querySelectorAll('.sec');
    if (sections.length < 3) return;

    var progress = document.createElement('div');
    progress.className = 'te-progress';

    var segs = [];
    sections.forEach(function(sec, i) {
      var seg = document.createElement('div');
      seg.className = 'te-progress-seg';
      seg.title = sec.id || 'Section ' + (i + 1);
      progress.appendChild(seg);
      segs.push(seg);

      // Click to scroll to section
      seg.addEventListener('click', function() {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      seg.style.cursor = 'pointer';
    });

    document.body.appendChild(progress);

    // Show after scrolling past first section
    var shown = false;
    window.addEventListener('scroll', function() {
      if (!shown && window.scrollY > 300) {
        progress.classList.add('visible');
        shown = true;
      } else if (shown && window.scrollY < 100) {
        progress.classList.remove('visible');
        shown = false;
      }
    }, { passive: true });

    // Track active section
    sections.forEach(function(sec, i) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            segs.forEach(function(s, j) {
              s.classList.remove('active');
              if (j < i) s.classList.add('done');
              else s.classList.remove('done');
            });
            segs[i].classList.add('active');
          }
        });
      }, { threshold: 0.3 });
      obs.observe(sec);
    });
  }

  /* ════════════════════════════════════════════════════════════
     7. FLOATING CODE SNIPPETS
     Subtle code fragments float in the background of sections
     ════════════════════════════════════════════════════════════ */
  function initFloatingCode() {
    if (isMobile) return;

    var snippets = [
      'const build = async () => {\n  await compile()\n  return deploy()\n}',
      'function optimize(data) {\n  return data\n    .filter(Boolean)\n    .map(transform)\n}',
      'export class Engine {\n  constructor() {\n    this.init()\n  }\n}',
      'interface Config {\n  mode: "prod" | "dev"\n  port: number\n}',
      'const api = await fetch(\n  "/api/v2/deploy",\n  { method: "POST" }\n)',
      'async function* stream() {\n  yield* pipeline\n  return result\n}'
    ];

    var targets = document.querySelectorAll('.sec.pad, .svc-section');
    targets.forEach(function(sec, i) {
      if (i >= snippets.length) return;
      sec.style.position = 'relative';
      sec.style.overflow = 'hidden';

      var code = document.createElement('div');
      code.className = 'te-float-code';
      code.textContent = snippets[i];

      // Randomize position
      var positions = [
        { top: '10%', left: '3%' },
        { top: '15%', right: '2%' },
        { bottom: '20%', left: '5%' },
        { bottom: '10%', right: '3%' },
        { top: '40%', left: '2%' },
        { top: '30%', right: '4%' }
      ];
      var pos = positions[i % positions.length];
      Object.keys(pos).forEach(function(k) {
        code.style[k] = pos[k];
      });

      code.style.animationDelay = (i * 3) + 's';
      sec.appendChild(code);
    });
  }

  /* ════════════════════════════════════════════════════════════
     8. SCROLL VELOCITY EFFECTS
     Track scroll speed: fast = subtle blur, adds kinetic feel
     ════════════════════════════════════════════════════════════ */
  function initScrollVelocity() {
    if (isMobile) return;

    var lastScroll = 0;
    var velocity = 0;
    var ticking = false;

    var content = document.querySelector('.hero-ct') ||
                  document.querySelector('.page-hero') ||
                  document.body;

    window.addEventListener('scroll', function() {
      var current = window.scrollY;
      velocity = Math.abs(current - lastScroll);
      lastScroll = current;

      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function() {
          // Apply subtle blur based on velocity (capped)
          var blur = Math.min(velocity * 0.04, 2);
          if (blur > 0.3) {
            document.body.style.filter = 'blur(' + blur + 'px)';
          }
          // Quickly remove blur when slowing down
          setTimeout(function() {
            document.body.style.filter = '';
          }, 100);
          ticking = false;
        });
      }
    }, { passive: true });
  }

  /* ════════════════════════════════════════════════════════════
     9. ANIMATED GRADIENT BORDERS ON CARDS
     Cards get rotating rainbow gradient borders on hover
     ════════════════════════════════════════════════════════════ */
  function initGradientBorders() {
    var cards = document.querySelectorAll(
      '.svc-card, .feat-card, .show-card, .price-card, .test-card, ' +
      '.cs-card, .tier-card, .ql-card, .info-card, .faq-it, .bot-type'
    );
    cards.forEach(function(card) {
      card.classList.add('te-gradient-border');
    });
  }

  /* ════════════════════════════════════════════════════════════
     10. DATA STREAM LINES
     Vertical animated lines between sections suggesting data flow
     ════════════════════════════════════════════════════════════ */
  function initDataStreams() {
    if (isMobile) return;
    var sections = document.querySelectorAll('.sec.pad, .svc-section');
    sections.forEach(function(sec, i) {
      if (i % 2 !== 0) return; // Every other section
      sec.style.position = 'relative';

      for (var j = 0; j < 3; j++) {
        var stream = document.createElement('div');
        stream.className = 'te-stream';
        stream.style.left = (15 + Math.random() * 70) + '%';
        stream.style.animationDelay = (j * 1.2 + i * 0.5) + 's';
        stream.style.animationDuration = (2.5 + Math.random() * 2) + 's';
        sec.appendChild(stream);
      }
    });
  }

  /* ════════════════════════════════════════════════════════════
     11. INTERACTIVE MAGNETIC FIELD
     Elements near cursor get subtle magnetic attraction/repulsion
     ════════════════════════════════════════════════════════════ */
  function initMagneticField() {
    if (isMobile) return;

    var elements = document.querySelectorAll(
      '.svc-card, .feat-card, .price-card, .test-card, .proc3d, ' +
      '.cs-card, .tier-card, .ql-card, .faq-it, .bot-type, .cap-card'
    );

    elements.forEach(function(el) {
      el.classList.add('te-magnetic');
      el.addEventListener('mousemove', function(e) {
        var rect = el.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / rect.width;
        var dy = (e.clientY - cy) / rect.height;
        el.style.transform = 'perspective(800px) rotateY(' + (dx * 8) + 'deg) rotateX(' + (-dy * 6) + 'deg) translateZ(10px)';
      });
      el.addEventListener('mouseleave', function() {
        el.style.transform = '';
      });
    });
  }

  /* ════════════════════════════════════════════════════════════
     INITIALIZATION
     Run all effects after DOM is ready
     ════════════════════════════════════════════════════════════ */
  function init() {
    initBootSequence();
    initClipReveals();
    initCharReveal();
    initSectionConstruction();
    initCodeRain();
    initScrollProgress();
    initFloatingCode();
    initScrollVelocity();
    initGradientBorders();
    initDataStreams();
    initMagneticField();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to let GSAP initialize first
    setTimeout(init, 100);
  }

})();
