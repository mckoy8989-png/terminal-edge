/**
 * Terminal Edge — Unified Effects Engine v4
 * One cohesive system: neural mesh, section flow, custom cursor
 * Works WITH existing GSAP — enhances without interfering
 */
(function() {
  'use strict';

  var isMobile = window.innerWidth < 768;
  var isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return;

  /* ================================================================
     1. BOOT SEQUENCE — Terminal-style page intro (index only)
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
          } else {
            barEl.style.width = bw + 'px';
          }
        }, 12);
      } else if (line.text) {
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

  /* ================================================================
     2. NEURAL MESH — Full-viewport interactive particle network
     Mouse attracts nodes, scroll shifts color, section boundaries
     light up to create visual continuity between sections
     ================================================================ */
  function initNeuralMesh() {
    if (isMobile) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'te-mesh';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var w, h, dots = [];
    var spacing = 70;
    var mx = -9e3, my = -9e3;
    var scrollProg = 0, pageH = 1;
    var time = 0;

    var BLUE = [59,130,246], PURPLE = [139,92,246], CYAN = [6,182,212];

    function lerp3(a, b, t) {
      return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
    }
    function scrollColor(t) {
      return t < 0.5 ? lerp3(BLUE, PURPLE, t*2) : lerp3(PURPLE, CYAN, (t-0.5)*2);
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
          dots.push({x:cx*spacing, y:ry*spacing, ox:cx*spacing, oy:ry*spacing, vx:0, vy:0, a:0});
    }

    rebuild();
    window.addEventListener('resize', rebuild, {passive:true});
    document.addEventListener('mousemove', function(e){ mx=e.clientX; my=e.clientY; }, {passive:true});
    window.addEventListener('scroll', function(){ scrollProg = window.scrollY / pageH; }, {passive:true});

    // Section boundary tracking for inter-section glow
    var secBounds = [];
    var lastBounds = 0;
    function updateBounds() {
      var secs = document.querySelectorAll('.sec.pad, .svc-section');
      secBounds = [];
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        secBounds.push(r.bottom);
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      time += 0.016;
      var sp = Math.min(Math.max(scrollProg, 0), 1);
      var color = scrollColor(sp);
      var cr = ~~color[0], cg = ~~color[1], cb = ~~color[2];
      var mouseR = 200, connectR = 100;

      if (Date.now() - lastBounds > 300) { updateBounds(); lastBounds = Date.now(); }

      // Ambient breathing wave
      var waveY = h * (0.3 + 0.4 * Math.sin(time * 0.25));
      var waveR = 280;

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var dx = mx - d.x, dy = my - d.y;
        var dist = Math.sqrt(dx*dx + dy*dy);

        // Mouse attraction
        if (dist < mouseR && dist > 0) {
          var f = 1 - dist/mouseR;
          d.a = Math.min(1, d.a + f*0.12);
          d.vx += dx * f * 0.002;
          d.vy += dy * f * 0.002;
        }

        // Ambient wave
        var wd = Math.abs(d.oy - waveY);
        if (wd < waveR) d.a = Math.max(d.a, (1-wd/waveR)*0.06);

        // Section boundary glow
        for (var s = 0; s < secBounds.length; s++) {
          var bd = Math.abs(d.oy - secBounds[s]);
          if (bd < 50) d.a = Math.max(d.a, (1-bd/50)*0.18);
        }

        // Spring physics
        d.vx += (d.ox - d.x) * 0.04;
        d.vy += (d.oy - d.y) * 0.04;
        d.vx *= 0.87; d.vy *= 0.87;
        d.x += d.vx; d.y += d.vy;
        d.a *= 0.95;

        if (d.a > 0.01) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, 1.2 + d.a*3.5, 0, 6.283);
          ctx.fillStyle = 'rgba('+cr+','+cg+','+cb+','+(d.a*0.5)+')';
          ctx.fill();
        }
      }

      // Connections between activated nodes
      ctx.lineWidth = 0.6;
      for (var i = 0; i < dots.length; i++) {
        if (dots[i].a < 0.06) continue;
        for (var j = i+1; j < dots.length; j++) {
          if (dots[j].a < 0.06) continue;
          var ddx = dots[i].x - dots[j].x, ddy = dots[i].y - dots[j].y;
          var d2 = ddx*ddx + ddy*ddy;
          if (d2 < connectR*connectR) {
            var la = (1-Math.sqrt(d2)/connectR) * Math.min(dots[i].a, dots[j].a) * 0.35;
            if (la < 0.005) continue;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = 'rgba('+cr+','+cg+','+cb+','+la+')';
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ================================================================
     3. CUSTOM CURSOR — Smooth ring + dot with click ripple
     ================================================================ */
  function initCursor() {
    if (isMobile || window.matchMedia('(pointer:coarse)').matches) return;

    var ring = document.createElement('div');
    ring.id = 'te-ring';
    var dot = document.createElement('div');
    dot.id = 'te-dot';
    document.body.appendChild(ring);
    document.body.appendChild(dot);

    var cmx = 0, cmy = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', function(e) {
      cmx = e.clientX; cmy = e.clientY;
      dot.style.transform = 'translate3d('+(cmx-3)+'px,'+(cmy-3)+'px,0)';
    });

    function tick() {
      rx += (cmx - rx) * 0.12;
      ry += (cmy - ry) * 0.12;
      ring.style.transform = 'translate3d('+(rx-20)+'px,'+(ry-20)+'px,0)';
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

    // Click ripple burst
    document.addEventListener('click', function(e) {
      var rip = document.createElement('div');
      rip.className = 'te-ripple';
      rip.style.left = e.clientX + 'px';
      rip.style.top = e.clientY + 'px';
      document.body.appendChild(rip);
      rip.addEventListener('animationend', function() { rip.remove(); });
    });
  }

  /* ================================================================
     4. SCROLL PROGRESS — Segmented sidebar navigation
     ================================================================ */
  function initScrollProgress() {
    var sections = document.querySelectorAll('.sec');
    if (sections.length < 3) return;

    var bar = document.createElement('div');
    bar.className = 'te-progress';
    var segs = [];

    sections.forEach(function(sec, i) {
      var seg = document.createElement('div');
      seg.className = 'te-progress-seg';
      seg.title = sec.id || 'Section '+(i+1);
      seg.style.cursor = 'pointer';
      seg.addEventListener('click', function() {
        sec.scrollIntoView({behavior:'smooth',block:'start'});
      });
      bar.appendChild(seg);
      segs.push(seg);
    });
    document.body.appendChild(bar);

    var shown = false;
    window.addEventListener('scroll', function() {
      if (!shown && window.scrollY > 300) { bar.classList.add('visible'); shown = true; }
      else if (shown && window.scrollY < 100) { bar.classList.remove('visible'); shown = false; }
    }, {passive:true});

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
      }, {threshold:0.3});
      obs.observe(sec);
    });
  }

  /* ================================================================
     5. SECTION GLOW — Animated top-edge beam on scroll entry
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
        if (entries[0].isIntersecting) {
          glow.classList.add('active');
          obs.disconnect();
        }
      }, {threshold:0.12});
      obs.observe(sec);
    });
  }

  /* ================================================================
     6. SECTION CONNECTORS — Visual data-flow bridges
     Animated line + pulse node between consecutive sections
     ================================================================ */
  function initConnectors() {
    if (isMobile) return;
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
          if (entries[0].isIntersecting) {
            el.classList.add('active');
            obs.disconnect();
          }
        }, {threshold:0, rootMargin:'0px 0px 80px 0px'});
        obs.observe(el);
      })(conn);
    }
  }

  /* ================================================================
     7. SMOOTH SECTION TRANSITIONS — Subtle scale on exit
     Sections gently shrink as they scroll out of view
     ================================================================ */
  function initSectionTransitions() {
    if (isMobile) return;
    var secs = document.querySelectorAll('.sec.pad, .svc-section');
    secs.forEach(function(sec) {
      if (sec.id === 'hero') return;
      sec.classList.add('te-section');

      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            sec.classList.add('te-visible');
            sec.classList.remove('te-exited');
          } else if (entry.boundingClientRect.top < 0) {
            sec.classList.add('te-exited');
            sec.classList.remove('te-visible');
          }
        });
      }, {threshold:[0, 0.15]});
      obs.observe(sec);
    });
  }

  /* ================================================================
     INIT — Run after DOM + GSAP are ready
     ================================================================ */
  function init() {
    initBootSequence();
    initNeuralMesh();
    initCursor();
    initScrollProgress();
    initSectionGlow();
    initConnectors();
    initSectionTransitions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
