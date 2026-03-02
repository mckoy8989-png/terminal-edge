/**
 * Terminal Edge — Effects Engine v6 (MOBILE-FIRST)
 * Three.js 3D hero | Lenis smooth scroll | GSAP dramatic reveals
 * Touch-optimized, performance-tuned for all devices
 */
(function() {
  'use strict';

  var isMobile = window.innerWidth < 768;
  var isTouch = window.matchMedia('(pointer:coarse)').matches;
  var isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return;

  /* ================================================================
     1. LENIS SMOOTH SCROLL
     Premium momentum-based scrolling (desktop only — native on mobile)
     ================================================================ */
  function initSmoothScroll() {
    if (typeof Lenis === 'undefined' || isTouch) return;
    var lenis = new Lenis({
      duration: 1.4,
      easing: function(t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.5
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    lenis.on('scroll', function() { ScrollTrigger.update(); });
  }

  /* ================================================================
     2. THREE.JS 3D HERO PARTICLE FIELD
     Mobile-first: fewer particles + touch interaction on phones
     Desktop: full particle count + mouse tracking
     ================================================================ */
  function initHero3D() {
    var hero = document.getElementById('hero');
    if (!hero || typeof THREE === 'undefined') return;

    var w = window.innerWidth, h = window.innerHeight;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.domElement.id = 'te-hero-canvas';
    hero.style.position = 'relative';
    hero.insertBefore(renderer.domElement, hero.firstChild);

    var COUNT = isMobile ? 600 : 1500;
    var geometry = new THREE.BufferGeometry();
    var positions = new Float32Array(COUNT * 3);
    var colors = new Float32Array(COUNT * 3);
    var velocities = [];

    var palette = [
      new THREE.Color(0x3b82f6),
      new THREE.Color(0x8b5cf6),
      new THREE.Color(0x06b6d4),
      new THREE.Color(0xec4899)
    ];

    for (var i = 0; i < COUNT; i++) {
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var radius = 3 + Math.random() * 8;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      var c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      var speed = isMobile ? 0.005 : 0.008;
      velocities.push({
        x: (Math.random() - 0.5) * speed,
        y: (Math.random() - 0.5) * speed,
        z: (Math.random() - 0.5) * speed
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    var material = new THREE.PointsMaterial({
      size: isMobile ? 0.09 : 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var particles = new THREE.Points(geometry, material);
    scene.add(particles);

    camera.position.z = isMobile ? 12 : 10;

    var inputX = 0, inputY = 0, scrollFactor = 0;

    // Desktop: mouse tracking
    document.addEventListener('mousemove', function(e) {
      inputX = (e.clientX / w - 0.5) * 2;
      inputY = (e.clientY / h - 0.5) * 2;
    });

    // Mobile: touch tracking on hero
    hero.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      inputX = (t.clientX / w - 0.5) * 2;
      inputY = (t.clientY / h - 0.5) * 2;
    }, { passive: true });

    // Mobile: gyroscope for ambient motion
    if (isTouch && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function(e) {
        if (e.gamma !== null) inputX = (e.gamma / 45);
        if (e.beta !== null) inputY = ((e.beta - 45) / 45);
      }, { passive: true });
    }

    window.addEventListener('scroll', function() {
      scrollFactor = Math.min(window.scrollY / (h * 0.8), 1);
    }, { passive: true });

    var active = true;
    var obs = new IntersectionObserver(function(entries) {
      active = entries[0].isIntersecting;
    }, { threshold: 0 });
    obs.observe(hero);

    var frameSkip = isMobile ? 1 : 0, frameCount = 0;
    function animate() {
      requestAnimationFrame(animate);
      if (!active) return;
      frameCount++;
      if (frameSkip && frameCount % 2 !== 0) return;

      var pos = geometry.attributes.position.array;
      for (var i = 0; i < COUNT; i++) {
        pos[i * 3] += velocities[i].x;
        pos[i * 3 + 1] += velocities[i].y;
        pos[i * 3 + 2] += velocities[i].z;
        if (Math.abs(pos[i * 3]) > 12) velocities[i].x *= -1;
        if (Math.abs(pos[i * 3 + 1]) > 12) velocities[i].y *= -1;
        if (Math.abs(pos[i * 3 + 2]) > 12) velocities[i].z *= -1;
      }
      geometry.attributes.position.needsUpdate = true;

      camera.position.x += (inputX * 3 - camera.position.x) * 0.04;
      camera.position.y += (-inputY * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      particles.rotation.y += 0.003;
      particles.rotation.x = scrollFactor * 0.8;
      material.opacity = 0.9 - scrollFactor * 0.7;
      particles.scale.setScalar(1 + scrollFactor * 0.5);

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function() {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  }

  /* ================================================================
     3. BOOT SEQUENCE (index page, first visit)
     ================================================================ */
  function initBootSequence() {
    if (!document.getElementById('hero')) return;
    if (sessionStorage.getItem('te-booted')) return;
    sessionStorage.setItem('te-booted', '1');

    document.body.style.overflow = 'hidden';
    var overlay = document.createElement('div');
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
          } else { barEl.style.width = bw + 'px'; }
        }, 12);
      } else if (line.text) {
        el.textContent = '';
        content.appendChild(el);
        content.scrollTop = content.scrollHeight;
        var ci = 0, text = line.text;
        var typeTimer = setInterval(function() {
          ci++;
          el.textContent = text.substring(0, ci);
          if (ci >= text.length) { clearInterval(typeTimer); li++; setTimeout(addLine, line.delay); }
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

  /* ================================================================
     4. DRAMATIC TEXT REVEALS
     Split section headings into characters, cascade them in
     with 3D rotation and stagger using GSAP
     ================================================================ */
  function initTextReveals() {
    if (typeof gsap === 'undefined') return;

    var headings = document.querySelectorAll('.stitle, .page-hero h1');
    headings.forEach(function(h) {
      var spans = h.querySelectorAll('.gt, .gt2, .gt3, .gt4');
      if (!spans.length) {
        // If no gradient spans, treat the whole heading
        spans = [h];
      }
      spans.forEach(function(span) {
        var text = span.textContent;
        if (!text.trim() || span.querySelector('.te-char')) return;

        span.setAttribute('aria-label', text);
        var html = '';
        for (var i = 0; i < text.length; i++) {
          if (text[i] === ' ') {
            html += '<span class="te-char" style="width:.3em">&nbsp;</span>';
          } else {
            html += '<span class="te-char">' + text[i] + '</span>';
          }
        }
        span.innerHTML = html;

        gsap.from(span.querySelectorAll('.te-char'), {
          y: isMobile ? 40 : 100,
          opacity: 0,
          rotateX: isMobile ? -30 : -90,
          scale: isMobile ? 0.5 : 0,
          stagger: isMobile ? 0.025 : 0.04,
          duration: isMobile ? 0.8 : 1.2,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: h,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        });
      });
    });

    // Labels animate with a slide + fade
    document.querySelectorAll('.lbl').forEach(function(lbl) {
      if (lbl.classList.contains('gs-hide') || lbl.classList.contains('gs-left')) return;
      gsap.from(lbl, {
        x: -60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: lbl,
          start: 'top 90%',
          toggleActions: 'play none none none'
        }
      });
    });
  }

  /* ================================================================
     5. DRAMATIC CARD REVEALS
     Cards fly in from 3D space with rotation + scale
     Only targets cards NOT already handled by GSAP batch
     ================================================================ */
  function initCardReveals() {
    if (typeof gsap === 'undefined') return;

    var cards = document.querySelectorAll(
      '.svc-card, .feat-card, .show-card, .price-card, .test-card, ' +
      '.cs-card, .tier-card, .ql-card, .faq-it, .bot-type, .info-card, ' +
      '.cap-card, .proc3d'
    );

    cards.forEach(function(card, i) {
      // Skip if already handled by GSAP batch
      if (card.classList.contains('gs-hide') ||
          card.classList.contains('gs-left') ||
          card.classList.contains('gs-right') ||
          card.classList.contains('gs-scale')) return;

      var dir = (i % 3 === 0) ? -1 : (i % 3 === 1) ? 1 : 0;

      gsap.from(card, {
        rotateY: isMobile ? dir * 10 : dir * 25,
        rotateX: isMobile ? 5 : 15,
        x: isMobile ? dir * 40 : dir * 120,
        y: isMobile ? 30 : 80,
        opacity: 0,
        scale: isMobile ? 0.85 : 0.6,
        duration: isMobile ? 0.8 : 1.3,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 92%',
          toggleActions: 'play none none none'
        }
      });
    });
  }

  /* ================================================================
     6. HIGH-VISIBILITY INTERACTIVE MESH
     Much brighter, more visible particle canvas
     ================================================================ */
  function initMesh() {
    var canvas = document.createElement('canvas');
    canvas.id = 'te-mesh';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var w, h, dots = [];
    var spacing = isMobile ? 100 : 60;
    var mx = -9e3, my = -9e3;
    var scrollProg = 0, pageH = 1;
    var time = 0;

    var BLUE = [59, 130, 246], PURPLE = [139, 92, 246], CYAN = [6, 182, 212];

    function lerp3(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    function scrollColor(t) {
      return t < 0.5 ? lerp3(BLUE, PURPLE, t * 2) : lerp3(PURPLE, CYAN, (t - 0.5) * 2);
    }

    function rebuild() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      pageH = Math.max(document.documentElement.scrollHeight - h, 1);
      var c = Math.ceil(w / spacing) + 1;
      var r = Math.ceil(h / spacing) + 1;
      dots = [];
      for (var ry = 0; ry < r; ry++)
        for (var cx = 0; cx < c; cx++)
          dots.push({ x: cx * spacing, y: ry * spacing, ox: cx * spacing, oy: ry * spacing, vx: 0, vy: 0, a: 0 });
    }

    rebuild();
    window.addEventListener('resize', rebuild, { passive: true });
    document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      mx = t.clientX; my = t.clientY;
    }, { passive: true });
    document.addEventListener('touchend', function() { mx = -9e3; my = -9e3; }, { passive: true });
    window.addEventListener('scroll', function() { scrollProg = window.scrollY / pageH; }, { passive: true });

    var secBounds = [];
    var lastBounds = 0;

    function frame() {
      ctx.clearRect(0, 0, w, h);
      time += 0.016;
      var sp = Math.min(Math.max(scrollProg, 0), 1);
      var color = scrollColor(sp);
      var cr = ~~color[0], cg = ~~color[1], cb = ~~color[2];
      var mouseR = isMobile ? 180 : 250;
      var connectR = isMobile ? 160 : 120;

      if (Date.now() - lastBounds > 300) {
        var secs = document.querySelectorAll('.sec.pad, .svc-section');
        secBounds = [];
        for (var s = 0; s < secs.length; s++) {
          var r = secs[s].getBoundingClientRect();
          secBounds.push(r.bottom);
        }
        lastBounds = Date.now();
      }

      // Breathing wave
      var waveY = h * (0.3 + 0.4 * Math.sin(time * 0.25));
      var waveR = 300;

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var dx = mx - d.x, dy = my - d.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // STRONG mouse attraction
        if (dist < mouseR && dist > 0) {
          var f = 1 - dist / mouseR;
          f = f * f; // quadratic falloff for more concentrated effect
          d.a = Math.min(1, d.a + f * 0.2);
          d.vx += dx * f * 0.004;
          d.vy += dy * f * 0.004;
        }

        // Wave
        var wd = Math.abs(d.oy - waveY);
        if (wd < waveR) d.a = Math.max(d.a, (1 - wd / waveR) * 0.1);

        // Section boundaries
        for (var s = 0; s < secBounds.length; s++) {
          var bd = Math.abs(d.oy - secBounds[s]);
          if (bd < 70) d.a = Math.max(d.a, (1 - bd / 70) * 0.25);
        }

        // Physics
        d.vx += (d.ox - d.x) * 0.035;
        d.vy += (d.oy - d.y) * 0.035;
        d.vx *= 0.85; d.vy *= 0.85;
        d.x += d.vx; d.y += d.vy;
        d.a *= 0.93;

        // Draw BRIGHTER dots
        if (d.a > 0.01) {
          var alpha = d.a * 0.7;
          var sz = 1.5 + d.a * 5;
          ctx.beginPath();
          ctx.arc(d.x, d.y, sz, 0, 6.283);
          ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + alpha + ')';
          ctx.fill();

          // Glow halo on bright dots
          if (d.a > 0.3) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, sz * 3, 0, 6.283);
            ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (d.a * 0.08) + ')';
            ctx.fill();
          }
        }
      }

      // Connections — brighter, thicker
      ctx.lineWidth = 1;
      for (var i = 0; i < dots.length; i++) {
        if (dots[i].a < 0.05) continue;
        for (var j = i + 1; j < dots.length; j++) {
          if (dots[j].a < 0.05) continue;
          var ddx = dots[i].x - dots[j].x, ddy = dots[i].y - dots[j].y;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 < connectR * connectR) {
            var la = (1 - Math.sqrt(d2) / connectR) * Math.min(dots[i].a, dots[j].a) * 0.5;
            if (la < 0.005) continue;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + la + ')';
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ================================================================
     7. CUSTOM CURSOR
     ================================================================ */
  function initCursor() {
    // Desktop: custom cursor ring + dot
    if (!isTouch) {
      var ring = document.createElement('div');
      ring.id = 'te-ring';
      var dot = document.createElement('div');
      dot.id = 'te-dot';
      document.body.appendChild(ring);
      document.body.appendChild(dot);

      var cmx = 0, cmy = 0, rx = 0, ry = 0;
      document.addEventListener('mousemove', function(e) {
        cmx = e.clientX; cmy = e.clientY;
        dot.style.transform = 'translate3d(' + (cmx - 3) + 'px,' + (cmy - 3) + 'px,0)';
      });

    function tick() {
      rx += (cmx - rx) * 0.12;
      ry += (cmy - ry) * 0.12;
      ring.style.transform = 'translate3d(' + (rx - 22) + 'px,' + (ry - 22) + 'px,0)';
      requestAnimationFrame(tick);
    }
    tick();

    var hoverSel = 'a,button,.btn,.svc-card,.feat-card,.show-card,.price-card,.tier-card,.faq-it,.cs-card,.test-card,.ql-card,.bot-type,.info-card,.cap-card,.proc3d';
    document.addEventListener('mouseover', function(e) {
      if (e.target.closest(hoverSel)) ring.classList.add('lg');
    });
    document.addEventListener('mouseout', function(e) {
      if (e.target.closest(hoverSel)) ring.classList.remove('lg');
    });

    document.addEventListener('click', function(e) {
      var rip = document.createElement('div');
      rip.className = 'te-ripple';
      rip.style.left = e.clientX + 'px';
      rip.style.top = e.clientY + 'px';
      document.body.appendChild(rip);
      rip.addEventListener('animationend', function() { rip.remove(); });
    });

    } else {
      // Mobile: touch ripple effects
      document.addEventListener('touchstart', function(e) {
        var t = e.touches[0];
        var rip = document.createElement('div');
        rip.className = 'te-touch-ripple';
        rip.style.left = t.clientX + 'px';
        rip.style.top = t.clientY + 'px';
        document.body.appendChild(rip);
        rip.addEventListener('animationend', function() { rip.remove(); });
      }, { passive: true });
    }
  }

  /* ================================================================
     8. SCROLL PROGRESS (sidebar desktop, top bar mobile)
     ================================================================ */
  function initScrollProgress() {
    var sections = document.querySelectorAll('.sec');
    if (sections.length < 3) return;

    var bar = document.createElement('div');
    bar.className = isMobile ? 'te-progress-mobile' : 'te-progress';
    var segs = [];
    sections.forEach(function(sec, i) {
      var seg = document.createElement('div');
      seg.className = 'te-progress-seg';
      seg.title = sec.id || 'Section ' + (i + 1);
      seg.style.cursor = 'pointer';
      seg.addEventListener('click', function() {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      bar.appendChild(seg);
      segs.push(seg);
    });
    document.body.appendChild(bar);

    var shown = false;
    window.addEventListener('scroll', function() {
      if (!shown && window.scrollY > 300) { bar.classList.add('visible'); shown = true; }
      else if (shown && window.scrollY < 100) { bar.classList.remove('visible'); shown = false; }
    }, { passive: true });

    sections.forEach(function(sec, i) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            segs.forEach(function(s, j) {
              s.classList.toggle('active', j === i);
              s.classList.toggle('done', j < i);
            });
          }
        });
      }, { threshold: 0.3 });
      obs.observe(sec);
    });
  }

  /* ================================================================
     9. SECTION GLOW BEAMS
     Thick, bright gradient beams that draw across section tops
     ================================================================ */
  function initSectionGlow() {
    var secs = document.querySelectorAll('.sec.pad, .svc-section');
    secs.forEach(function(sec) {
      if (sec.id === 'hero') return;
      if (!sec.style.position) sec.style.position = 'relative';
      var glow = document.createElement('div');
      glow.className = 'te-glow';
      sec.insertBefore(glow, sec.firstChild);
      var obs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) { glow.classList.add('active'); obs.disconnect(); }
      }, { threshold: 0.12 });
      obs.observe(sec);
    });
  }

  /* ================================================================
     10. SECTION CONNECTORS
     Data-flow bridges between sections
     ================================================================ */
  function initConnectors() {
    var secs = document.querySelectorAll('.sec.pad, .svc-section');
    if (secs.length < 2) return;
    for (var i = 1; i < secs.length; i++) {
      var conn = document.createElement('div');
      conn.className = 'te-conn';
      conn.innerHTML =
        '<div class="te-conn-line"></div>' +
        '<div class="te-conn-node"></div>' +
        '<div class="te-conn-pulse"></div>';
      secs[i].parentNode.insertBefore(conn, secs[i]);
      (function(el) {
        var obs = new IntersectionObserver(function(entries) {
          if (entries[0].isIntersecting) { el.classList.add('active'); obs.disconnect(); }
        }, { threshold: 0, rootMargin: '0px 0px 80px 0px' });
        obs.observe(el);
      })(conn);
    }
  }

  /* ================================================================
     11. PARALLAX DEPTH LAYERS
     Background elements move at different rates on scroll
     ================================================================ */
  function initParallax() {
    if (typeof gsap === 'undefined') return;
    var strength = isMobile ? 0.4 : 1;

    // Hero gradients (already exist, add stronger parallax)
    var hg1 = document.querySelector('.hg1');
    var hg2 = document.querySelector('.hg2');
    if (hg1) {
      gsap.to(hg1, {
        y: -150 * strength, scale: 1 + 0.3 * strength, opacity: 0.3,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
      });
    }
    if (hg2) {
      gsap.to(hg2, {
        y: 150 * strength, scale: 1 - 0.3 * strength, opacity: 0.2,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
      });
    }

    // Section background depth — subtle parallax on section content
    document.querySelectorAll('.sec.pad .stitle, .svc-section h2').forEach(function(el) {
      gsap.to(el, {
        y: -40 * strength,
        scrollTrigger: { trigger: el.closest('.sec, .svc-section'), start: 'top bottom', end: 'bottom top', scrub: 2 }
      });
    });
  }

  /* ================================================================
     12. SCROLL-DRIVEN BACKGROUND COLOR SHIFT
     Page background subtly shifts color as you scroll through
     ================================================================ */
  function initScrollColor() {
    var overlay = document.createElement('div');
    overlay.id = 'te-scroll-glow';
    document.body.appendChild(overlay);

    window.addEventListener('scroll', function() {
      var p = window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      var hue;
      if (p < 0.33) hue = 220 + (260 - 220) * (p / 0.33);
      else if (p < 0.66) hue = 260 + (190 - 260) * ((p - 0.33) / 0.33);
      else hue = 190 + (320 - 190) * ((p - 0.66) / 0.34);
      overlay.style.background = 'radial-gradient(ellipse at 50% 50%, hsla(' + hue + ',80%,50%,0.06) 0%, transparent 60%)';
    }, { passive: true });
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    initSmoothScroll();
    initBootSequence();
    initHero3D();
    initMesh();
    initCursor();
    initScrollProgress();
    initTextReveals();
    initCardReveals();
    initSectionGlow();
    initConnectors();
    initParallax();
    initScrollColor();

    // Safety fallback: reveal any chars that haven't animated after 5s
    setTimeout(function() {
      document.querySelectorAll('.te-char').forEach(function(c) {
        if (parseFloat(getComputedStyle(c).opacity) < 0.1) {
          c.style.opacity = '1';
          c.style.transform = 'none';
        }
      });
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
