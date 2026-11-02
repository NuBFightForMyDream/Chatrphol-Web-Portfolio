/* ==========================================================================
   Portfolio engine
   Reads content.yml → builds the page → adds the animations.
   You normally never need to touch this file — just edit content.yml 🙂
   ========================================================================== */
(() => {
  'use strict';

  const CONTENT_FILE = 'content.yml';

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const $ = (s, el = doc) => el.querySelector(s);
  const $$ = (s, el = doc) => Array.from(el.querySelectorAll(s));
  const mq = (q) => window.matchMedia(q).matches;
  const REDUCED = mq('(prefers-reduced-motion: reduce)');
  const FINE_POINTER = mq('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  /* ------------------------------------------------------------------------
     Helpers: clean up values coming from content.yml
     ------------------------------------------------------------------------ */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = (v) => {
    if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && x !== '');
    if (typeof v === 'string' && v.trim()) return v.split(',').map((x) => x.trim()).filter(Boolean);
    return [];
  };
  const truthy = (v) => v === true || /^(true|yes|y|on|1|ใช่)$/i.test(str(v));

  /** Make links safe, and fix half-typed ones (e.g. instagram.com/me → https://instagram.com/me) */
  const link = (v) => {
    const u = str(v);
    if (!u || u === '#') return '';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // block javascript: and other schemes
    if (/^\/\//.test(u)) return 'https:' + u;
    if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(u)) return 'mailto:' + u;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(u) && !/\.(png|jpe?g|gif|webp|svg|avif|pdf|mp4)$/i.test(u)) return 'https://' + u;
    return u.replace(/^\/+/, ''); // a path inside this site, e.g. images/me.jpg
  };
  const isExternal = (u) => /^https?:/i.test(u);
  const targetAttr = (u) => (isExternal(u) ? ' target="_blank" rel="noopener"' : '');

  /** Multi-paragraph text: a blank line starts a new paragraph */
  const paragraphs = (t) =>
    str(t)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

  /* Split text into characters/words correctly, including Thai (vowels and tone marks stay attached) */
  const hasSeg = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
  const segChar = hasSeg ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const segWord = hasSeg ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const graphemes = (t) => {
    const s = String(t ?? '');
    if (segChar) return Array.from(segChar.segment(s), (x) => x.segment);
    return s.match(/\P{M}\p{M}*/gu) || [];
  };
  const wordsOf = (t) => {
    const s = String(t ?? '');
    if (segWord) return Array.from(segWord.segment(s), (x) => x.segment);
    return s.split(/(\s+)/).filter(Boolean);
  };
  /** Wrap every word in <span class="w"> for the word-by-word animation */
  const splitWords = (t) => {
    let i = 0;
    return wordsOf(t)
      .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="w" style="--i:${i++}">${esc(w)}</span>`))
      .join('');
  };
  const firstGlyph = (t) => {
    const g = graphemes(str(t)).filter((c) => c.trim());
    if (!g.length) return '✦';
    // A lone Thai leading vowel looks odd, so include the next character too
    return /^[เแโใไ]$/.test(g[0]) && g[1] ? g[0] + g[1] : g[0].toUpperCase();
  };
  const hash = (t) => {
    let h = 2166136261;
    for (const c of String(t)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return h >>> 0;
  };
  const youtubeId = (u) => {
    const m = str(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : '';
  };

  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/></svg>',
  };

  /* ------------------------------------------------------------------------
     Load content.yml
     ------------------------------------------------------------------------ */
  async function loadContent() {
    if (location.protocol === 'file:') {
      const err = new Error('file-protocol');
      err.kind = 'file';
      throw err;
    }
    let res;
    try {
      res = await fetch(`${CONTENT_FILE}?v=${Date.now()}`, { cache: 'no-store' });
    } catch (e) {
      e.kind = 'network';
      throw e;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.kind = 'missing';
      throw err;
    }
    const text = await res.text();
    if (!window.jsyaml) {
      const err = new Error('js-yaml not loaded');
      err.kind = 'lib';
      throw err;
    }
    try {
      return obj(window.jsyaml.load(text));
    } catch (e) {
      e.kind = 'yaml';
      throw e;
    }
  }

  function showError(err) {
    let title = 'Could not load the content';
    let html = '';
    if (err.kind === 'yaml') {
      const line = err.mark ? err.mark.line + 1 : null;
      title = line ? `There’s a typo in content.yml near line ${line}` : 'There’s a typo in content.yml';
      html = `
        <p>No worries — it’s just a small formatting slip. Check that line for:</p>
        <ul>
          <li>Indentation (spaces at the start of the line) that matches the other lines in the same group — use spaces, never Tab</li>
          <li>Text that contains <code>:</code> or <code>#</code> must be wrapped in quotes <code>"..."</code></li>
          <li>A missing <code>:</code> after a field name, or <code>-</code> before a list item</li>
        </ul>
        <p class="load-error__th">ภาษาไทย: content.yml พิมพ์ผิดแถวบรรทัด${line ? ` ${line}` : ''} — เช็กการเว้นวรรค (ห้ามใช้ Tab) และข้อความที่มี : หรือ # ให้ครอบด้วย "..."</p>
        ${err.mark && err.mark.snippet ? `<pre>${esc(err.mark.snippet)}</pre>` : `<pre>${esc(err.message)}</pre>`}`;
    } else if (err.kind === 'file') {
      title = 'index.html can’t be opened directly from your computer';
      html = `
        <p>Browsers block reading content.yml from a local file. View the site in one of these ways instead:</p>
        <ul>
          <li>On GitHub Pages (setup steps are in README.md)</li>
          <li>With VS Code and the <code>Live Server</code> extension</li>
          <li>Or run <code>python3 -m http.server</code> in this folder and open <code>http://localhost:8000</code></li>
        </ul>`;
    } else if (err.kind === 'missing') {
      title = 'content.yml was not found';
      html = `<p>Make sure <code>content.yml</code> sits in the same folder as <code>index.html</code> and the name is spelled exactly like that.</p><pre>${esc(err.message)}</pre>`;
    } else {
      html = `<p>Try refreshing the page. If it still fails, check that every file in the <code>assets/</code> folder is there.</p><pre>${esc(err.message || err)}</pre>`;
    }
    const box = doc.createElement('div');
    box.className = 'load-error';
    box.innerHTML = `<div class="load-error__card" role="alert"><div class="load-error__icon">!</div><h1>${esc(title)}</h1>${html}</div>`;
    body.appendChild(box);
    console.error('[portfolio]', err);
  }

  /* ------------------------------------------------------------------------
     Theme + meta
     ------------------------------------------------------------------------ */
  function applyTheme(theme, profile) {
    const t = obj(theme);
    const valid = (c) => c && window.CSS && CSS.supports('color', c);
    if (valid(str(t.accent))) root.style.setProperty('--accent', str(t.accent));
    if (valid(str(t.accent2))) root.style.setProperty('--accent-2', str(t.accent2));

    const name = str(profile.name);
    const role = arr(profile.roles)[0];
    if (name) doc.title = role ? `${name} — ${str(role)}` : name;
    const intro = str(profile.intro);
    if (intro) $('meta[name="description"]').setAttribute('content', intro.slice(0, 160));

    // favicon in the theme colors
    const cs = getComputedStyle(root);
    const a = cs.getPropertyValue('--accent').trim() || '#8b5cf6';
    const b = cs.getPropertyValue('--accent-2').trim() || '#22d3ee';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(a)}"/><stop offset="1" stop-color="${esc(b)}"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><text x="32" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="32" fill="#07070b">${esc(firstGlyph(name || 'P'))}</text></svg>`;
    $('#favicon').setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg));
  }

  /* ------------------------------------------------------------------------
     Render: each section of the page
     ------------------------------------------------------------------------ */
  function socialsHTML(list, cls = '') {
    const items = arr(list)
      .map(obj)
      .map((s) => ({ name: str(s.name), url: link(s.url) }))
      .filter((s) => s.name && s.url);
    if (!items.length) return '';
    return `<div class="socials ${cls}">${items
      .map((s) => `<a class="social" href="${esc(s.url)}"${targetAttr(s.url)}>${esc(s.name)} ${ICON.out}</a>`)
      .join('')}</div>`;
  }

  function sectionHead(num, label, title, subtitle) {
    return `
      <div class="sec-head">
        <div class="eyebrow reveal"><span class="eyebrow__num">${String(num).padStart(2, '0')}</span><span class="eyebrow__line"></span><span>${esc(label)}</span></div>
        ${title ? `<h2 class="sec-title split">${splitWords(title)}</h2>` : ''}
        ${subtitle ? `<p class="sec-sub reveal" style="--d:2">${esc(subtitle)}</p>` : ''}
      </div>`;
  }

  // Hues for auto-generated covers (picked to suit the dark theme)
  const COVER_HUES = [258, 272, 290, 318, 340, 12, 28, 190, 205, 222, 168];
  function coverHTML(title, seed) {
    const h = hash(seed || title);
    const n = COVER_HUES.length;
    const i1 = h % n;
    const i2 = (i1 + 2 + ((h >>> 8) % (n - 3))) % n;
    const i3 = (i1 + 5 + ((h >>> 16) % 3)) % n;
    const [h1, h2, h3] = [COVER_HUES[i1], COVER_HUES[i2], COVER_HUES[i3]];
    return `<div class="cover" style="--h1:${h1};--h2:${h2};--h3:${h3}" aria-hidden="true"><span class="cover__text">${esc(firstGlyph(title))}</span></div>`;
  }

  function mediaHTML(p) {
    const img = link(p.image);
    return img
      ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" decoding="async" data-fallback>${coverHTML(p.title, p.title + p.year)}`
      : coverHTML(p.title, p.title + p.year);
  }

  function renderHero(profile, skills) {
    const p = profile;
    const name = str(p.name) || 'Your Name';
    const chars = graphemes(name);
    const n = Math.max(1, chars.filter((c) => c.trim()).length - 1);
    let k = 0;
    const nameHTML = chars
      .map((c, i) =>
        c.trim()
          ? `<span class="char" style="--i:${i};--t:${(k++ / n).toFixed(3)}">${esc(c)}</span>`
          : '<span class="char char--space"> </span>'
      )
      .join('');
    const roles = arr(p.roles).map(str).filter(Boolean);
    const photo = link(p.photo);
    const chips = arr(obj(skills).items).map(str).filter(Boolean).slice(0, 4);
    const greeting = str(p.greeting);
    const intro = str(p.intro);
    const contactLabel = L('contact_me', 'Get in touch');
    const workLabel = state.data.__hasWork ? L('view_work', 'View my work') : '';

    return `
<section class="hero" id="top">
  <div class="container hero__grid">
    <div class="hero__content">
      ${truthy(p.available) ? `<div class="badge intro" style="--d:0"><span class="pulse"></span>${esc(str(p.available_text) || 'Available for work')}</div>` : ''}
      ${greeting ? `<p class="hero__greet intro" style="--d:1">${esc(greeting)}</p>` : ''}
      <h1 class="hero__name" id="hero-name" aria-label="${esc(name)}"><span aria-hidden="true">${nameHTML}</span></h1>
      ${roles.length ? `<p class="hero__role intro" style="--d:4">${p.role_prefix ? `<span>${esc(str(p.role_prefix))}</span> ` : ''}<span class="typed" id="typed">${esc(roles[0])}</span><span class="caret" aria-hidden="true"></span></p>` : ''}
      ${intro ? `<p class="hero__intro intro" style="--d:5">${esc(intro)}</p>` : ''}
      <div class="hero__actions intro" style="--d:6">
        ${workLabel ? `<a href="#work" class="btn btn--primary magnetic">${esc(workLabel)} ${ICON.arrow}</a>` : ''}
        <a href="#contact" class="btn btn--ghost magnetic">${esc(contactLabel)}</a>
      </div>
      <div class="intro" style="--d:7">${socialsHTML(state.data.socials)}</div>
    </div>
    <div class="hero__visual intro" style="--d:3">
      <div class="orb">
        <div class="orb__orbit"></div>
        <div class="orb__ring"></div>
        <div class="orb__core">${photo ? `<img src="${esc(photo)}" alt="${esc(name)}">` : `<span class="orb__initial">${esc(firstGlyph(name))}</span>`}</div>
        ${chips.map((c, i) => `<span class="orb__chip" style="--i:${i}">${esc(c)}</span>`).join('')}
      </div>
    </div>
  </div>
  <a href="#${state.firstSection || 'contact'}" class="scroll-hint" aria-label="Scroll down"><span></span></a>
</section>
${roles.length ? renderTicker(roles) : ''}`;
  }

  function renderTicker(roles) {
    const row = (list) => {
      let out = '';
      for (let r = 0; r < 4; r++) {
        list.forEach((t, i) => {
          out += `<span class="ticker__item${(i + r) % 2 ? ' ticker__item--fill' : ''}">${esc(t)}</span><span class="ticker__star">✦</span>`;
        });
      }
      return out;
    };
    return `
<div class="ticker" id="ticker" aria-hidden="true">
  <div class="ticker__row">${row(roles)}</div>
  <div class="ticker__row ticker__row--rev">${row(roles.slice().reverse())}</div>
</div>`;
  }

  function renderAbout(a, num, profile) {
    const text = paragraphs(a.text);
    const stats = arr(a.stats)
      .map(obj)
      .filter((s) => str(s.number) || str(s.label));
    if (!text && !stats.length) return '';
    const loc = str(profile.location);
    const email = str(profile.email);
    const statHTML = stats
      .map((s, i) => {
        const raw = str(s.number);
        const m = raw.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
        const suffix = esc((m ? m[3] : '') + str(s.suffix));
        const inner = m
          ? `${esc(m[1])}<span data-count="${m[2]}">0</span>${suffix}`
          : `${esc(raw)}${suffix}`;
        return `<div class="stat reveal" style="--d:${i}"><div class="stat__num">${inner}</div><div class="stat__label">${esc(s.label)}</div></div>`;
      })
      .join('');
    return `
<section class="section about" id="about" data-label="${esc(a.__label)}">
  <div class="container">
    ${sectionHead(num, a.__label, str(a.title), str(a.subtitle))}
    <div class="about__grid">
      <div>
        <div class="about__text reveal">${text}</div>
        ${loc || email ? `<div class="about__meta reveal" style="--d:1">${loc ? `<span>${ICON.pin}${esc(loc)}</span>` : ''}${email ? `<span>${ICON.mail}${esc(email)}</span>` : ''}</div>` : ''}
      </div>
      ${stats.length ? `<div class="stats">${statHTML}</div>` : ''}
    </div>
  </div>
</section>`;
  }

  function renderSkills(s, num) {
    const items = arr(s.items).map(str).filter(Boolean);
    if (!items.length) return '';
    const fill = (list) => {
      let out = list.slice();
      while (out.length < 10) out = out.concat(list);
      return out;
    };
    const row = (list, rev) => {
      const pills = fill(list).map((x) => `<span class="pill"><i></i>${esc(x)}</span>`).join('');
      return `<div class="marquee${rev ? ' marquee--rev' : ''}" style="--dur:${Math.max(28, fill(list).length * 3.4)}s"><div class="marquee__track">${pills}<span style="display:contents" aria-hidden="true">${pills}</span></div></div>`;
    };
    const half = Math.ceil(items.length / 2);
    const rows = items.length >= 6 ? row(items.slice(0, half)) + row(items.slice(half), true) : row(items);
    return `
<section class="section skills" id="skills">
  <div class="container">${sectionHead(num, s.__label, str(s.title), str(s.subtitle))}</div>
  <div class="reveal">${rows}</div>
</section>`;
  }

  function normalizeProjects(list) {
    return arr(list)
      .map(obj)
      .map((p) => ({
        title: str(p.title),
        category: str(p.category),
        year: str(p.year),
        description: str(p.description),
        details: str(p.details),
        image: str(p.image),
        gallery: arr(p.gallery).map(link).filter(Boolean),
        video: str(p.video),
        link: link(p.link),
        link_text: str(p.link_text),
        tags: arr(p.tags).map(str).filter(Boolean),
        featured: truthy(p.featured),
      }))
      .filter((p) => p.title);
  }

  function renderProjects(pr, num) {
    const items = state.projects;
    if (!items.length) return '';
    const cats = [...new Set(items.map((p) => p.category).filter(Boolean))];
    const allLabel = L('all', 'All');
    const filters =
      cats.length > 1
        ? `<div class="filters reveal" role="group" aria-label="Filter projects">
            <button class="chip is-active" type="button" data-filter="*">${esc(allLabel)}<sup>${items.length}</sup></button>
            ${cats
              .map((c) => `<button class="chip" type="button" data-filter="${esc(c)}">${esc(c)}<sup>${items.filter((p) => p.category === c).length}</sup></button>`)
              .join('')}
          </div>`
        : '';
    const cards = items
      .map(
        (p, i) => `
      <article class="card reveal${p.featured ? ' card--wide' : ''}" style="--d:${i % 3}" data-cat="${esc(p.category)}">
        <div class="card__inner" tabindex="0" role="button" data-open="${i}" data-cursor="${esc(L('open_project', 'View'))}" aria-label="${esc(p.title)}">
          <div class="card__media">
            ${mediaHTML(p)}
            ${p.featured ? `<span class="card__badge">${esc(L('featured', 'Featured'))}</span>` : ''}
            <span class="card__arrow">${ICON.out}</span>
          </div>
          <div class="card__body">
            <div class="card__meta"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div>
            <h3 class="card__title">${esc(p.title)}</h3>
            ${p.description ? `<p class="card__desc">${esc(p.description)}</p>` : ''}
            ${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </article>`
      )
      .join('');
    return `
<section class="section work" id="work">
  <div class="container">
    ${sectionHead(num, pr.__label, str(pr.title), str(pr.subtitle))}
    ${filters}
    <div class="grid" id="grid">${cards}</div>
  </div>
</section>`;
  }

  function renderExperience(e, num) {
    const items = arr(e.items)
      .map(obj)
      .filter((x) => str(x.title) || str(x.period));
    if (!items.length) return '';
    return `
<section class="section experience" id="experience">
  <div class="container">
    ${sectionHead(num, e.__label, str(e.title), str(e.subtitle))}
    <div class="timeline" id="timeline">
      <div class="timeline__line"></div>
      ${items
        .map(
          (x, i) => `
        <div class="tl reveal" style="--d:${Math.min(i, 2)}">
          <div class="tl__card">
            ${str(x.period) ? `<div class="tl__period">${esc(x.period)}</div>` : ''}
            ${str(x.title) ? `<h3 class="tl__title">${esc(x.title)}</h3>` : ''}
            ${str(x.place) ? `<div class="tl__place">${esc(x.place)}</div>` : ''}
            ${str(x.detail) ? `<div class="tl__detail">${paragraphs(x.detail)}</div>` : ''}
          </div>
        </div>`
        )
        .join('')}
    </div>
  </div>
</section>`;
  }

  function renderContact(c, num, profile) {
    const email = str(profile.email);
    const mail = email ? link(email) : '';
    const resume = link(profile.resume);
    return `
<section class="section contact" id="contact">
  <div class="container contact__inner">
    <div class="eyebrow reveal"><span class="eyebrow__num">${String(num).padStart(2, '0')}</span><span class="eyebrow__line"></span><span>${esc(c.__label)}</span></div>
    <h2 class="contact__title split">${splitWords(str(c.title) || 'Let’s talk')}</h2>
    ${str(c.text) ? `<p class="contact__text reveal" style="--d:1">${esc(c.text)}</p>` : ''}
    ${email ? `<a class="contact__email reveal magnetic" style="--d:2" href="${esc(mail)}">${esc(email)}</a>` : ''}
    <div class="contact__actions reveal" style="--d:3">
      ${email ? `<a class="btn btn--primary magnetic" href="${esc(mail)}">${esc(L('send_email', 'Send me an email'))} ${ICON.arrow}</a>` : ''}
      ${resume ? `<a class="btn btn--ghost magnetic" href="${esc(resume)}"${targetAttr(resume)} download>${ICON.file} ${esc(L('download_resume', 'Download resume'))}</a>` : ''}
    </div>
    <div class="reveal" style="--d:4">${socialsHTML(state.data.socials)}</div>
  </div>
</section>`;
  }

  function renderNav(profile, sections) {
    const name = str(profile.name) || 'Portfolio';
    const links = sections.map((s) => `<a class="nav__link" href="#${s.id}" data-nav="${s.id}">${esc(s.label)}</a>`).join('');
    $('#nav').innerHTML = `
      <div class="container nav__inner">
        <a href="#top" class="nav__logo magnetic" aria-label="Back to top"><span class="nav__mark">${esc(firstGlyph(name))}</span><span>${esc(name)}</span></a>
        <nav class="nav__links" aria-label="Main menu"><span class="nav__pill" id="nav-pill"></span>${links}</nav>
        ${str(profile.email) ? `<a class="nav__cta magnetic" href="#contact">${esc(L('nav_button', 'Let’s talk'))}</a>` : ''}
        <button class="nav__burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
      </div>`;
    $('#menu').innerHTML = sections
      .map((s, i) => `<a class="menu__link" href="#${s.id}" style="--i:${i}"><small>${String(i + 1).padStart(2, '0')}</small>${esc(s.label)}</a>`)
      .join('');
  }

  function renderFooter(f, profile) {
    const name = str(profile.name);
    $('#footer').innerHTML = `
      <div class="container footer__inner">
        <span>© ${new Date().getFullYear()} ${esc(name)}${str(f.text) ? ` · ${esc(f.text)}` : ''}</span>
        <a href="#top" class="to-top">${ICON.up} ${esc(L('back_to_top', 'Back to top'))}</a>
      </div>`;
  }

  const state = { data: {}, projects: [], firstSection: '' };

  /** Small UI text (buttons, badges…) from the `labels:` section of content.yml */
  const L = (key, fallback) => str(obj(state.data.labels)[key]) || fallback;

  /** Thai text in small spaced-out labels → turn off letter-spacing */
  function markThai(scope) {
    $$('.eyebrow span, .card__meta span, .tl__period, .chip', scope).forEach((el) => {
      if (/[\u0E00-\u0E7F]/.test(el.textContent)) el.classList.add('th');
    });
  }

  function render(data) {
    state.data = data;
    const profile = obj(data.profile);
    const about = obj(data.about);
    const skills = obj(data.skills);
    const projects = obj(data.projects);
    const experience = obj(data.experience);
    const contact = obj(data.contact);
    state.projects = normalizeProjects(projects.items);
    data.__hasWork = state.projects.length > 0;

    applyTheme(data.theme, profile);

    // Section order + default menu names
    const defs = [
      { id: 'about', d: about, label: 'About', fn: (n) => renderAbout(about, n, profile) },
      { id: 'skills', d: skills, label: 'Skills', fn: (n) => renderSkills(skills, n) },
      { id: 'work', d: projects, label: 'Work', fn: (n) => renderProjects(projects, n) },
      { id: 'experience', d: experience, label: 'Experience', fn: (n) => renderExperience(experience, n) },
      { id: 'contact', d: contact, label: 'Contact', fn: (n) => renderContact(contact, n, profile) },
    ];
    let html = '';
    let num = 0;
    const shown = [];
    defs.forEach((s) => {
      s.d.__label = str(s.d.menu) || s.label;
      const out = s.fn(num + 1);
      if (out) {
        num++;
        html += out;
        shown.push({ id: s.id, label: s.d.__label });
      }
    });
    state.firstSection = shown[0] ? shown[0].id : '';

    $('#app').innerHTML = renderHero(profile, skills) + html;
    renderNav(profile, shown);
    renderFooter(obj(data.footer), profile);

    markThai(doc);

    // Broken image → fall back to the generated cover
    $$('img[data-fallback]').forEach((img) => {
      const fail = () => img.remove();
      if (img.complete && img.naturalWidth === 0) fail();
      else img.addEventListener('error', fail, { once: true });
    });
    $$('.card__media img').forEach((img) => {
      img.addEventListener('load', () => {
        const cover = img.nextElementSibling;
        if (cover && cover.classList.contains('cover')) cover.remove();
      }, { once: true });
      if (img.complete && img.naturalWidth > 0) {
        const cover = img.nextElementSibling;
        if (cover && cover.classList.contains('cover')) cover.remove();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Animations & interactions
     ------------------------------------------------------------------------ */

  /** Make the name as big as fits, so long names never overflow */
  function fitName() {
    const el = $('#hero-name');
    if (!el) return;
    el.style.removeProperty('--name-size');
    const parent = el.parentElement;
    const max = parent.clientWidth;
    const w = el.scrollWidth;
    if (w > max && max > 0) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      el.style.setProperty('--name-size', `${Math.floor(size * (max / w) * 0.98)}px`);
    }
  }

  function initTyped() {
    const el = $('#typed');
    const roles = arr(obj(state.data.profile).roles).map(str).filter(Boolean);
    if (!el || roles.length < 2 || REDUCED) return;
    let r = 0;
    let i = graphemes(roles[0]).length;
    let deleting = false;
    const tick = () => {
      const g = graphemes(roles[r]);
      if (!deleting) {
        i++;
        el.textContent = g.slice(0, i).join('');
        if (i >= g.length) {
          deleting = true;
          return setTimeout(tick, 2000);
        }
        return setTimeout(tick, 65 + Math.random() * 70);
      }
      i--;
      el.textContent = g.slice(0, Math.max(0, i)).join('');
      if (i <= 0) {
        deleting = false;
        r = (r + 1) % roles.length;
        return setTimeout(tick, 380);
      }
      return setTimeout(tick, 32);
    };
    // The first role is already shown → wait, then start deleting
    deleting = true;
    setTimeout(tick, 2600);
  }

  function initReveal() {
    const els = $$('.reveal, .split');
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    els.forEach((e) => io.observe(e));
  }

  function initCounters() {
    const els = $$('[data-count]');
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      if (REDUCED) {
        el.textContent = target.toFixed(decimals);
        return;
      }
      const dur = 1800;
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
        el.textContent = (target * e).toFixed(decimals);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) return els.forEach(run);
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            run(en.target);
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.6 }
    );
    els.forEach((e) => io.observe(e));
  }

  /** Everything driven by scroll: progress bar, nav, hero, ticker, timeline */
  function initScroll() {
    const nav = $('#nav');
    const progress = $('#progress');
    const hero = $('.hero__content');
    const ticker = $('#ticker');
    const timeline = $('#timeline');
    const tls = timeline ? $$('.tl', timeline) : [];
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = Math.max(1, doc.documentElement.scrollHeight - vh);
      progress.style.setProperty('--scroll', (y / max).toFixed(4));

      nav.classList.toggle('is-scrolled', y > 20);
      if (!body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;

      if (REDUCED) return;

      if (hero && y < vh * 1.2) {
        const p = clamp(y / vh, 0, 1);
        hero.style.setProperty('--hero-y', `${(p * 120).toFixed(1)}px`);
        hero.style.setProperty('--hero-o', (1 - p * 1.1).toFixed(3));
      }
      if (ticker) {
        const r = ticker.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) ticker.style.setProperty('--tk', ((vh - r.top) * 0.45).toFixed(1));
      }
      if (timeline) {
        const r = timeline.getBoundingClientRect();
        const line = vh * 0.65;
        timeline.style.setProperty('--p', clamp((line - r.top) / r.height, 0, 1).toFixed(4));
        tls.forEach((el) => el.classList.toggle('is-active', el.getBoundingClientRect().top + 30 < line));
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /** Highlight the menu item for the section in view, with a sliding pill */
  function initActiveNav() {
    const pill = $('#nav-pill');
    const links = $$('.nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const setActive = (id) => {
      let on = null;
      links.forEach((a) => {
        const active = a.dataset.nav === id;
        a.classList.toggle('is-active', active);
        if (active) on = a;
      });
      if (pill) {
        if (on) {
          pill.style.left = `${on.offsetLeft}px`;
          pill.style.width = `${on.offsetWidth}px`;
          pill.classList.add('is-on');
        } else pill.classList.remove('is-on');
      }
    };
    const sections = links.map((a) => doc.getElementById(a.dataset.nav)).filter(Boolean);
    const visible = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => visible.set(en.target.id, en.isIntersecting));
        const current = sections.find((s) => visible.get(s.id));
        setActive(current ? current.id : '');
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => io.observe(s));
    window.addEventListener('resize', () => {
      const a = $('.nav__link.is-active');
      if (a && pill) {
        pill.style.left = `${a.offsetLeft}px`;
        pill.style.width = `${a.offsetWidth}px`;
      }
    });
  }

  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger) return;
    const set = (open) => {
      body.classList.toggle('menu-open', open);
      body.classList.toggle('is-locked', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      if (open) $('#nav').classList.remove('is-hidden');
    };
    burger.addEventListener('click', () => set(!body.classList.contains('menu-open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) set(false);
    });
  }

  /** Pointer: custom cursor, background parallax, magnetic buttons, 3D card tilt */
  function initPointer() {
    if (!FINE_POINTER || REDUCED) return;
    body.classList.add('has-cursor');
    const cursor = $('#cursor');
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = $('#cursor-label');
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let seen = false;
    cursor.classList.add('is-hidden');

    window.addEventListener(
      'pointermove',
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!seen) {
          seen = true;
          rx = mx;
          ry = my;
          cursor.classList.remove('is-hidden');
        }
        root.style.setProperty('--px', ((mx / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty('--py', ((my / window.innerHeight) * 2 - 1).toFixed(3));
      },
      { passive: true }
    );
    doc.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    doc.addEventListener('pointerenter', () => seen && cursor.classList.remove('is-hidden'));

    const loop = () => {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // hover states
    doc.addEventListener('pointerover', (e) => {
      const view = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, [role="button"], .pill, .chip');
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-hover', !view && !!hover);
      if (view) label.textContent = view.dataset.cursor;
    });

    // magnetic
    $$('.magnetic').forEach((el) => {
      const strength = el.classList.contains('contact__email') ? 0.15 : 0.32;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transition = 'transform .2s ease-out';
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.34,1.56,.64,1)';
        el.style.transform = '';
      });
    });

    // card tilt + spotlight
    $$('.card').forEach((card) => {
      const inner = $('.card__inner', card);
      inner.addEventListener('pointermove', (e) => {
        const r = inner.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        inner.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        inner.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        inner.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
        inner.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`);
      });
      inner.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        inner.style.setProperty('--rx', '0deg');
        inner.style.setProperty('--ry', '0deg');
      });
    });
  }

  /** Twinkling background stars + lines that connect to the mouse */
  function initStars() {
    const canvas = $('#stars');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let stars = [];
    const mouse = { x: -9999, y: -9999 };
    const accent = () => getComputedStyle(root).getPropertyValue('--accent-2').trim() || '#22d3ee';
    let color = accent();

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.round((w * h) / 14000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        tw: Math.random() * Math.PI * 2,
        ts: 0.01 + Math.random() * 0.025,
      }));
      if (REDUCED) draw(false);
    };

    const draw = (move = true) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (move) {
          s.x += s.vx;
          s.y += s.vy;
          s.tw += s.ts;
          if (s.x < -5) s.x = w + 5;
          if (s.x > w + 5) s.x = -5;
          if (s.y < -5) s.y = h + 5;
          if (s.y > h + 5) s.y = -5;
        }
        const a = 0.25 + (Math.sin(s.tw) + 1) * 0.3;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // lines around the mouse
      const R = 150;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = color;
      const near = stars.filter((s) => Math.abs(s.x - mouse.x) < R && Math.abs(s.y - mouse.y) < R);
      for (let i = 0; i < near.length; i++) {
        const a = near[i];
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm > R) continue;
        ctx.globalAlpha = (1 - dm / R) * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
        for (let j = i + 1; j < near.length; j++) {
          const b = near[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) {
            ctx.globalAlpha = (1 - d / 90) * (1 - dm / R) * 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    let running = !REDUCED;
    const loop = () => {
      if (running) draw(true);
      requestAnimationFrame(loop);
    };
    resize();
    window.addEventListener('resize', resize);
    if (FINE_POINTER) {
      window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    }
    doc.addEventListener('visibilitychange', () => { running = !doc.hidden && !REDUCED; });
    if (!REDUCED) requestAnimationFrame(loop);
    // pick up the theme color once it has been applied
    setTimeout(() => { color = accent(); }, 100);
  }

  /** Project filter buttons */
  function initFilters() {
    const chips = $$('[data-filter]');
    const cards = $$('#grid .card');
    if (!chips.length) return;
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        chips.forEach((c) => c.classList.toggle('is-active', c === chip));
        let k = 0;
        cards.forEach((card) => {
          const match = f === '*' || card.dataset.cat === f;
          const wasHidden = card.classList.contains('is-filtered');
          card.classList.toggle('is-filtered', !match);
          if (match && wasHidden && !REDUCED && card.animate) {
            card.animate(
              [
                { opacity: 0, transform: 'translateY(30px) scale(.96)', filter: 'blur(6px)' },
                { opacity: 1, transform: 'none', filter: 'blur(0)' },
              ],
              { duration: 650, delay: k++ * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
            );
          } else if (match && !REDUCED && card.animate) {
            card.animate([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
          }
        });
      })
    );
  }

  /** Project detail modal */
  function initModal() {
    const modal = $('#modal');
    const content = $('#modal-content');
    const dialog = $('.modal__dialog', modal);
    let lastFocus = null;

    const open = (i) => {
      const p = state.projects[i];
      if (!p) return;
      lastFocus = doc.activeElement;
      const yt = youtubeId(p.video);
      const videoLink = !yt ? link(p.video) : '';
      content.innerHTML = `
        <div class="modal__media">${mediaHTML(p)}</div>
        <div class="modal__body">
          <div class="card__meta"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div>
          <h2 class="modal__title" id="modal-title">${esc(p.title)}</h2>
          <div class="modal__text">${paragraphs(p.details || p.description)}</div>
          ${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${yt ? `<div class="modal__video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="${esc(p.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ''}
          ${p.gallery.length ? `<div class="modal__gallery">${p.gallery.map((g) => `<img src="${esc(g)}" alt="${esc(p.title)}" loading="lazy">`).join('')}</div>` : ''}
          ${p.link || videoLink ? `<div class="modal__actions">
              ${p.link ? `<a class="btn btn--primary" href="${esc(p.link)}"${targetAttr(p.link)}>${esc(p.link_text || L('visit_project', 'View live project'))} ${ICON.arrow}</a>` : ''}
              ${videoLink ? `<a class="btn btn--ghost" href="${esc(videoLink)}"${targetAttr(videoLink)}>${esc(L('watch_video', 'Watch video'))} ${ICON.out}</a>` : ''}
            </div>` : ''}
        </div>`;
      $$('img[data-fallback]', content).forEach((img) => {
        img.addEventListener('load', () => img.nextElementSibling && img.nextElementSibling.remove(), { once: true });
        img.addEventListener('error', () => img.remove(), { once: true });
      });
      markThai(content);
      content.scrollTop = 0;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      body.classList.add('is-locked');
      setTimeout(() => $('.modal__close', modal).focus({ preventScroll: true }), 50);
    };
    const close = () => {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      body.classList.remove('is-locked');
      setTimeout(() => {
        if (!modal.classList.contains('is-open')) content.innerHTML = ''; // stops any playing video
      }, 500);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };

    doc.addEventListener('click', (e) => {
      const card = e.target.closest('[data-open]');
      if (card) open(+card.dataset.open);
      if (e.target.closest('[data-close]')) close();
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-open]')) {
        e.preventDefault();
        open(+e.target.dataset.open);
      }
      if (e.key === 'Tab' && modal.classList.contains('is-open')) {
        const f = $$('a[href], button, iframe, [tabindex]:not([tabindex="-1"])', dialog);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ------------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------------ */
  function createPreloader() {
    const el = $('#preloader');
    let show = !REDUCED;
    try {
      if (sessionStorage.getItem('pf-intro')) show = false;
      sessionStorage.setItem('pf-intro', '1');
    } catch (e) { /* private mode: just show it */ }
    if (!show) {
      el.remove();
      return { setName() {}, async finish() {}, fail() {} };
    }
    const bar = $('#preloader-bar');
    const count = $('#preloader-count');
    let target = 70;
    let value = 0;
    let done = false;
    const tick = () => {
      value = lerp(value, target, target === 100 ? 0.2 : 0.06);
      if (target === 100 && value > 99.5) value = 100;
      bar.style.setProperty('--p', (value / 100).toFixed(3));
      count.textContent = String(Math.round(value)).padStart(3, '0');
      if (!done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const started = performance.now();
    return {
      setName(name) {
        $('#preloader-name').innerHTML = graphemes(name)
          .map((c, i) => (c.trim() ? `<span class="char" style="--i:${i}">${esc(c)}</span>` : ' '))
          .join('');
      },
      async finish() {
        const elapsed = performance.now() - started;
        if (elapsed < 900) await wait(900 - elapsed);
        target = 100;
        await wait(450);
        done = true;
        el.classList.add('is-done');
        await wait(450);
        setTimeout(() => el.remove(), 900);
      },
      fail() {
        done = true;
        el.remove();
      },
    };
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  async function boot() {
    const pre = createPreloader();
    let data;
    try {
      data = await loadContent();
    } catch (err) {
      pre.fail();
      body.classList.remove('is-loading');
      showError(err);
      return;
    }

    pre.setName(str(obj(data.profile).name));
    render(data);

    // Wait for fonts (max 1.5s) so the name is measured correctly
    if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, wait(1500)]);
    fitName();
    window.addEventListener('resize', fitName);

    initReveal();
    initCounters();
    initScroll();
    initActiveNav();
    initMenu();
    initPointer();
    initStars();
    initFilters();
    initModal();

    await pre.finish();
    body.classList.remove('is-loading');
    await nextFrame();
    body.classList.add('is-ready');
    initTyped();
    setTimeout(() => $('.hero') && $('.hero').classList.add('hero--done'), 2200);

    // If the URL has #work etc., jump there once the page is built
    if (location.hash.length > 1) {
      const target = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  boot();
})();
