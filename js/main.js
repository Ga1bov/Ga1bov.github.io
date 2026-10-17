/* Gaibov — portfolio. Vanilla JS, no build. Settings live in js/config.js. */
(() => {
  'use strict';
  const SITE = Object.assign({ telegram: '', channel: '', endpoint: '', available: true }, window.SITE);
  const D = window.I18N || { en: {}, dyn: { ru: {}, en: {} } };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches; // мышь: наклон, подсветка, магнит, курсор
  const tg = String(SITE.telegram || '').replace(/^@/, '').trim();
  const viaApi = Boolean(SITE.endpoint);

  /* ---------- кейсы: галереи с кнопками и счётчиком, соседние проекты внизу окна — собираются при первом открытии окна ---------- */
  const caseCards = $$('[data-case]');
  function buildGallery(s) {
    const g = document.createElement('div'); g.className = 'gal';
    s.before(g); g.appendChild(s);
    const bar = document.createElement('div'); bar.className = 'gal__bar';
    bar.innerHTML = '<button type="button" class="round gal__prev" data-dyn-label="gal.prev"><svg class="ico" aria-hidden="true"><use href="#i-arrow-r"/></svg></button>'
      + '<span class="gal__n" aria-hidden="true"></span>'
      + '<button type="button" class="round gal__next" data-dyn-label="gal.next"><svg class="ico" aria-hidden="true"><use href="#i-arrow-r"/></svg></button>';
    g.appendChild(bar);
    const imgs = $$('img', s); const n = $('.gal__n', bar); const prev = $('.gal__prev', bar); const next = $('.gal__next', bar);
    const stepW = () => (imgs.length > 1 ? imgs[1].offsetLeft - imgs[0].offsetLeft : s.clientWidth) || 1;
    g.upd = () => {
      const max = s.scrollWidth - s.clientWidth;
      n.textContent = (s.scrollLeft >= max - 2 ? imgs.length : Math.round(s.scrollLeft / stepW()) + 1) + ' / ' + imgs.length;
      prev.disabled = s.scrollLeft <= 2; next.disabled = s.scrollLeft >= max - 2;
    };
    prev.addEventListener('click', () => s.scrollBy({ left: -stepW() }));
    next.addEventListener('click', () => s.scrollBy({ left: stepW() }));
    let q = 0;
    s.addEventListener('scroll', () => { if (!q) q = requestAnimationFrame(() => { q = 0; g.upd(); }); }, { passive: true });
    imgs.forEach((im) => im.addEventListener('load', g.upd));
  }
  function buildPager(d) {
    const i = caseCards.findIndex((c) => 'case-' + c.dataset.case === d.id);
    const nav = document.createElement('nav'); nav.className = 'case__pager'; nav.dataset.dynLabel = 'case.more';
    [[-1, 'prev'], [1, 'next']].forEach(([k, dir]) => {
      const other = caseCards[(i + k + caseCards.length) % caseCards.length];
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'pager__a pager__a--' + dir; b.dataset.goto = other.dataset.case; b.dataset.dir = dir;
      const tone = Array.from(other.querySelector('.thumb').classList).find((c) => c.indexOf('thumb--') === 0) || '';
      b.innerHTML = '<span class="pager__img ' + tone + '" aria-hidden="true"></span><span class="pager__t"><small data-dyn="case.' + dir + '"></small></span>';
      // адрес ставится только при открытии/наведении (warmCase): копия картинки вне документа начала бы грузиться сразу
      const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      im.dataset.src = other.querySelector('.thumb img').getAttribute('src');
      b.firstChild.appendChild(im);
      const src = other.querySelector('.work-card__title'); const t = src.cloneNode(true); t.className = 'pager__title';
      b.lastChild.appendChild(t);
      // переводимое название: если русские оригиналы уже сняты, добавляем копию к ним (с русским текстом источника)
      const o = orig && t.hasAttribute('data-i18n') && orig.find((x) => x.el === src);
      if (o) orig.push({ el: t, t: o.t });
      onIntent(b, () => warmCase(b.dataset.goto));
      nav.appendChild(b);
    });
    $('.case__box', d).appendChild(nav);
  }
  function buildCase(d) {
    if (d.dataset.built) return;
    d.dataset.built = '1';
    $$('.strip', d).forEach(buildGallery);
    buildPager(d);
    $$('[data-dyn]', d).forEach((el) => { el.textContent = dyn(el.dataset.dyn); });
    $$('[data-dyn-label]', d).forEach((el) => el.setAttribute('aria-label', dyn(el.dataset.dynLabel)));
  }

  /* ---------- i18n: русские оригиналы берём из DOM, английские — из i18n.js ---------- */
  let lang = 'ru'; let domLang = 'ru'; // domLang — на каком языке сейчас тексты в DOM
  // оригиналы снимаются при первой смене языка: до неё DOM и так на русском, и стартовый скрипт не читает ~200 элементов
  let orig = null;
  const capture = () => orig || (orig = $$('[data-i18n],[data-i18n-html],[data-i18n-attr]').map((el) => {
    const o = { el };
    if (el.hasAttribute('data-i18n')) o.t = el.textContent;
    if (el.hasAttribute('data-i18n-html')) o.h = el.innerHTML;
    if (el.hasAttribute('data-i18n-attr')) {
      o.a = el.getAttribute('data-i18n-attr').split(';').map((p) => {
        const [at, key] = p.split(':');
        return { at, key, ru: el.getAttribute(at) };
      });
    }
    return o;
  }));
  const dyn = (k) => (D.dyn[lang] && D.dyn[lang][k]) || D.dyn.ru[k] || k;
  const pick = (key, fallback) => (lang === 'en' && D.en[key] != null ? D.en[key] : fallback);

  function setLang(next, persist) {
    lang = next === 'en' ? 'en' : 'ru';
    // при старте на русском тексты уже на месте: не переписываем ~200 элементов (каждая запись — перекладка страницы)
    if (lang !== domLang) {
      capture().forEach((o) => {
        if ('t' in o) o.el.textContent = pick(o.el.getAttribute('data-i18n'), o.t);
        if ('h' in o) o.el.innerHTML = pick(o.el.getAttribute('data-i18n-html'), o.h);
        if (o.a) o.a.forEach((a) => o.el.setAttribute(a.at, pick(a.key, a.ru)));
      });
      domLang = lang;
    }
    $$('[data-dyn]').forEach((el) => { const v = dyn(el.dataset.dyn); if (el.textContent !== v) el.textContent = v; });
    $$('[data-dyn-label]').forEach((el) => el.setAttribute('aria-label', dyn(el.dataset.dynLabel)));
    root.lang = lang;
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    if (persist) { try { localStorage.setItem('gb-lang', lang); } catch (e) { /* private mode */ } }
    rail = null; // высота карточек процесса зависит от языка
    renderSent();
    clearErrors();
  }

  // смена языка: видимые тексты гаснут, меняются и проявляются; строки подзаголовка hero заново выезжают из маски (новые элементы = новая CSS-анимация)
  const sub = $('.hero__sub');
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => switchLang(b.dataset.lang)));
  function switchLang(next) {
    if (next === lang) return;
    if (reduce) return setLang(next, true);
    const els = $$('[data-i18n],[data-i18n-html],[data-dyn],.pager__title').filter((el) => {
      if (el === sub) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    els.forEach((el) => el.classList.add('i18n-fade', 'i18n-out'));
    setTimeout(() => {
      setLang(next, true);
      requestAnimationFrame(() => {
        els.forEach((el) => el.classList.remove('i18n-out'));
        setTimeout(() => els.forEach((el) => el.classList.remove('i18n-fade')), 200);
      });
    }, 120);
  }

  /* ---------- навигация ---------- */
  const nav = $('#nav'); const burger = $('#burger');
  const closeNav = () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => burger.setAttribute('aria-expanded', String(nav.classList.toggle('is-open'))));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', closeNav));
  $$('.nav__links li').forEach((li, i) => li.style.setProperty('--i', i)); // каскад пунктов мобильного меню
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) closeNav(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeNav(); burger.focus(); } });

  const links = $$('.nav__links a');
  const byId = {};
  links.forEach((a) => { const id = a.getAttribute('href').slice(1); if (!byId[id]) byId[id] = a; });
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((es) => es.forEach((e) => {
      const a = e.isIntersecting && byId[e.target.id];
      if (!a) return;
      links.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      a.classList.add('is-active'); a.setAttribute('aria-current', 'location');
    }), { rootMargin: '-40% 0px -55% 0px' });
    ['top', 'about', 'services', 'work', 'process', 'faq', 'contact'].forEach((id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- прокрутка: плотность шапки и прогресс чтения ---------- */
  const bar = $('.nav__progress i');
  let ticking = false;
  function onScrollFrame() {
    ticking = false;
    const y = window.scrollY; const max = root.scrollHeight - innerHeight;
    root.classList.toggle('is-scrolled', y > 16);
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
    drawSteps();
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ---------- появление при скролле: каскад внутри одной «волны» (что вошло в кадр вместе — появляется по очереди) ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es, o) => {
      let n = 0;
      es.filter((e) => e.isIntersecting)
        .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left))
        .forEach((e) => {
          const el = e.target; const d = Math.min(n++, 6) * 70;
          el.style.setProperty('--d', d + 'ms'); el.classList.add('is-in'); o.unobserve(el);
          setTimeout(() => el.classList.add('is-done'), d + 800); // дальше элемент живёт со своими переходами
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
  } else {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in', 'is-done'));
  }

  /* ---------- «Обо мне»: счётчики 0 → N (числа берутся из разметки) ---------- */
  const nums = $$('.stats b');
  if (nums.length && !reduce && 'IntersectionObserver' in window) {
    const vals = nums.map((b) => parseInt(b.textContent, 10) || 0);
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        let busy = false;
        nums.forEach((b, i) => {
          const k = Math.max(0, Math.min(1, (t - t0 - i * 160) / 1100));
          b.textContent = String(Math.round(vals[i] * (1 - Math.pow(1 - k, 3))));
          if (k < 1) busy = true;
        });
        if (busy) requestAnimationFrame(tick);
      };
      nums.forEach((b) => { b.textContent = '0'; });
      requestAnimationFrame(tick);
    }, { threshold: 0.5 }).observe($('.stats'));
  }

  /* ---------- процесс: линия дорисовывается при прокрутке, точки загораются ---------- */
  const steps = $('.steps'); const stepEls = $$('.step', steps);
  let rail = null;
  function measureSteps() {
    const last = stepEls[stepEls.length - 1];
    const vertical = stepEls[1].offsetTop > stepEls[0].offsetTop; // одна колонка
    if (vertical) {
      steps.style.setProperty('--rail-e', (last.offsetHeight - 30) + 'px');
      const y0 = stepEls[0].offsetTop; const len = (last.offsetTop - y0) || 1;
      rail = { vertical, top: y0 + 30, len, fr: stepEls.map((s) => (s.offsetTop - y0) / len) };
    } else rail = { vertical, fr: stepEls.map((s, i) => i / (stepEls.length - 1)) };
  }
  function drawSteps() {
    const r = steps.getBoundingClientRect(); const vh = innerHeight;
    if (r.top > vh || r.bottom < 0) return; // секция за экраном — не меряем
    if (!rail) measureSteps();
    let p = reduce ? 1 : rail.vertical ? (vh * 0.62 - (r.top + rail.top)) / rail.len : (vh * 0.9 - r.top) / (vh * 0.45);
    p = Math.max(0, Math.min(1, p));
    steps.style.setProperty('--p', p.toFixed(4));
    stepEls.forEach((s, i) => s.classList.toggle('is-on', p > 0 && p >= rail.fr[i] - 0.002));
  }
  addEventListener('resize', () => { rail = null; });

  /* ---------- плавная прокрутка колесом: мягкая инерция (только мышь/тачпад, без reduced-motion) ---------- */
  if (fine && !reduce) {
    let y = 0, target = 0, raf = 0, last = 0, mine = -1;
    const maxY = () => root.scrollHeight - innerHeight;
    // колесо внутри прокручиваемого блока (textarea, лента кадров) отдаём ему
    const inner = (el, dy) => {
      for (; el && el !== document.body && el !== root; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
          && (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
      }
      return false;
    };
    const step = (t) => {
      const k = 1 - Math.pow(1 - 0.12, Math.max(1, t - last) / 16.7); last = t;
      y += (target - y) * k;
      if (Math.abs(target - y) < 0.5) y = target;
      mine = y; window.scrollTo({ top: y, behavior: 'instant' });
      raf = y === target ? 0 : requestAnimationFrame(step);
    };
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || root.style.overflow === 'hidden' || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (inner(e.target, dy)) return;
      e.preventDefault();
      if (!raf) { y = window.scrollY; target = y; last = performance.now(); raf = requestAnimationFrame(step); }
      target = Math.max(0, Math.min(maxY(), target + dy));
    }, { passive: false });
    // клавиатура, полоса прокрутки, якорь — кто-то другой двигает страницу: отдаём управление
    addEventListener('scroll', () => { if (raf && Math.abs(window.scrollY - mine) > 3) { cancelAnimationFrame(raf); raf = 0; } }, { passive: true });
  }

  /* ---------- hero: 3D-наклон сцены за курсором (плавный догон, только transform) ---------- */
  const stage = $('#stage'); const hero = $('#top');
  if (stage && fine && !reduce && !root.classList.contains('lite')) {
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const tilt = $('.stage__tilt', stage);
    const glares = $$('.dev-browser,.dev-phone', stage).map((d) => {
      const g = document.createElement('i'); g.className = 'glare'; g.setAttribute('aria-hidden', 'true'); d.appendChild(g); return g;
    });
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, last = 0;
    const step = (t) => {
      const k = 1 - Math.pow(0.86, Math.max(1, t - last) / 16.7); last = t;
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      tilt.style.transform = 'rotateX(' + (cy * -7).toFixed(3) + 'deg) rotateY(' + (cx * 9).toFixed(3) + 'deg)';
      glares.forEach((g) => { g.style.transform = 'translateX(' + (cx * 24).toFixed(2) + '%)'; });
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
    hero.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1); ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1); kick();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }
  // аврора за стеклом движется, только пока hero на экране
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => root.classList.toggle('aurora-off', !e.isIntersecting)).observe(hero);

  /* ---------- микровзаимодействия: подсветка карточек, магнитные кнопки, «волна» нажатия ---------- */
  if (fine) {
    document.addEventListener('pointermove', (e) => {
      const c = e.target.closest && e.target.closest('.svc,.work-card,.tile,.step');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--sx', Math.round(e.clientX - r.left) + 'px'); c.style.setProperty('--sy', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  if (fine && !reduce) {
    $$('.btn').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        // центр по раскладке (без собственного сдвига кнопки), иначе кнопка «догоняет» сама себя
        const pr = b.offsetParent ? b.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
        const dx = (e.clientX - (pr.left + b.offsetLeft + b.offsetWidth / 2)) / b.offsetWidth;
        const dy = (e.clientY - (pr.top + b.offsetTop + b.offsetHeight / 2)) / b.offsetHeight;
        b.style.translate = (dx * 12).toFixed(1) + 'px ' + (dy * 8).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }
  if (!reduce) {
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('button.btn,a.btn,button.round');
      if (!b || e.button !== 0) return;
      let fx = b.querySelector(':scope > .fx');
      if (!fx) { fx = document.createElement('span'); fx.className = 'fx'; fx.setAttribute('aria-hidden', 'true'); b.prepend(fx); }
      const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height) * 2.2;
      const i = document.createElement('i');
      i.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
      fx.appendChild(i);
      setTimeout(() => i.remove(), 700);
    }, { passive: true });
  }

  /* ---------- свой курсор: точка — указатель (без задержки), стеклянная линза догоняет её; только мышь,
     без reduced-motion, lite и режимов повышенного контраста (там остаётся системный курсор пользователя) ---------- */
  let raiseCursor = () => {};
  if (fine && !reduce && !root.classList.contains('lite') && !matchMedia('(forced-colors: active), (prefers-contrast: more)').matches) {
    const cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span class="cursor__lens"><span class="cursor__txt" data-dyn="cur.open">' + dyn('cur.open') + '</span></span><span class="cursor__dot"></span>';
    document.body.appendChild(cur);
    const lens = cur.firstChild; const dot = cur.lastChild;
    // верхний слой: popover, поднятый после открытия окна, рисуется над ним (show() зовёт raiseCursor)
    if (typeof cur.showPopover === 'function') {
      cur.popover = 'manual';
      raiseCursor = () => { try { if (cur.matches(':popover-open')) cur.hidePopover(); cur.showPopover(); } catch (e) { /* не в документе */ } };
      raiseCursor();
    }
    const FIELD = 'input:not([type=radio]):not([type=checkbox]),textarea,select,[contenteditable]';
    let x = 0, y = 0, lx = 0, ly = 0, raf = 0, last = 0, on = false;
    const step = (t) => {
      const k = 1 - Math.pow(0.78, Math.max(1, t - last) / 16.7); last = t;
      lx += (x - lx) * k; ly += (y - ly) * k;
      lens.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      raf = Math.abs(x - lx) + Math.abs(y - ly) > 0.2 ? requestAnimationFrame(step) : 0;
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      if (!on) { on = true; lx = x; ly = y; cur.classList.add('is-on'); root.classList.add('has-cursor'); }
      const t = e.target.closest ? e.target : document.body;
      const field = Boolean(t.closest(FIELD));
      cur.classList.toggle('is-text', field);
      cur.classList.toggle('is-card', !field && Boolean(t.closest('[data-case]')));
      cur.classList.toggle('is-hot', !field && Boolean(t.closest('a,button,summary,label')));
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    }, { passive: true });
    addEventListener('pointerdown', () => cur.classList.add('is-down'), { passive: true });
    addEventListener('pointerup', () => cur.classList.remove('is-down'), { passive: true });
    // мышь ушла из окна: свой курсор гаснет, системный возвращается; при возвращении линза не «прилетает» издалека
    root.addEventListener('mouseleave', () => { on = false; cur.classList.remove('is-on'); root.classList.remove('has-cursor'); });
  }

  /* ---------- контакты и доступность из config.js ---------- */
  if (!SITE.available) $('#avail').hidden = true;
  if (tg) {
    $('#tg-row').hidden = false;
    const a = $('#tg-link'); a.href = 'https://t.me/' + tg; a.textContent = '@' + tg;
  } else if (!viaApi) {
    console.info('[gaibov] Укажите telegram или endpoint в js/config.js — иначе заявка только копируется.');
  }
  const ch = String(SITE.channel || '').replace(/^@/, '').trim();
  if (ch) {
    $('#ch-row').hidden = false;
    const a = $('#ch-link'); a.href = 'https://t.me/' + ch; a.textContent = '@' + ch;
  }

  /* ---------- кейсы (native <dialog>): карточка «вырастает» в окно через View Transitions, без поддержки — прежний pop ---------- */
  const lock = (on) => { root.style.overflow = on ? 'hidden' : ''; root.classList.toggle('is-locked', on); };
  const vtOK = typeof document.startViewTransition === 'function' && !reduce && !root.classList.contains('lite');
  const name = (pairs) => pairs.forEach(([el, n]) => { if (el) el.style.viewTransitionName = n; });
  // класс .vt гасит pop окна на всё время, пока оно открыто (снимается в close), иначе pop сыграет второй раз после перехода
  const morph = (dlgs, update, done) => {
    dlgs.forEach((d) => d.classList.add('vt'));
    document.startViewTransition(update).finished.finally(done);
  };
  const cardOf = (d) => $('[data-case="' + d.id.slice(5) + '"]');
  const show = (d) => { buildCase(d); warmCase(d.id.slice(5)); root.classList.add('ready'); d.showModal(); raiseCursor(); lock(true); $('.case__box', d).scrollTop = 0; $$('.gal', d).forEach((g) => g.upd()); };
  function openCase(card) {
    const d = $('#case-' + card.dataset.case);
    if (!d || typeof d.showModal !== 'function') return;
    if (!vtOK) return show(d);
    const box = $('.case__box', d); const h = $('.case__head h2', d); const t = $('.work-card__title', card);
    name([[card, 'case-box'], [t, 'case-title']]);
    morph([d], () => { name([[card, ''], [t, ''], [box, 'case-box'], [h, 'case-title']]); show(d); }, () => name([[box, ''], [h, '']]));
  }
  function closeCase(d, animate) {
    if (!d.open) return;
    const card = cardOf(d); const r = card && card.getBoundingClientRect();
    if (!vtOK || !animate || !r || r.bottom < 0 || r.top > innerHeight) return d.close();
    const box = $('.case__box', d); const h = $('.case__head h2', d); const t = $('.work-card__title', card);
    root.dataset.vt = 'close'; name([[box, 'case-box'], [h, 'case-title']]);
    morph([d], () => { name([[box, ''], [h, ''], [card, 'case-box'], [t, 'case-title']]); d.close(); }, () => { name([[card, ''], [t, '']]); delete root.dataset.vt; });
  }
  function switchCase(from, id, dir) {
    const to = $('#case-' + id); if (!to) return;
    const run = () => { from.close(); show(to); };
    if (!vtOK) return run();
    const a = $('.case__box', from); const b = $('.case__box', to);
    root.dataset.vt = dir; name([[a, 'case-box']]);
    morph([from, to], () => { name([[a, ''], [b, 'case-box']]); run(); }, () => { name([[b, '']]); delete root.dataset.vt; });
  }
  // картинки кейса подгружаем заранее (наведение, фокус, касание): окно открывается уже с кадрами, переход не ждёт декодирования
  const warmCase = (id) => $$('#case-' + id + ' img').forEach((im) => {
    if (im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); }
    im.loading = 'eager';
  });
  const onIntent = (el, fn) => ['pointerenter', 'focus', 'touchstart'].forEach((t) => el.addEventListener(t, fn, { once: true, passive: true }));
  caseCards.forEach((b) => { b.addEventListener('click', () => openCase(b)); onIntent(b, () => warmCase(b.dataset.case)); });
  $$('dialog.case').forEach((d) => {
    d.addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) return switchCase(d, go.dataset.goto, go.dataset.dir);
      // фон и крестик — с анимацией; кнопки, ведущие к брифу, закрывают сразу (дальше прокрутка)
      if (e.target === d) closeCase(d, true);
      else if (e.target.closest('[data-close]')) closeCase(d, Boolean(e.target.closest('.round')));
    });
    d.addEventListener('cancel', (e) => { if (e.cancelable && vtOK) { e.preventDefault(); closeCase(d, true); } });
    d.addEventListener('close', () => {
      d.classList.remove('vt');
      if ($('dialog.case[open]')) return; // переход к соседнему кейсу
      lock(false);
      // фокус — на карточку того кейса, который закрыли (после переходов между кейсами браузер вернул бы его на первый)
      const card = cardOf(d);
      if (card && document.activeElement !== card) card.focus({ preventScroll: true });
    });
  });

  /* ---------- услуги -> бриф ---------- */
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const r = $('input[name="type"][value="' + b.dataset.pick + '"]');
    if (r) { r.checked = true; $('#err-type').textContent = ''; }
    $('#contact').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => $('#f-msg').focus({ preventScroll: true }), reduce ? 0 : 700);
  }));

  /* ---------- бриф ---------- */
  const form = $('#brief'); const sent = $('#sent');
  const msgEl = form.elements.message; const contactEl = form.elements.contact;
  let state = null;
  const label = (name) => { const r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.nextElementSibling.textContent.trim() : ''; };

  // Через Worker заявка приходит без Telegram-аккаунта клиента, поэтому контакт обязателен.
  $('#brief-note').dataset.dyn = viaApi ? 'note.ep' : 'note.tg';
  $('label[for="f-contact"]').dataset.dyn = viaApi ? 'lbl.contact.req' : 'lbl.contact.opt';

  function buildText() {
    const none = dyn('tpl.none');
    return [
      dyn('tpl.head'), '',
      dyn('tpl.type') + ': ' + (label('type') || none),
      dyn('tpl.budget') + ': ' + (label('budget') || none),
      dyn('tpl.time') + ': ' + (label('time') || none), '',
      dyn('tpl.msg') + ':', msgEl.value.trim(), '',
      dyn('tpl.contact') + ': ' + (contactEl.value.trim() || none)
    ].join('\n');
  }

  const typeChips = $('#err-type').previousElementSibling;
  // неверное поле коротко «встряхивается» (transform), подсветка — в CSS по aria-invalid / .is-invalid
  const shake = (el) => {
    if (reduce || !el.animate) return;
    el.animate([{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.36,.07,.19,.97)' });
  };
  function clearErrors() {
    ['err-type', 'err-msg', 'err-contact'].forEach((id) => { $('#' + id).textContent = ''; });
    msgEl.removeAttribute('aria-invalid'); contactEl.removeAttribute('aria-invalid'); typeChips.classList.remove('is-invalid');
  }
  function validate() {
    clearErrors();
    const bad = [];
    if (!form.elements.type.value) { $('#err-type').textContent = dyn('err.type'); typeChips.classList.add('is-invalid'); bad.push([typeChips, form.querySelector('input[name="type"]')]); }
    if (msgEl.value.trim().length < 10) { $('#err-msg').textContent = dyn('err.msg'); msgEl.setAttribute('aria-invalid', 'true'); bad.push([msgEl, msgEl]); }
    if (viaApi && contactEl.value.trim().length < 3) { $('#err-contact').textContent = dyn('err.contact'); contactEl.setAttribute('aria-invalid', 'true'); bad.push([contactEl, contactEl]); }
    bad.forEach(([el]) => shake(el));
    if (bad.length) bad[0][1].focus();
    return !bad.length;
  }
  $$('input[name="type"]').forEach((r) => r.addEventListener('change', () => { $('#err-type').textContent = ''; typeChips.classList.remove('is-invalid'); }));
  msgEl.addEventListener('input', () => { if (msgEl.value.trim().length >= 10) { $('#err-msg').textContent = ''; msgEl.removeAttribute('aria-invalid'); } });
  contactEl.addEventListener('input', () => { if (contactEl.value.trim().length >= 3) { $('#err-contact').textContent = ''; contactEl.removeAttribute('aria-invalid'); } });

  function renderSent() {
    if (!state) return;
    const k = state.mode === 'fail' ? 'copy' : state.mode;
    $('#sent-t').textContent = dyn('sent.' + k + '.t');
    $('#sent-p').textContent = dyn(state.mode === 'fail' ? 'sent.fail.p' : 'sent.' + k + '.p');
  }
  function showSent(mode, text, url) {
    state = { mode };
    const done = mode === 'ok';
    $('#sent-msg').value = text;
    $('#sent-msg').hidden = done; $('#sent-copy').hidden = done;
    const open = $('#sent-open'); open.hidden = !url; if (url) open.href = url;
    const eb = $('#sent-edit [data-dyn]'); eb.dataset.dyn = done ? 'btn.new' : 'btn.edit'; eb.textContent = dyn(eb.dataset.dyn);
    form.hidden = true; sent.hidden = false;
    renderSent();
    const t = $('#sent-t'); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
    sent.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }

  // состояния кнопки отправки: loading (кольцо) → sent (галочка рисуется); подпись поверх, ширина кнопки не меняется
  const sendBtn = form.querySelector('[type="submit"]');
  sendBtn.insertAdjacentHTML('beforeend', '<span class="btn__state" aria-hidden="true"><i class="spin"></i><svg class="ico"><use href="#i-check"/></svg><span data-dyn="btn.sending"></span></span>');
  const btnState = (s) => {
    const t = $('.btn__state [data-dyn]', sendBtn);
    if (s) { t.dataset.dyn = s === 'sent' ? 'btn.sent' : 'btn.sending'; t.textContent = dyn(t.dataset.dyn); sendBtn.dataset.state = s; } else delete sendBtn.dataset.state;
    form.setAttribute('aria-busy', String(s === 'loading'));
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const text = buildText();
    const btn = sendBtn; btn.disabled = true;
    let mode = 'copy';
    if (viaApi) {
      btnState('loading');
      try {
        // text/plain: «простой» CORS-запрос без preflight; Worker сам разбирает JSON.
        const r = await fetch(SITE.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            lang, type: label('type'), typeCode: form.elements.type.value,
            budget: label('budget'), budgetCode: form.elements.budget.value,
            time: label('time'), timeCode: form.elements.time.value,
            message: msgEl.value.trim(), contact: contactEl.value.trim(),
            hp: form.elements.hp.value, t: Math.round(performance.now())
          })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        mode = 'ok';
      } catch (err) { mode = 'fail'; }
      if (mode === 'ok' && !reduce) { btnState('sent'); await wait(420); } // галочка в кнопке успевает прорисоваться
    }
    const url = tg ? 'https://t.me/' + tg + '?text=' + encodeURIComponent(text) : '';
    if (mode !== 'ok' && tg) mode = 'tg';
    showSent(mode, text, url);
    if (mode === 'tg') window.open(url, '_blank', 'noopener');
    btn.disabled = false; btnState('');
  });

  $('#sent-copy').addEventListener('click', async () => {
    const ta = $('#sent-msg'); const span = $('#sent-copy [data-dyn]');
    try { await navigator.clipboard.writeText(ta.value); } catch (err) { ta.select(); document.execCommand('copy'); }
    span.textContent = dyn('btn.copied');
    setTimeout(() => { span.textContent = dyn('btn.copy'); }, 1800);
  });
  $('#sent-edit').addEventListener('click', () => {
    if (state && state.mode === 'ok') form.reset();
    clearErrors();
    sent.hidden = true; form.hidden = false; msgEl.focus();
    if (!reduce && form.animate) form.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,.9,.3,1)' });
  });

  /* ---------- старт ---------- */
  $('#year').textContent = new Date().getFullYear();
  let saved = ''; try { saved = localStorage.getItem('gb-lang') || ''; } catch (e) { /* private mode */ }
  setLang((new URLSearchParams(location.search).get('lang') || saved) === 'en' ? 'en' : 'ru', false);
  if (window.scrollY > 0) requestAnimationFrame(onScrollFrame); // открыли не с верха (восстановление прокрутки, якорь)
  // аврора — в простое после загрузки, анимации, привязанные к прокрутке, — с первой прокруткой (раньше они не видны):
  // первая отрисовка не ждёт ни больших градиентов, ни таймлайнов
  const lit = () => (window.requestIdleCallback || setTimeout)(() => { hero.classList.add('is-lit'); root.classList.add('grain'); }, { timeout: 2500 });
  if (document.readyState === 'complete') lit(); else addEventListener('load', lit, { once: true });
  addEventListener('scroll', () => root.classList.add('ready'), { once: true, passive: true });
})();
