/* ═══════════════════════════════════════════════════════════════════
   TERMINAL EDGE — App Engine v3.0
   Zero external dependencies · Pure vanilla JavaScript
   Handles: nav, mobile menu, scroll reveals, page transitions,
   scroll progress, FAQ accordion, contact form
   ═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ================================================================
     1. SCROLL PROGRESS BAR
     ================================================================ */
  function initScrollProgress() {
    var bar = document.querySelector('.scroll-progress');
    if (!bar) return;

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function() {
          var h = document.documentElement.scrollHeight - window.innerHeight;
          if (h > 0) bar.style.width = (window.scrollY / h * 100) + '%';
          ticking = false;
        });
      }
    }, { passive: true });
  }


  /* ================================================================
     2. NAVIGATION — Scroll state + Mobile menu
     ================================================================ */
  function initNav() {
    var nav = document.querySelector('.nav');
    var burger = document.querySelector('.nav-burger');
    var mobile = document.querySelector('.mobile-menu');

    if (!nav) return;

    /* Scroll state */
    var scrollTick = false;
    window.addEventListener('scroll', function() {
      if (!scrollTick) {
        scrollTick = true;
        requestAnimationFrame(function() {
          nav.classList.toggle('scrolled', window.scrollY > 60);
          scrollTick = false;
        });
      }
    }, { passive: true });

    /* Mobile menu toggle */
    if (burger && mobile) {
      burger.addEventListener('click', function() {
        burger.classList.toggle('active');
        mobile.classList.toggle('open');
        document.body.style.overflow = mobile.classList.contains('open') ? 'hidden' : '';
      });

      /* Close on link click */
      mobile.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          burger.classList.remove('active');
          mobile.classList.remove('open');
          document.body.style.overflow = '';
        });
      });
    }
  }


  /* ================================================================
     3. SCROLL REVEAL — IntersectionObserver
     Single observer handles all reveal animations with stagger
     ================================================================ */
  function initScrollReveal() {
    var elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          /* Calculate stagger delay based on sibling position */
          var delay = 0;
          var parent = entry.target.closest('.grid, .grid-2, .grid-3, .grid-4, .stats-grid, .services-grid, .showcase-grid, .pricing-grid, .testimonial-grid, .tech-grid, .process-grid, .faq-list, .feature-grid');
          if (parent) {
            var siblings = parent.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
            for (var i = 0; i < siblings.length; i++) {
              if (siblings[i] === entry.target) {
                delay = i * 0.08;
                break;
              }
            }
          }
          entry.target.style.transitionDelay = delay + 's';
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.06,
      rootMargin: '0px 0px -6% 0px'
    });

    elements.forEach(function(el) {
      observer.observe(el);
    });
  }


  /* ================================================================
     4. FAQ ACCORDION
     ================================================================ */
  function initFAQ() {
    var items = document.querySelectorAll('.faq-item');
    items.forEach(function(item) {
      var question = item.querySelector('.faq-question');
      var answer = item.querySelector('.faq-answer');
      if (!question || !answer) return;

      question.addEventListener('click', function() {
        var isOpen = item.classList.contains('open');

        /* Close all others */
        items.forEach(function(other) {
          if (other !== item) {
            other.classList.remove('open');
            var otherAnswer = other.querySelector('.faq-answer');
            if (otherAnswer) otherAnswer.style.maxHeight = '0';
          }
        });

        /* Toggle current */
        if (isOpen) {
          item.classList.remove('open');
          answer.style.maxHeight = '0';
        } else {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  }


  /* ================================================================
     5. CONTACT FORM (Web3Forms)
     ================================================================ */
  function initContactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var btn = form.querySelector('.submit-btn');
      var originalText = btn.textContent;
      btn.textContent = 'Sending...';
      btn.style.opacity = '.7';
      btn.disabled = true;

      var formData = new FormData(form);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success) {
          btn.textContent = '✓ Message Sent!';
          btn.style.opacity = '1';
          btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          form.reset();
          setTimeout(function() {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
          }, 3000);
        } else {
          btn.textContent = 'Error — Try Again';
          btn.style.opacity = '1';
          btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
          setTimeout(function() {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
          }, 3000);
        }
      })
      .catch(function() {
        btn.textContent = 'Network Error';
        btn.style.opacity = '1';
        setTimeout(function() {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      });
    });
  }


  /* ================================================================
     6. PAGE TRANSITIONS
     Fade overlay on nav clicks for instant-feel navigation
     ================================================================ */
  function initPageTransitions() {
    var overlay = document.querySelector('.page-transition');
    if (!overlay) return;

    document.querySelectorAll('a[href$=".html"]').forEach(function(link) {
      if (link.hostname && link.hostname !== location.hostname) return;

      link.addEventListener('click', function(e) {
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

        e.preventDefault();
        overlay.classList.add('active');
        setTimeout(function() {
          window.location.href = href;
        }, 180);
      });
    });

    /* Fade out on page show (handles back/forward cache) */
    window.addEventListener('pageshow', function() {
      overlay.classList.remove('active');
    });
  }


  /* ================================================================
     7. CARD GLOW EFFECT (mouse-tracking radial gradient)
     ================================================================ */
  function initCardGlow() {
    var cards = document.querySelectorAll('.card, .service-card, .feature-card, .pricing-card, .testimonial-card, .showcase-card, .stat-card');
    cards.forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        var y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
      });
    });
  }


  /* ================================================================
     8. STAT COUNTER ANIMATION
     Counts up numbers when they scroll into view
     ================================================================ */
  function initStatCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var target = parseInt(el.dataset.count, 10);
          var duration = 1500;
          var start = 0;
          var startTime = null;

          function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            /* Ease out cubic */
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target);
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = target;
            }
          }
          requestAnimationFrame(step);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(function(c) { observer.observe(c); });
  }


  /* ================================================================
     9. RING GAUGE ANIMATION
     SVG circle stroke-dashoffset animation on scroll
     ================================================================ */
  function initRingGauges() {
    var rings = document.querySelectorAll('.ring-fill');
    if (!rings.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var ring = entry.target;
          var pct = parseInt(ring.dataset.pct, 10);
          var circumference = 2 * Math.PI * 35;
          var offset = circumference - (circumference * pct / 100);
          ring.style.strokeDasharray = circumference;
          ring.style.strokeDashoffset = circumference;
          setTimeout(function() {
            ring.style.transition = 'stroke-dashoffset 1.5s ' + 'cubic-bezier(.16,1,.3,1)';
            ring.style.strokeDashoffset = offset;
          }, 200);
          observer.unobserve(ring);
        }
      });
    }, { threshold: 0.3 });

    rings.forEach(function(r) { observer.observe(r); });
  }


  /* ================================================================
     10. SMOOTH ANCHOR SCROLLING
     ================================================================ */
  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        var target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }


  /* ================================================================
     INIT — Fire everything when DOM is ready
     ================================================================ */
  function init() {
    initScrollProgress();
    initNav();
    initScrollReveal();
    initFAQ();
    initContactForm();
    initPageTransitions();
    initCardGlow();
    initStatCounters();
    initRingGauges();
    initSmoothAnchors();

    /* Safety fallback: if reveals haven't fired after 3s, show everything */
    setTimeout(function() {
      document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function(el) {
        if (getComputedStyle(el).opacity === '0') {
          el.classList.add('revealed');
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      });
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
