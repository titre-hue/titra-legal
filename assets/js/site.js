/* titrapp.com site.js. Owner in wave 1: theme core (README.md, CONTRACT).
   Progressive enhancement only: every page is
   complete without it, and it never hides anything that is on screen when it runs. No
   dependencies, no inline handlers, no network requests, no cookies. Storage sits in try/catch.
   Hooks (60-motion.css holds the matching CSS): [data-reveal]; [data-stage] [data-step]
   [data-layer]; [data-tilt]; #dl-bar [data-dl-dismiss] [data-hero-cta]; [data-toc]
   [data-toc-label]; [data-lang-suggest] [data-lang-dismiss]. */
(() => {
  'use strict';
  const d = document;
  const w = window;
  const html = d.documentElement;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const mq = (q) => w.matchMedia(q);
  const on = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));
  const reduce = mq('(prefers-reduced-motion: reduce)');
  const phone = mq('(max-width: 1023px)');
  // The download bar is a phone-only control (30-layout.css hides it from 720 px).
  const barMq = mq('(max-width: 719px)');
  const fine = mq('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  const storyMq = mq('(min-width: 1024px) and (min-height: 760px) and (max-height: 1600px) and (prefers-reduced-motion: no-preference)');
  const css = (c) => !!(w.CSS && CSS.supports && CSS.supports(c));
  const hasIO = 'IntersectionObserver' in w;
  const store = (kind, key, val) => {
    try {
      if (val === undefined) return w[kind].getItem(key);
      w[kind].setItem(key, val);
    } catch (e) { /* storage blocked: the convenience is lost, nothing breaks */ }
    return null;
  };
  const onScroll = (fn) => {
    let f = 0;
    w.addEventListener('scroll', () => { if (!f) f = requestAnimationFrame(() => { f = 0; fn(); }); }, { passive: true });
  };

  // 1. Time-based reveals: on phones (scroll-linked reveals are desktop only: each kept a
  // compositor layer for the whole visit), and on desktops without CSS view timelines. The
  // observer's first report (after layout and any #fragment scroll) hides only elements below the
  // screen at that moment (.pre); they lose it as they come in, in 300 ms on a phone. The CSS
  // ignores .pre under reduced motion, so switching the setting mid-visit shows everything at once.
  // Never on a viewport taller than 1600 px (a renderer that grows the viewport to the page).
  const reveals = $$('[data-reveal]');
  const tall = w.innerHeight > 1600;
  if (reveals.length && hasIO && !reduce.matches && !tall && (phone.matches || !css('animation-timeline: view()'))) {
    html.classList.add('io');
    const seen = new WeakSet();
    const io = new IntersectionObserver((es) => es.forEach(({ target: el, isIntersecting, boundingClientRect: r }) => {
      if (!seen.has(el)) {
        seen.add(el);
        if (!isIntersecting && r.top >= w.innerHeight) { el.classList.add('pre'); return; }
        el.classList.add('is-in');
        io.unobserve(el);
        return;
      }
      if (!isIntersecting) return;
      io.unobserve(el);
      el.classList.add('is-revealing', 'is-in');
      el.classList.remove('pre');
      setTimeout(() => el.classList.remove('is-revealing'), 1600);
    }), { rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
    on(reduce, () => { if (reduce.matches) $$('.pre').forEach((el) => el.classList.remove('pre')); });
  }

  // 2. Story fallback (desktop): where view timelines with timeline-scope are missing, the step
  // in the middle of the screen drives the stage (--step and data-step on its host) and gets
  // aria-current="step". The CSS only uses this inside its story-mode media query.
  const stage = $('[data-stage]');
  const steps = $$('[data-step]:not([data-stage])');
  if (stage && steps.length && hasIO && !css('(animation-timeline: view()) and (timeline-scope: --a)')) {
    html.classList.add('io-story');
    const host = stage.closest('[data-story]') || stage.parentElement;
    let cur = 0;
    const set = (n) => {
      if (!storyMq.matches) n = 0;
      if (n === cur) return;
      cur = n;
      if (n) { stage.dataset.step = n; host.style.setProperty('--step', n); }
      steps.forEach((s) => (n && s.dataset.step === String(n) ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current')));
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) set(Number(e.target.dataset.step) || 1);
    }), { rootMargin: '-45% 0px -45% 0px' });
    const watchSteps = () => steps.forEach((s) => { io.unobserve(s); io.observe(s); });
    watchSteps();
    on(storyMq, () => { set(0); watchSteps(); });
  }

  // 3. Pointer tilt, fine pointer from 1024 px: --px/--py (-0.5..0.5), one style write per frame.
  // The tilt goes on the element itself, or on its parent when it is a .device (whose own
  // transform holds the angle), via .tilt-on (60-motion.css owns `transform` there).
  $$('[data-tilt]').forEach((src) => {
    const el = src.classList.contains('device') && src.parentElement ? src.parentElement : src;
    let r = null;
    let raf = 0;
    let x = 0;
    let y = 0;
    el.classList.add('tilt-on');
    const paint = () => { raf = 0; el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3)); };
    const reset = () => { x = 0; y = 0; r = null; if (!raf) raf = requestAnimationFrame(paint); };
    const clamp = (v) => Math.max(-0.5, Math.min(0.5, v));
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !fine.matches || reduce.matches) return;
      if (!r) r = el.getBoundingClientRect();
      x = clamp((e.clientX - r.left) / r.width - 0.5);
      y = clamp((e.clientY - r.top) / r.height - 0.5);
      if (!raf) raf = requestAnimationFrame(paint);
    });
    el.addEventListener('pointerleave', reset);
    w.addEventListener('scroll', () => { r = null; }, { passive: true });
    on(reduce, reset);
    on(fine, reset);
  });

  // 4. Phone download bar and header (home pages, below 720 px). The bar shows once the hero
  // (its plate, with the store links) has scrolled away, while scrolling down; the header tucks
  // away at the same moment, so the two are never on screen together. Both come back the other way
  // on scroll-up. The bar hides over the dark closing band and the footer, and a dismissal lasts for the
  // session (focus then moves to the page, not to <body>).
  const bar = $('#dl-bar');
  const header = $('.site-header');
  if (bar && hasIO) {
    const cta = $('.hero-plate') || $('[data-hero-cta]') || $('main .btn');
    const near = new Set();
    let past = !cta;
    let down = true;
    let lastY = w.scrollY;
    let timer = 0;
    let dismissed = store('sessionStorage', 'ti-dl-bar') === '1';
    html.classList.add('has-dl');
    const setBar = (show) => {
      clearTimeout(timer);
      if (show) {
        if (bar.hidden) { bar.hidden = false; void bar.offsetWidth; } // start the slide from below
        bar.classList.add('is-up');
      } else if (!bar.hidden) {
        bar.classList.remove('is-up');
        timer = setTimeout(() => { bar.hidden = true; }, reduce.matches ? 0 : 260);
      }
    };
    const update = () => {
      const show = barMq.matches && past && !near.size && !dismissed && down;
      setBar(show);
      // Tuck the header only while the bar really renders (the layout may hide it on wider screens).
      if (header) header.classList.toggle('is-tucked', show && bar.getClientRects().length > 0);
    };
    if (cta) {
      new IntersectionObserver(([e]) => {
        past = !e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds ? e.rootBounds.top : 0);
        update();
      }).observe(cta);
    }
    const ends = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? near.add(e.target) : near.delete(e.target)));
      update();
    });
    $$('.sheet--dark, .site-footer').forEach((el) => ends.observe(el));
    onScroll(() => {
      const y = w.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      const dn = y > lastY;
      lastY = y;
      if (dn !== down) { down = dn; update(); }
    });
    bar.addEventListener('click', (e) => {
      if (!e.target.closest('[data-dl-dismiss]')) return;
      dismissed = true;
      store('sessionStorage', 'ti-dl-bar', '1');
      const main = $('main');
      if (main && bar.contains(d.activeElement)) {
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
      update();
    });
    on(barMq, update);
    update();
  } else if (header && hasIO && $('.toc-bar')) {
    // 4b. Articles with the phone contents strip: the header tucks away while reading down and
    // comes back on scroll-up, so header and strip never take a fifth of a small screen together.
    html.classList.add('has-tuck');
    let lastY = w.scrollY;
    const tuck = (on2) => {
      header.classList.toggle('is-tucked', on2);
      html.classList.toggle('hdr-tucked', on2);
    };
    onScroll(() => {
      const y = w.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      const dn = y > lastY;
      lastY = y;
      tuck(phone.matches && dn && y > 240);
    });
    on(phone, () => tuck(false));
  }

  // 5. Article contents: aria-current="true" on the link of the section being read (the last
  // heading above 35% of the screen, or the last one at the very bottom), and the phone "On this
  // page" summary text set to that section. Choosing a link closes the phone <details>. Checked on
  // every scroll frame rather than by an observer: a jump (PageDown, End, a restored scroll
  // position) can carry a heading past the line without any intersection change.
  const labelEls = $$('[data-toc-label]');
  let tocs = $$('[data-toc]');
  if (!tocs.length) tocs = $$('nav.toc');
  tocs = [...new Set([...tocs, ...labelEls.map((el) => el.closest('details')).filter(Boolean)])];
  if (tocs.length) {
    const links = tocs.flatMap((t) => $$('a[href^="#"]', t));
    const idOf = (a) => { try { return decodeURIComponent(a.hash.slice(1)); } catch (e) { return a.hash.slice(1); } };
    const heads = [...new Set(links.map(idOf))].map((id) => d.getElementById(id)).filter(Boolean);
    const labels = labelEls.map((el) => [el, el.textContent]);
    // The entry's own words: aria-hidden parts (such as its "02") are left out.
    const text = (id) => {
      const a = links.find((l) => idOf(l) === id);
      return a ? [...a.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true'))
        .map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim() : '';
    };
    let cur = null;
    const set = (h) => {
      if (h === cur) return;
      cur = h;
      const id = h ? h.id : '';
      links.forEach((a) => (id && idOf(a) === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      labels.forEach(([el, base]) => { el.textContent = (id && text(id)) || base; });
    };
    const pick = () => {
      const line = w.innerHeight * 0.35;
      const atEnd = w.innerHeight + w.scrollY >= html.scrollHeight - 4;
      let h = null;
      heads.forEach((el) => { if (el.getBoundingClientRect().top < line) h = el; });
      set(atEnd ? heads[heads.length - 1] : h);
    };
    if (heads.length) {
      onScroll(pick);
      w.addEventListener('resize', pick, { passive: true });
      w.addEventListener('load', pick);
      // After the first frame, not during start-up: reading heading positions here forced a full
      // layout inside the script while the web fonts were still arriving.
      requestAnimationFrame(() => requestAnimationFrame(pick));
    }
    tocs.forEach((t) => t.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const box = t.closest('details');
      if (box) box.open = false;
      // The phone sheet closes under the pointer, so focus moves to the heading jumped to (screen
      // readers keep their place); the browser scrolls it to just below the contents strip.
      const target = d.getElementById(idOf(a));
      if (box && target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        setTimeout(() => target.focus({ preventScroll: true }), 0);
      }
    }));
  }

  // 6. Desktop: keyboard focus that lands in a sticky block covered by the next sheet (the home
  // hero while the story slides over it) scrolls the block back into view.
  d.addEventListener('focusin', (e) => {
    const t = e.target;
    if (phone.matches || !(t instanceof Element) || !t.closest('main')) return;
    let s = t.parentElement;
    while (s && s.tagName !== 'MAIN' && getComputedStyle(s).position !== 'sticky') s = s.parentElement;
    if (!s || s.tagName === 'MAIN') return;
    const r = t.getBoundingClientRect();
    const hit = d.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    if (hit && !t.contains(hit)) w.scrollTo(0, Math.max(0, s.parentElement.getBoundingClientRect().top + w.scrollY - 96));
  });

  // 7a. Popover sheets and menus are not modal: when keyboard focus moves out of one (Tab past its
  // last link), it closes, so focus never lands on content hidden under it.
  $$('[popover]').forEach((pop) => {
    if (typeof pop.hidePopover !== 'function') return;
    pop.addEventListener('focusout', (e) => {
      const to = e.relatedTarget;
      if (!to || pop.contains(to) || (to.getAttribute && to.getAttribute('popovertarget') === pop.id)) return;
      try { if (pop.matches(':popover-open')) pop.hidePopover(); } catch (err) { /* already closed */ }
    });
  });

  // 7. Optional language line (off until its strings are checked by native speakers): shown when
  // the visitor's preferred language has this page and isn't the page's own. Never a redirect.
  const sug = $('[data-lang-suggest]');
  if (sug && store('localStorage', 'ti-lang-suggest') !== '1') {
    const here = (html.lang || '').slice(0, 2).toLowerCase();
    const want = (navigator.languages || [navigator.language || '']).map((l) => String(l).slice(0, 2).toLowerCase());
    for (const l of want) {
      if (l === here) break;
      const a = /^[a-z]{2}$/.test(l) && $(`a[hreflang="${l}"]`, sug);
      if (a) { a.hidden = false; sug.hidden = false; break; }
    }
    sug.addEventListener('click', (e) => {
      if (!e.target.closest('[data-lang-dismiss]')) return;
      sug.hidden = true;
      store('localStorage', 'ti-lang-suggest', '1');
    });
  }
})();
