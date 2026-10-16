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

  /* ---------- i18n: русские оригиналы берём из DOM, английские — из i18n.js ---------- */
  let lang = 'ru';
  const orig = [];
  $$('[data-i18n],[data-i18n-html],[data-i18n-attr]').forEach((el) => {
    const o = { el };
    if (el.hasAttribute('data-i18n')) o.t = el.textContent;
    if (el.hasAttribute('data-i18n-html')) o.h = el.innerHTML;
    if (el.hasAttribute('data-i18n-attr')) {
      o.a = el.getAttribute('data-i18n-attr').split(';').map((p) => {
        const [at, key] = p.split(':');
        return { at, key, ru: el.getAttribute(at) };
      });
    }
    orig.push(o);
  });
  const dyn = (k) => (D.dyn[lang] && D.dyn[lang][k]) || D.dyn.ru[k] || k;
  const pick = (key, fallback) => (lang === 'en' && D.en[key] != null ? D.en[key] : fallback);

  function setLang(next, persist, intro) {
    lang = next === 'en' ? 'en' : 'ru';
    orig.forEach((o) => {
      if ('t' in o) o.el.textContent = pick(o.el.getAttribute('data-i18n'), o.t);
      if ('h' in o) o.el.innerHTML = pick(o.el.getAttribute('data-i18n-html'), o.h);
      if (o.a) o.a.forEach((a) => o.el.setAttribute(a.at, pick(a.key, a.ru)));
    });
    $$('[data-dyn]').forEach((el) => { el.textContent = dyn(el.dataset.dyn); });
    root.lang = lang;
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    if (persist) { try { localStorage.setItem('gb-lang', lang); } catch (e) { /* private mode */ } }
    splitHero(intro);
    rail = null; // высота карточек процесса зависит от языка
    renderSent();
    clearErrors();
  }

  /* ---------- hero: подзаголовок по словам (маска + сдвиг), градиент делится между словами ---------- */
  const sub = $('.hero__sub');
  function splitHero(intro) {
    sub.classList.add('is-ready');
    if (reduce || /<(?!br\b)/i.test(sub.innerHTML)) return; // только текст и <br>
    let i = 0;
    sub.innerHTML = sub.innerHTML.split(/<br\s*\/?>/i).map((line) => line.trim().split(/\s+/)
      .map((w) => '<span class="w"><span class="w__i" style="--wi:' + (i++) + '">' + w + '</span></span>').join(' ')).join('<br>');
    sub.classList.add('is-split');
    sub.classList.toggle('no-intro', !intro);
    paintSub();
  }
  function paintSub() {
    if (!sub.classList.contains('is-split')) return;
    const r = sub.getBoundingClientRect(); const ws = $$('.w__i', sub);
    const xs = ws.map((w) => w.getBoundingClientRect().left);
    ws.forEach((w, i) => { w.style.backgroundSize = r.width + 'px 100%'; w.style.backgroundPosition = (r.left - xs[i]) + 'px 0'; });
  }
  let rsT = 0;
  addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(paintSub, 150); });
  if (document.fonts) document.fonts.ready.then(paintSub);
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, true)));

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
    if (!rail) measureSteps();
    const r = steps.getBoundingClientRect(); const vh = innerHeight;
    if (r.top > vh || r.bottom < 0) return;
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
  if (stage && fine && !reduce) {
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, last = 0;
    const step = (t) => {
      const k = 1 - Math.pow(0.86, Math.max(1, t - last) / 16.7); last = t;
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      stage.style.setProperty('--mx', cx.toFixed(4)); stage.style.setProperty('--my', cy.toFixed(4));
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

  /* ---------- кейсы (native <dialog>) ---------- */
  const lock = (on) => { root.style.overflow = on ? 'hidden' : ''; root.classList.toggle('is-locked', on); };
  $$('[data-case]').forEach((b) => b.addEventListener('click', () => {
    const d = $('#case-' + b.dataset.case);
    if (d && typeof d.showModal === 'function') { d.showModal(); lock(true); }
  }));
  $$('dialog.case').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.addEventListener('close', () => lock(false));
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

  function clearErrors() {
    ['err-type', 'err-msg', 'err-contact'].forEach((id) => { $('#' + id).textContent = ''; });
    msgEl.removeAttribute('aria-invalid'); contactEl.removeAttribute('aria-invalid');
  }
  function validate() {
    clearErrors();
    let first = null;
    if (!form.elements.type.value) { $('#err-type').textContent = dyn('err.type'); first = form.querySelector('input[name="type"]'); }
    if (msgEl.value.trim().length < 10) { $('#err-msg').textContent = dyn('err.msg'); msgEl.setAttribute('aria-invalid', 'true'); first = first || msgEl; }
    if (viaApi && contactEl.value.trim().length < 3) { $('#err-contact').textContent = dyn('err.contact'); contactEl.setAttribute('aria-invalid', 'true'); first = first || contactEl; }
    if (first) first.focus();
    return !first;
  }
  $$('input[name="type"]').forEach((r) => r.addEventListener('change', () => { $('#err-type').textContent = ''; }));
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const text = buildText();
    const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
    let mode = 'copy';
    if (viaApi) {
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
    }
    const url = tg ? 'https://t.me/' + tg + '?text=' + encodeURIComponent(text) : '';
    if (mode !== 'ok' && tg) mode = 'tg';
    showSent(mode, text, url);
    if (mode === 'tg') window.open(url, '_blank', 'noopener');
    btn.disabled = false;
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
  });

  /* ---------- старт ---------- */
  $('#year').textContent = new Date().getFullYear();
  let saved = ''; try { saved = localStorage.getItem('gb-lang') || ''; } catch (e) { /* private mode */ }
  setLang((new URLSearchParams(location.search).get('lang') || saved) === 'en' ? 'en' : 'ru', false, true);
  onScrollFrame();
})();
