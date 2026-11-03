/* ==========================================================================
   Portfolio engine
   Reads content.yml → builds the page (a show in scenes) → hands it to
   scrollcraft (assets/vendor) for the scroll staging.
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
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
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

  /* Split text into characters correctly, including Thai (vowels and tone marks stay attached) */
  const hasSeg = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
  const segChar = hasSeg ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const graphemes = (t) => {
    const s = String(t ?? '');
    if (segChar) return Array.from(segChar.segment(s), (x) => x.segment);
    return s.match(/\P{M}\p{M}*/gu) || [];
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

  // Logos for the social buttons — picked by name (e.g. "GitHub") or by the link's domain
  const lineIcon = (paths) =>
    `<svg class="social__logo" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const SOCIAL_ICONS = [
    { keys: ['github'], hosts: ['github.com'], svg: lineIcon('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>') },
    { keys: ['instagram', 'ig'], hosts: ['instagram.com'], svg: lineIcon('<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/>') },
    { keys: ['linkedin'], hosts: ['linkedin.com'], svg: lineIcon('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>') },
    { keys: ['facebook', 'fb'], hosts: ['facebook.com', 'fb.com'], svg: lineIcon('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>') },
    { keys: ['x', 'twitter'], hosts: ['x.com', 'twitter.com'], svg: lineIcon('<path d="M4 4l11.7 16H20L8.3 4H4zM4 20l6.8-7.2M20 4l-6.8 7.2"/>') },
    { keys: ['youtube'], hosts: ['youtube.com', 'youtu.be'], svg: lineIcon('<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z"/>') },
    { keys: ['tiktok'], hosts: ['tiktok.com'], svg: lineIcon('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 5"/>') },
    { keys: ['dribbble'], hosts: ['dribbble.com'], svg: lineIcon('<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>') },
  ];
  const WEB_ICON = lineIcon('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>');
  const MAIL_ICON = lineIcon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>');
  function socialIcon(name, url) {
    if (/^mailto:/i.test(url)) return MAIL_ICON;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    let host = '';
    try { host = new URL(url, location.href).hostname.replace(/^www\./, ''); } catch (e) { /* not a full URL */ }
    const hit = SOCIAL_ICONS.find((s) => s.keys.includes(key) || s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
    return hit ? hit.svg : WEB_ICON;
  }

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
        <p>No worries, it’s just a small formatting slip. Check that line for:</p>
        <ul>
          <li>Indentation (spaces at the start of the line) that matches the other lines in the same group (use spaces, never Tab)</li>
          <li>Text that contains <code>:</code> or <code>#</code> must be wrapped in quotes <code>"..."</code></li>
          <li>A missing <code>:</code> after a field name, or <code>-</code> before a list item</li>
        </ul>
        <p class="load-error__th">ภาษาไทย: content.yml พิมพ์ผิดแถวบรรทัด${line ? ` ${line}` : ''} เช็กการเว้นวรรค (ห้ามใช้ Tab) และข้อความที่มี : หรือ # ให้ครอบด้วย "..."</p>
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
    if (str(profile.site_title)) doc.title = str(profile.site_title);
    else if (name) doc.title = role ? `${name} · ${str(role)}` : name;
    const intro = str(profile.intro);
    if (intro) $('meta[name="description"]').setAttribute('content', intro.slice(0, 160));

    // favicon: the first letter, lit in the accent on stage black
    const a = getComputedStyle(root).getPropertyValue('--accent').trim() || '#bc97dd';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0d0c0e"/><text x="32" y="45" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="36" fill="${esc(a)}">${esc(firstGlyph(name || 'P'))}</text></svg>`;
    $('#favicon').setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg));
  }

  /* ------------------------------------------------------------------------
     Render: each scene of the show
     ------------------------------------------------------------------------ */
  // Engine attributes are skipped where a scene is drawn static (reduced motion)
  const cue = (v) => (REDUCED ? '' : ` data-sc-cue="${v}"`);

  function socialsHTML(list, cls = '') {
    const items = arr(list)
      .map(obj)
      .map((s) => ({ name: str(s.name), url: link(s.url) }))
      .filter((s) => s.name && s.url);
    if (!items.length) return '';
    return `<div class="socials ${cls}">${items
      .map((s) => `<a class="social" href="${esc(s.url)}"${targetAttr(s.url)}>${socialIcon(s.name, s.url)}<span>${esc(s.name)}</span></a>`)
      .join('')}</div>`;
  }

  function sceneHead(title, subtitle, extra = '') {
    if (!title && !subtitle && !extra) return '';
    return `
      <header class="scene__head" data-sc-in>
        ${title ? `<h2 class="scene__title">${esc(title)}</h2>` : ''}
        ${subtitle ? `<p class="scene__sub">${esc(subtitle)}</p>` : ''}
        ${extra}
      </header>`;
  }

  // A programme cover for work with no image: the title, set like a show bill
  const COVER_TONES = ['stage', 'velvet', 'slate'];
  function coverHTML(title, year) {
    const tone = COVER_TONES[hash(title + year) % COVER_TONES.length];
    return `<div class="cover cover--${tone}" aria-hidden="true"><span class="cover__title">${esc(title)}</span>${year ? `<span class="cover__year">${esc(year)}</span>` : ''}</div>`;
  }

  function mediaHTML(p) {
    const img = link(p.image);
    return img
      ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" decoding="async" data-fallback>${coverHTML(p.title, p.year)}`
      : coverHTML(p.title, p.year);
  }

  const tagsHTML = (p) => (p.tags.length ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');

  /** Chips under the title: team: (ฝ่าย) or type: (ประเภท) in content.yml */
  const teamHTML = (p) =>
    p.team.length ? `<p class="team">${p.team.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : '';

  // Silhouettes drawn once: lantern battens above the stage, seat backs in the house
  function battensSVG() {
    let lamps = '';
    [[0.14, 1], [0.27, 0], [0.4, 1], [0.6, 1], [0.73, 0], [0.86, 1]].forEach(([x, row]) => {
      const cx = x * 1600;
      const y = row ? 64 : 150;
      lamps += `<g transform="translate(${cx} ${y})"><path d="M0 0v14"/><rect x="-15" y="14" width="30" height="40" rx="6"/><path d="M-11 54h22l4 16h-30z"/></g>`;
    });
    return `<svg class="hp hp--battens" viewBox="0 0 1600 240" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><path d="M0 64H1600M0 150H1600" class="pipe"/>${lamps}</svg>`;
  }
  function seatsSVG() {
    const row = (y, w, h, off) => {
      let d = '';
      for (let x = -w + off; x < 1600 + w; x += w) d += `M${x + 6} ${y + h}V${y + 18}q0 -18 18 -18h${w - 48}q18 0 18 18V${y + h}z`;
      return d;
    };
    return `<svg class="hp hp--seats" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path class="seats__back" d="${row(40, 116, 160, 0)}"/>
      <path class="seats__front" d="${row(104, 132, 96, 58)}"/>
    </svg>`;
  }

  function renderHero(profile, skills) {
    const p = profile;
    const name = str(p.name) || 'Your Name';
    const roles = arr(p.roles).map(str).filter(Boolean);
    const photo = link(p.photo);
    // Spike-tape labels on the stage floor: skills.highlights (falls back to the first 4 skills)
    const highlights = arr(obj(skills).highlights).map(str).filter(Boolean);
    const chips = (highlights.length ? highlights : arr(obj(skills).items).map(str).filter(Boolean)).slice(0, 4);
    const greeting = str(p.greeting);
    const intro = str(p.intro);
    const contactLabel = L('contact_me', 'Get in touch');
    const workLabel = state.data.__hasWork ? L('view_work', 'View my work') : '';
    const act = REDUCED ? '' : ' data-sc-act="pin" data-sc-span="2.6" data-sc-drift="#0d0c0e"';

    return `
<section class="hero${REDUCED ? ' hero--static' : ''}" id="top" data-scene="top"${act}>
  <div class="hero__stage" data-sc-stage>
    <div class="hp hp--cyc" aria-hidden="true"></div>
    ${battensSVG()}
    <div class="hp hp--floor" aria-hidden="true">
      <div class="floor__boards"></div>
      <span class="spike" style="--x:40%;--y:7%"></span>
      <span class="spike spike--alt" style="--x:71%;--y:30%"></span>
      <span class="spike" style="--x:88%;--y:64%"></span>
      <span class="spike spike--alt" style="--x:64%;--y:84%"></span>
    </div>
    <div class="hp hp--beam" aria-hidden="true"></div>
    <figure class="hp hp--subject">
      <div class="subject__iris">${photo ? `<img src="${esc(photo)}" alt="${esc(name)}">` : `<span class="subject__initial">${esc(firstGlyph(name))}</span>`}</div>
      <span class="subject__mark" aria-hidden="true"></span>
      ${chips.length ? `<ul class="tape" aria-label="Highlights">${chips.map((c, i) => `<li style="--i:${i}">${esc(c)}</li>`).join('')}</ul>` : ''}
    </figure>
    <div class="hp hp--unlit" aria-hidden="true"></div>
    <div class="hp hp--curtain" aria-hidden="true"><div class="curtain curtain--l"></div><div class="curtain curtain--r"></div></div>
    <div class="hp hp--foh" aria-hidden="true"></div>
    <div class="hp hp--pros" aria-hidden="true"><div class="pros__valance"></div><div class="pros__leg pros__leg--l"></div><div class="pros__leg pros__leg--r"></div></div>
    ${seatsSVG()}

    <div class="hero__front">
      ${greeting ? `<p class="hero__greet"${cue('0 0.2 0')}>${esc(greeting)}</p>` : ''}
      <h1 class="hero__name" id="hero-name">${esc(name)}</h1>
      ${roles.length ? `<p class="hero__role"${cue('0 0.2 0')}>${p.role_prefix ? `<span>${esc(str(p.role_prefix))}</span> ` : ''}<span class="typed" id="typed">${esc(roles[0])}</span><span class="caret" aria-hidden="true"></span></p>` : ''}
      ${workLabel || state.contactHref ? `<div class="hero__actions"${cue('0 0.2 0')}>
        ${workLabel ? `<a href="#work" class="btn btn--primary">${esc(workLabel)}</a>` : ''}
        ${state.contactHref ? `<a href="${esc(state.contactHref)}" class="btn btn--ghost">${esc(contactLabel)}</a>` : ''}
      </div>` : ''}
    </div>

    <div class="hero__note"${cue('0.56 1 0.12 0')}>
      ${truthy(p.available) ? `<p class="badge"><span class="badge__lamp"></span>${esc(str(p.available_text) || 'Available for work')}</p>` : ''}
      ${intro ? `<p class="hero__intro">${esc(intro)}</p>` : ''}
      ${socialsHTML(state.data.socials)}
    </div>
  </div>
</section>`;
  }

  function renderAbout(a, profile) {
    const text = paragraphs(a.text);
    const stats = arr(a.stats)
      .map(obj)
      .filter((s) => str(s.number) || str(s.label));
    if (!text && !stats.length) return '';
    const loc = str(profile.location);
    const email = str(profile.email);
    const name = str(profile.name);
    const photo = link(profile.photo);
    const roles = arr(profile.roles).map(str).filter(Boolean);
    const statHTML = stats
      .map((s) => {
        const gh = str(s.github).toLowerCase();
        const raw = str(s.number) || (gh ? '0' : '');
        const m = raw.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
        const suffix = esc((m ? m[3] : '') + str(s.suffix));
        const inner = m
          ? `${esc(m[1])}<span data-count="${m[2]}"${gh ? ` data-github="${esc(gh)}"` : ''}>0</span>${suffix}`
          : `${esc(raw)}${suffix}`;
        return `<div class="ledger__row"><dt class="ledger__num">${inner}</dt><dd class="ledger__label">${esc(s.label)}</dd></div>`;
      })
      .join('');
    return `
<section class="scene about" id="about" data-scene="about">
  <div class="wrap about__grid">
    ${str(a.title) ? `<h2 class="scene__title about__title" data-sc-in>${esc(a.title)}</h2>` : ''}
    ${text ? `<div class="about__text" data-sc-in>${text}</div>` : ''}
    <aside class="billing" data-sc-in>
      ${photo ? `<figure class="billing__shot"><img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" decoding="async"></figure>` : ''}
      ${name ? `<p class="billing__name">${esc(name)}</p>` : ''}
      ${roles.length ? `<ul class="billing__roles">${roles.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${loc || email ? `<p class="billing__meta">${loc ? `<span>${ICON.pin}${esc(loc)}</span>` : ''}${email ? `<a href="${esc(link(email))}">${ICON.mail}${esc(email)}</a>` : ''}</p>` : ''}
    </aside>
  </div>
  ${stats.length ? `<div class="wrap"><dl class="ledger" data-sc-in data-sc-stagger="70">${statHTML}</dl></div>` : ''}
</section>`;
  }

  function renderEducation(e) {
    const items = arr(e.items)
      .map(obj)
      .filter((x) => str(x.title) || str(x.period));
    if (!items.length) return '';
    const n = items.length;
    // One entry per beat of a held frame; a single entry (or reduced motion) needs no hold
    const pinned = n > 1 && !REDUCED;
    const span = Math.min(2.3, 1.3 + 0.35 * n).toFixed(2);
    const seg = 1 / n;
    const win = (i) => {
      if (!pinned) return '';
      if (i === 0) return cue(`0 ${(seg + 0.05).toFixed(3)} 0`);
      if (i === n - 1) return cue(`${(i * seg - 0.05).toFixed(3)} 1 0.12 0`);
      return cue(`${(i * seg - 0.05).toFixed(3)} ${((i + 1) * seg + 0.05).toFixed(3)}`);
    };
    const entries = items
      .map(
        (x, i) => `
      <article class="bio__entry"${win(i)} style="--i:${i}">
        ${str(x.period) ? `<p class="bio__period">${esc(x.period)}</p>` : ''}
        ${str(x.title) ? `<h3 class="bio__role">${esc(x.title)}</h3>` : ''}
        ${str(x.place) ? `<p class="bio__place">${esc(x.place)}</p>` : ''}
        ${str(x.gpax) ? `<p class="bio__gpax">${esc(L('gpax', 'GPAX'))} <strong>${esc(typeof x.gpax === 'number' ? x.gpax.toFixed(2) : str(x.gpax))}</strong></p>` : ''}
        ${str(x.detail) ? `<div class="bio__detail">${paragraphs(x.detail)}</div>` : ''}
      </article>`
      )
      .join('');
    return `
<section class="scene bio${pinned ? ' bio--pinned' : ''}" id="education" data-scene="education"${pinned ? ` data-sc-act="pin" data-sc-span="${span}" data-span-full="${span}" data-span-fast="1.25"` : ''}>
  <div class="bio__stage"${pinned ? ' data-sc-stage' : ''}>
    <div class="wrap bio__grid">
      ${str(e.title) ? `<h2 class="scene__title bio__title">${esc(e.title)}</h2>` : ''}
      <div class="bio__line" aria-hidden="true"><span class="bio__fill"></span>${items.map((_, i) => `<i style="--at:${n > 1 ? i / (n - 1) : 0}"></i>`).join('')}</div>
      <div class="bio__entries">${entries}</div>
    </div>
  </div>
</section>`;
  }

  function renderSkills(s, profile) {
    const seen = new Set();
    // The same tool listed twice shows once
    const items = arr(s.items).map(str).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
    if (!items.length) return '';
    if (!REDUCED) return renderSlate(s, items, profile);
    return `
<section class="scene kit" id="skills" data-scene="skills" data-sc-act="flow">
  <div class="wrap kit__grid">
    ${sceneHead(str(s.title), str(s.subtitle))}
    <div class="kit__sheet" data-sc-reveal="down" data-sc-reveal-at="0.06 0.3">
      <ol class="kit__list">${items.map((x) => `<li><span class="kit__tick" aria-hidden="true"></span>${logosHTML(x)}${esc(x)}</li>`).join('')}</ol>
    </div>
  </div>
</section>`;
  }

  /**
   * Skill logos live in assets/icons/skills/<name>.svg. The name is the skill
   * in lowercase letters and digits ("C++" → cplusplus, "Node.js" → nodejs);
   * "HTML/CSS/JavaScript" shows one logo per part. No file, no logo.
   */
  const LOGO_ALIAS = { html5: 'html', css3: 'css', js: 'javascript', visualstudiocode: 'vscode', golang: 'go' };
  const logoSlugs = (name) =>
    str(name)
      .split('/')
      .map((part) => part.toLowerCase().replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
      .map((slug) => LOGO_ALIAS[slug] || slug);
  const logosHTML = (name) =>
    `<span class="logos" aria-hidden="true">${logoSlugs(name)
      .map((slug) => `<img class="logo" src="assets/icons/skills/${slug}.svg" alt="" width="24" height="24" decoding="async">`)
      .join('')}</span>`;
  function watchLogo(img) {
    if (img.complete && img.naturalWidth === 0) img.remove();
    else img.addEventListener('error', () => img.remove(), { once: true });
  }

  // Skills on a clapperboard: the stage holds, and every step of the wheel claps a new take
  function renderSlate(s, items, profile) {
    const title = str(s.title);
    const span = Math.min(2.2, 1.2 + items.length * 0.08).toFixed(2);
    return `
<section class="scene slate-scene" id="skills" data-scene="skills" data-sc-act="pin" data-sc-span="${span}" data-span-full="${span}" data-span-fast="1.2">
  <div class="slate-scene__stage" data-sc-stage>
    <div class="wrap slate-scene__grid">
      <div class="slate-scene__side">
        ${sceneHead(title, str(s.subtitle))}
        <ol class="takes">${items.map((x, i) => `<li data-take="${i}"><span class="kit__tick" aria-hidden="true"></span>${logosHTML(x)}<span class="takes__name">${esc(x).replace(/\//g, '/<wbr>')}</span></li>`).join('')}</ol>
      </div>
      <div class="slate" aria-hidden="true">
        <div class="slate__stick"></div>
        <div class="slate__board">
          <div class="slate__bar"></div>
          <div class="slate__take"><span class="slate__logos"></span><span class="slate__name">${esc(items[0])}</span></div>
          <dl class="slate__fields">
            ${str(profile.name) ? `<div class="slate__prod"><dt>Prod.</dt><dd>${esc(profile.name)}</dd></div>` : ''}
            ${title ? `<div><dt>Scene</dt><dd>${esc(title)}</dd></div>` : ''}
            <div><dt>Take</dt><dd class="slate__no">01</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</section>`;
  }

  function normalizeProjects(list) {
    return arr(list)
      .map(obj)
      .map((p) => ({
        title: str(p.title),
        category: str(p.category),
        // chips under the title: team (ฝ่าย, Activities) and/or type (ประเภท, Projects)
        team: [...arr(p.team), ...arr(p.type)].map(str).filter(Boolean),
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

  /** Filter buttons. categories: in content.yml always show, in that order (empty ones are greyed out) */
  function filtersHTML(d, items) {
    const fixed = arr(d.categories).map(str).filter(Boolean);
    const cats = [...new Set([...fixed, ...items.map((p) => p.category).filter(Boolean)])];
    if (!(fixed.length || cats.length > 1)) return '';
    return `<div class="filters" role="group" aria-label="Filter ${esc(d.__label)}">
      <button class="chip is-active" type="button" data-filter="*" aria-pressed="true">${esc(L('all', 'All'))}<sup>${items.length}</sup></button>
      ${cats
        .map((c) => {
          const n = items.filter((p) => p.category === c).length;
          return `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="false"${n ? '' : ' disabled'}>${esc(c)}<sup>${n}</sup></button>`;
        })
        .join('')}
    </div>`;
  }

  const openAttrs = (i, p) => `tabindex="0" role="button" data-open="${i}" aria-label="${esc(p.title)}: ${esc(L('open_project', 'View'))}"`;

  // Projects: the repertoire travels sideways while the stage holds
  function renderWork(d, items, offset) {
    if (!items.length) return '';
    const cards = items
      .map(
        (p, i) => `
      <article class="rep__card${p.featured ? ' rep__card--wide' : ''}" data-cat="${esc(p.category)}">
        <div class="rep__inner" ${openAttrs(offset + i, p)}>
          <div class="rep__media">${mediaHTML(p)}</div>
          <p class="meta">${p.featured ? `<span class="flag">${esc(L('featured', 'Featured'))}</span>` : ''}<span>${esc(p.category)}</span><span>${esc(p.year)}</span></p>
          <h3 class="rep__title">${esc(p.title)}</h3>
          ${teamHTML(p)}
          ${p.description ? `<p class="rep__desc">${esc(p.description)}</p>` : ''}
          ${tagsHTML(p)}
          <span class="rep__open">${esc(L('open_project', 'View'))} ${ICON.arrow}</span>
        </div>
      </article>`
      )
      .join('');
    const act = REDUCED ? '' : ' data-sc-act="pan" data-sc-span="2.4" data-span-full="2.4" data-span-fast="1.4"';
    return `
<section class="scene rep" id="work" data-scene="work"${act}>
  <div class="rep__stage" data-sc-stage>
    <div class="wrap">${sceneHead(str(d.title), str(d.subtitle), filtersHTML(d, items))}</div>
    <div class="rep__rail" data-sc-pan="0.04">${cards}</div>
  </div>
</section>`;
  }

  // Experiences: plain engagement rows
  function renderEngagements(d, items, offset) {
    if (!items.length) return '';
    const rows = items
      .map(
        (p, i) => `
      <li class="row" data-cat="${esc(p.category)}">
        <div class="row__inner" ${openAttrs(offset + i, p)}>
          <p class="row__year">${esc(p.year)}</p>
          <div class="row__main">
            <h3 class="row__title">${esc(p.title)}</h3>
            ${teamHTML(p)}
            ${p.description ? `<p class="row__desc">${esc(p.description)}</p>` : ''}
            ${tagsHTML(p)}
          </div>
          <p class="row__cat">${esc(p.category)}</p>
          ${link(p.image) ? `<div class="row__thumb">${mediaHTML(p)}</div>` : ''}
        </div>
      </li>`
      )
      .join('');
    return `
<section class="scene engage" id="experiences" data-scene="experiences">
  <div class="wrap">
    ${sceneHead(str(d.title), str(d.subtitle), filtersHTML(d, items))}
    <ol class="rows" data-sc-in data-sc-stagger="60">${rows}</ol>
  </div>
</section>`;
  }

  // Activities: the production credits, picked out one at a time by the follow spot
  function renderCredits(d, items, offset) {
    if (!items.length) return '';
    const rows = items
      .map(
        (p, i) => `
      <li class="credit" data-cat="${esc(p.category)}" data-i="${i}">
        <div class="credit__inner" ${openAttrs(offset + i, p)}>
          <p class="credit__year">${esc(p.year)}</p>
          <div class="credit__main">
            <h3 class="credit__title">${esc(p.title)}</h3>
            ${teamHTML(p)}
            ${p.description ? `<p class="credit__desc">${esc(p.description)}</p>` : ''}
            ${tagsHTML(p)}
          </div>
          <p class="credit__cat">${esc(p.category)}</p>
          <div class="credit__thumb">${mediaHTML(p)}</div>
        </div>
      </li>`
      )
      .join('');
    const slides = items
      .map((p, i) => {
        const img = link(p.image);
        return `<div class="window__slide" data-i="${i}">${img ? `<img data-src="${esc(img)}" alt="" decoding="async" data-fallback>` : ''}${coverHTML(p.title, p.year)}</div>`;
      })
      .join('');
    return `
<section class="scene credits" id="activities" data-scene="activities">
  <div class="wrap">
    ${sceneHead(str(d.title), str(d.subtitle), filtersHTML(d, items))}
    <div class="credits__grid">
      <div class="window" aria-hidden="true"><div class="window__frame">${slides}</div></div>
      <ol class="credits__list">${rows}</ol>
    </div>
  </div>
</section>`;
  }

  // The close: house lights up. Uses the Contact section when it exists, and always carries the footer
  function renderCurtainCall(c, f, profile, hasContact) {
    const name = str(profile.name);
    const email = str(profile.email);
    const mail = email ? link(email) : '';
    const resume = link(profile.resume);
    const title = str(c.title) || name;
    const act = REDUCED ? '' : ' data-sc-act="pin" data-sc-span="1.5" data-span-full="1.5" data-span-fast="1.2" data-sc-drift="#221b17"';
    return `
<footer class="call" id="${hasContact ? 'contact' : 'curtain-call'}" data-scene="call"${act}>
  <div class="call__stage" data-sc-stage>
    <div class="call__house" aria-hidden="true"></div>
    <div class="wrap call__copy"${cue('0 1 0 0')}>
      ${str(f.text) ? `<p class="call__kicker">${esc(f.text)}</p>` : ''}
      ${title ? `<h2 class="call__title">${esc(title)}</h2>` : ''}
      ${str(c.text) ? `<p class="call__text">${esc(c.text)}</p>` : ''}
      ${email ? `<a class="call__email" href="${esc(mail)}">${esc(email)}</a>` : ''}
      ${email || resume ? `<div class="call__actions">
        ${email ? `<a class="btn btn--primary" href="${esc(mail)}">${esc(L('send_email', 'Send me an email'))}</a>` : ''}
        ${resume ? `<a class="btn btn--ghost" href="${esc(resume)}"${targetAttr(resume)} download>${ICON.file} ${esc(L('download_resume', 'Download resume'))}</a>` : ''}
      </div>` : ''}
      ${socialsHTML(state.data.socials, 'socials--call')}
    </div>
    <div class="wrap call__foot">
      <span>© ${new Date().getFullYear()} ${esc(name)}</span>
      <a href="#top" class="to-top">${ICON.up} ${esc(L('back_to_top', 'Back to top'))}</a>
    </div>
  </div>
</footer>`;
  }

  // Cue numbers on the prompt desk, spaced the way a real prompt book is
  const LX = [1, 4, 7, 12, 15, 21, 26, 30, 34, 38];
  function renderDesk(profile, scenes) {
    const list = scenes
      .filter((s) => s.nav)
      .map((s) => `<a href="#${s.id}" data-cue="${s.id}"><span class="desk__q">LX ${s.q}</span><span class="desk__label">${esc(s.label)}</span></a>`)
      .join('');
    $('#desk').innerHTML = `
      <div class="desk__calls">
        <p class="desk__mode" id="desk-mode">Full run</p>
        <p class="desk__row desk__row--go"><span class="lamp lamp--go" aria-hidden="true"></span><span class="desk__state">GO</span><span class="desk__q" id="go-q"></span><span class="desk__label" id="go-label"></span></p>
        <p class="desk__row desk__row--sb"><span class="lamp lamp--sb" aria-hidden="true"></span><span class="desk__state">Standby</span><span class="desk__q" id="sb-q"></span><span class="desk__label" id="sb-label"></span></p>
      </div>
      <div class="desk__actions">
        <button class="desk__toggle" id="desk-toggle" type="button" aria-expanded="false" aria-controls="cue-list">${esc(L('menu_button', 'Scenes'))}</button>
        ${state.contactHref ? `<a class="desk__cta" href="${esc(state.contactHref)}">${esc(L('nav_button', 'Let’s talk'))}</a>` : ''}
      </div>
      <nav class="desk__list" id="cue-list" aria-label="Sections" hidden>${list}</nav>`;
  }

  // cards = every card from Projects / Activities / Experiences (indexed by data-open)
  const state = { data: {}, cards: [], scenes: [], contactHref: '', sc: null, pace: { fast: false, v: 0, locked: false } };

  /** Small UI text (buttons, badges…) from the `labels:` section of content.yml */
  const L = (key, fallback) => str(obj(state.data.labels)[key]) || fallback;

  /** Thai text in small spaced-out labels → turn off letter-spacing */
  function markThai(scope) {
    $$('.meta span, .row__year, .row__cat, .credit__year, .credit__cat, .bio__period, .chip, .desk__label, .tags li, .team span, .tape li, .takes li', scope).forEach((el) => {
      if (/[฀-๿]/.test(el.textContent)) el.classList.add('th');
    });
  }

  function render(data) {
    state.data = data;
    const profile = obj(data.profile);
    const about = obj(data.about);
    const skills = obj(data.skills);
    const projects = obj(data.projects);
    const activities = obj(data.activities);
    const experiences = obj(data.experiences);
    const education = obj(data.education);
    const contact = obj(data.contact);

    // Card sections share state.cards so the modal can open any card by its index
    state.cards = [];
    const cardSection = (d, fn) => {
      const items = normalizeProjects(d.items);
      const offset = state.cards.length;
      state.cards.push(...items);
      return () => fn(d, items, offset);
    };
    const work = cardSection(projects, renderWork);
    data.__hasWork = state.cards.length > 0;
    const acts = cardSection(activities, renderCredits);
    const exps = cardSection(experiences, renderEngagements);

    applyTheme(data.theme, profile);

    // Scene order (same as before) + default menu names
    const defs = [
      { id: 'about', d: about, label: 'About', fn: () => renderAbout(about, profile) },
      { id: 'education', d: education, label: 'Education', fn: () => renderEducation(education) },
      { id: 'skills', d: skills, label: 'Skills', fn: () => renderSkills(skills, profile) },
      { id: 'experiences', d: experiences, label: 'Experiences', fn: exps },
      { id: 'work', d: projects, label: 'Projects', fn: work },
      { id: 'activities', d: activities, label: 'Activities', fn: acts },
    ];
    defs.forEach((s) => { s.d.__label = str(s.d.menu) || s.label; });
    contact.__label = str(contact.menu) || 'Contact';
    const hasContact = !!(str(contact.title) || str(contact.text));
    // "Let's talk" / "Get in touch" go to the Contact section, or straight to email if that section is removed
    const email = str(profile.email);
    state.contactHref = hasContact ? '#contact' : email ? link(email) : '';

    let html = '';
    const scenes = [{ id: 'top', label: str(profile.name) || 'Top', nav: true }];
    defs.forEach((s) => {
      const out = s.fn();
      if (out) {
        html += out;
        scenes.push({ id: s.id, label: s.d.__label, nav: true });
      }
    });
    scenes.push({ id: hasContact ? 'contact' : 'curtain-call', label: contact.__label, nav: true, scene: 'call' });
    scenes.forEach((s, i) => { s.q = LX[i] ?? LX[LX.length - 1] + (i - LX.length + 1) * 4; });
    state.scenes = scenes;

    $('#app').innerHTML = renderHero(profile, skills) + html + renderCurtainCall(contact, obj(data.footer), profile, hasContact);
    $('#lx').innerHTML = scenes.map((s) => `<div class="lx__state" data-state="${s.scene || s.id}"></div>`).join('');
    renderDesk(profile, scenes);

    markThai(doc);

    // Broken image → fall back to the generated cover; a loaded one removes it
    $$('img[data-fallback]').forEach(watchImage);
    $$('img.logo').forEach(watchLogo);
  }

  function watchImage(img) {
    const done = () => {
      const cover = img.nextElementSibling;
      if (cover && cover.classList.contains('cover')) cover.remove();
    };
    if (!img.getAttribute('src')) return;
    if (img.complete) return img.naturalWidth > 0 ? done() : img.remove();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
  }

  /* ------------------------------------------------------------------------
     Animations & interactions
     ------------------------------------------------------------------------ */

  /** Make the name as big as fits, so long names never overflow */
  function fitName() {
    const el = $('#hero-name');
    if (!el) return;
    el.style.removeProperty('--name-size');
    el.style.transform = '';
    const max = el.parentElement.clientWidth;
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

  function initCounters() {
    const els = $$('[data-count]');
    // Target is read every frame, so a live GitHub number arriving mid-count is picked up
    const show = (el, e) => {
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      el.textContent = (parseFloat(el.dataset.count) * e).toFixed(decimals);
    };
    const run = (el) => {
      if (REDUCED) {
        show(el, 1);
        el.dataset.counted = '1';
        return;
      }
      const dur = 1500;
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        show(el, 1 - Math.pow(1 - t, 3)); // easeOutCubic
        if (t < 1) requestAnimationFrame(step);
        else el.dataset.counted = '1';
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
      { threshold: 0.5 }
    );
    els.forEach((e) => io.observe(e));
  }

  /** Stats with  github: repos / contributions  get live numbers (the number in content.yml stays if this fails) */
  async function initGithubStats() {
    const els = $$('[data-github]');
    if (!els.length) return;
    const match = arr(state.data.socials)
      .map((s) => str(obj(s).url).match(/github\.com\/([^/?#]+)/i))
      .find(Boolean);
    if (!match) return;
    const user = encodeURIComponent(match[1]);
    const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    const sources = {
      repos: () => getJSON(`https://api.github.com/users/${user}`).then((d) => d.public_repos),
      // Last 12 months — the same number shown on the GitHub profile page
      contributions: () =>
        getJSON(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`).then((d) => Number(obj(d.total).lastYear)),
    };
    await Promise.all(
      Object.keys(sources).map(async (kind) => {
        const targets = els.filter((el) => el.dataset.github === kind);
        if (!targets.length) return;
        try {
          const n = await sources[kind]();
          if (!Number.isFinite(n)) return;
          targets.forEach((el) => {
            el.dataset.count = String(n);
            if (el.dataset.counted) el.textContent = String(n);
          });
        } catch (e) {
          /* offline or rate-limited → keep the number from content.yml */
        }
      })
    );
  }

  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const actFor = (el) => (state.sc && el ? state.sc.acts.find((a) => a.el === el) : null);

  /**
   * The curtain. Scroll progress through the pinned hero drives every plane:
   * the house goes dark, the tabs part, the stage lights up, the name flies
   * up into the proscenium. Each plane moves at its own rate.
   */
  function initHero() {
    const hero = $('#top');
    const stage = hero && $('.hero__stage', hero);
    const name = $('#hero-name');
    if (!stage || !name) return;
    const set = (o, l, p) => {
      stage.style.setProperty('--o', o.toFixed(4));
      stage.style.setProperty('--l', l.toFixed(4));
      stage.style.setProperty('--p', p.toFixed(4));
    };
    if (REDUCED) return set(1, 1, 0.5);
    const act = actFor(hero);
    const cur = { o: 0, l: 0, n: 0, p: 0 };
    let dy = 0;
    let s1 = 0.42;
    const measure = () => {
      name.style.transform = '';
      const r = name.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      const val = $('.pros__valance', stage).getBoundingClientRect();
      s1 = clamp((innerWidth < 700 ? 0.6 : 0.4), 0.3, 1);
      const target = val.bottom - st.top + (r.height * s1) / 2 + innerHeight * 0.03;
      dy = target - (r.top - st.top + r.height / 2);
    };
    let dirty = true;
    measure();
    addEventListener('resize', () => requestAnimationFrame(() => { measure(); dirty = true; }));
    const loop = () => {
      const p = act ? act.p : 0;
      const target = { o: ease((p - 0.04) / 0.5), l: ease((p - 0.2) / 0.42), n: ease((p - 0.16) / 0.4), p };
      const k = state.pace.fast ? 1 : 0.16;
      for (const key in target) {
        const d = target[key] - cur[key];
        if (Math.abs(d) < 0.0004) cur[key] = target[key];
        else { cur[key] += d * k; dirty = true; }
      }
      if (dirty) {
        dirty = false;
        set(cur.o, cur.l, cur.p);
        name.style.transform = `translate3d(0, ${(dy * cur.n).toFixed(1)}px, 0) scale(${(1 - (1 - s1) * cur.n).toFixed(4)})`;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * The prompt desk. As a scene approaches, its cue goes to standby; when it
   * crosses the reading line the desk calls GO and the stage lighting for the
   * whole page crossfades to that scene's state.
   */
  function initDesk() {
    const desk = $('#desk');
    const scenes = state.scenes.map((s) => ({ ...s, el: doc.getElementById(s.id) })).filter((s) => s.el);
    if (!scenes.length) return;
    const goQ = $('#go-q');
    const goL = $('#go-label');
    const sbQ = $('#sb-q');
    const sbL = $('#sb-label');
    const states = $$('.lx__state');
    const links = $$('[data-cue]', desk);
    let current = -1;
    let standby = -2;

    const call = (i) => {
      current = i;
      const s = scenes[i];
      goQ.textContent = `LX ${s.q}`;
      goL.textContent = s.label;
      goL.classList.toggle('th', /[฀-๿]/.test(s.label));
      const lx = s.scene || s.id;
      states.forEach((el) => el.classList.toggle('is-on', el.dataset.state === lx));
      body.dataset.lx = lx;
      links.forEach((a) => a.toggleAttribute('aria-current', a.dataset.cue === s.id));
      desk.classList.remove('is-called');
      void desk.offsetWidth; // restart the GO flash
      desk.classList.add('is-called');
    };
    const stand = (i) => {
      standby = i;
      const s = scenes[i];
      desk.classList.toggle('has-standby', !!s);
      if (s) {
        sbQ.textContent = `LX ${s.q}`;
        sbL.textContent = s.label;
        sbL.classList.toggle('th', /[฀-๿]/.test(s.label));
      }
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = innerHeight;
      const line = vh * 0.55;
      let i = 0;
      for (let k = 0; k < scenes.length; k++) if (scenes[k].el.getBoundingClientRect().top <= line) i = k;
      if (i !== current) call(i);
      const next = scenes[i + 1];
      const near = next && next.el.getBoundingClientRect().top < vh * 1.35 ? i + 1 : -1;
      if (near !== standby) stand(near);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();

    // Cue list: the desk opens into the full running order
    const toggle = $('#desk-toggle');
    const list = $('#cue-list');
    const open = (on) => {
      toggle.setAttribute('aria-expanded', String(on));
      list.hidden = !on;
      desk.classList.toggle('is-open', on);
    };
    toggle.addEventListener('click', () => open(list.hidden));
    links.forEach((a) => a.addEventListener('click', () => open(false)));
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !list.hidden) {
        open(false);
        toggle.focus();
      }
    });
    doc.addEventListener('click', (e) => {
      if (!list.hidden && !desk.contains(e.target)) open(false);
    });
  }

  /** Activities: the follow spot lights the credit at the reading line and shows its photo in the window */
  function initFollowSpot() {
    const section = $('#activities');
    if (!section) return;
    const rows = $$('.credit', section);
    const slides = $$('.window__slide', section);
    let lit = -1;
    const load = (i) => {
      const slide = slides[i];
      const img = slide && $('img[data-src]', slide);
      if (img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        watchImage(img);
      }
    };
    const light = (i) => {
      lit = i;
      rows.forEach((r) => r.classList.toggle('is-lit', +r.dataset.i === i));
      slides.forEach((s) => s.classList.toggle('is-on', +s.dataset.i === i));
      [i, i + 1, i - 1].forEach(load);
    };
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const line = innerHeight * 0.45;
      let best = -1;
      let dist = Infinity;
      rows.forEach((row) => {
        if (row.classList.contains('is-filtered')) return;
        const b = row.getBoundingClientRect();
        const d = Math.abs(b.top + b.height / 2 - line);
        if (d < dist) { dist = d; best = +row.dataset.i; }
      });
      if (best !== lit && best > -1) light(best);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    section.addEventListener('filtered', onScroll);
    const first = rows[0];
    if (first) light(+first.dataset.i);
    update();
  }

  /**
   * The slate. Scroll position through the held stage picks the take; each new
   * take is a hard cut (no fade) with the clapper snapping shut on it. Takes
   * already shot stay ticked in the list beside it.
   */
  function initSlate() {
    const section = $('#skills');
    const act = actFor(section);
    if (!act) return;
    const slate = $('.slate', section);
    const box = $('.slate__take', section);
    const name = $('.slate__name', section);
    const logos = $('.slate__logos', section);
    const no = $('.slate__no', section);
    const rows = $$('[data-take]', section);
    const items = rows.map((r) => r.textContent.trim());
    let cur = -1;
    const fit = () => {
      name.style.removeProperty('font-size');
      const cs = getComputedStyle(box);
      const max = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (name.scrollWidth > max && max > 0) {
        name.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(name).fontSize) * (max / name.scrollWidth) * 0.96)}px`;
      }
    };
    const cut = (i) => {
      cur = i;
      name.textContent = items[i];
      name.classList.toggle('th', /[\u0E00-\u0E7F]/.test(items[i]));
      no.textContent = String(i + 1).padStart(2, '0');
      logos.replaceChildren(...$$('img.logo', rows[i]).map((img) => {
        const copy = img.cloneNode();
        watchLogo(copy);
        return copy;
      }));
      fit();
      rows.forEach((r, k) => {
        r.classList.toggle('is-take', k === i);
        r.classList.toggle('is-shot', k < i);
      });
      slate.classList.remove('is-clap');
      void slate.offsetWidth; // restart the clap
      slate.classList.add('is-clap');
    };
    addEventListener('resize', fit);
    const loop = () => {
      // the last take holds for the final stretch of the scene
      const i = Math.min(items.length - 1, Math.floor(clamp(act.p / 0.88, 0, 0.9999) * items.length));
      if (i !== cur) cut(i);
      requestAnimationFrame(loop);
    };
    loop();
  }

  /** Projects rail: fit the pinned scroll length to how far the rail actually travels */
  function refitRail() {
    const section = $('#work');
    const act = actFor(section);
    const rail = section && $('.rep__rail', section);
    if (!act || !rail) return;
    const over = rail.scrollWidth - innerWidth;
    // A rail that fits has nowhere to travel: the engine stops writing its offset, so clear
    // the last one and let CSS centre the cards
    if (over <= 0) rail.style.transform = '';
    rail.classList.toggle('is-fit', over <= 0);
    // Shorter than the curtain, which keeps the longest hold on the page
    const full = over > 0 ? clamp(1.3 + (over / innerWidth) * 0.9, 1.4, 2.4) : 1.2;
    section.dataset.spanFull = full.toFixed(2);
    const short = state.pace.fast && section.getBoundingClientRect().top > innerHeight;
    act.span = short ? Math.min(full, +section.dataset.spanFast) : full;
    section.setAttribute('data-sc-span', act.span.toFixed(2));
    state.sc.layout();
  }

  /**
   * Pinned scenes keep two lengths: the full run, and a short one for cue to
   * cue. Only scenes still below the screen change, so nothing the visitor can
   * see moves, and the place they are reading stays exactly where it was.
   */
  function fitSpans(fast) {
    if (!state.sc) return;
    let changed = false;
    state.sc.acts.forEach((a) => {
      const full = +a.el.dataset.spanFull;
      const short = +a.el.dataset.spanFast;
      if (!full || !short || a.el.getBoundingClientRect().top <= innerHeight) return;
      const want = fast ? Math.min(short, full) : full;
      if (Math.abs(a.span - want) > 0.001) {
        a.span = want;
        a.el.setAttribute('data-sc-span', want.toFixed(2));
        changed = true;
      }
    });
    if (changed) state.sc.layout();
  }

  /**
   * Pace. Scrolled hard, the show runs cue to cue: the scenes still ahead
   * shorten, the lighting snaps and the stars streak past. Scrolled gently it
   * is the full run: full-length scenes, slow fades, planes that glide, and
   * stars that link up while the page sits still.
   */
  function initPace() {
    const pace = state.pace;
    const mode = $('#desk-mode');
    const hist = [];
    let lastY = scrollY;
    let lastT = performance.now();
    let slowSince = 0;
    const set = (fast) => {
      pace.fast = fast;
      body.dataset.pace = fast ? 'cue' : 'run';
      if (mode) mode.textContent = fast ? 'Cue to cue' : 'Full run';
      fitSpans(fast);
    };
    body.dataset.pace = 'run';
    if (REDUCED) return;
    const tick = (now) => {
      const y = scrollY;
      pace.v += ((y - lastY) / Math.max(1, now - lastT) - pace.v) * 0.2; // px per ms, smoothed
      lastY = y;
      lastT = now;
      hist.push([now, y]);
      while (now - hist[0][0] > 300) hist.shift();
      // distance covered in the last 300ms, so one PageDown never counts as a rush
      const travel = Math.abs(y - hist[0][1]);
      if (!pace.fast) {
        if (travel > innerHeight * 0.9 && !pace.locked) set(true);
      } else if (travel < innerHeight * 0.25) {
        if (!slowSince) slowSince = now;
        else if (now - slowSince > 450) {
          slowSince = 0;
          set(false);
        }
      } else slowSince = 0;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // A jump from a link (menu, buttons, back to top) keeps the layout still until it lands
    let timer = 0;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        pace.locked = false;
        removeEventListener('scroll', settle);
      }, 260);
    };
    doc.addEventListener('click', (e) => {
      if (!e.target.closest('a[href^="#"]')) return;
      pace.locked = true;
      addEventListener('scroll', settle, { passive: true });
      settle();
    });
  }

  /**
   * Stars over the stage: they twinkle and link up to the pointer (and to each
   * other near it), streak past when the page is run cue to cue, and slowly join
   * into a constellation when the page is left to sit.
   */
  function initStars() {
    const canvas = $('#stars');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let stars = [];
    let still = 0;
    let lastY = scrollY;
    const mouse = { x: -9999, y: -9999 };
    const accent = () => getComputedStyle(root).getPropertyValue('--accent-2').trim() || '#f5ae72';
    let color = accent();

    const resize = () => {
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(60, Math.round((w * h) / 22000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        z: 0.35 + Math.random() * 0.65, // depth: nearer stars travel and streak further
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        tw: Math.random() * Math.PI * 2,
        ts: 0.01 + Math.random() * 0.025,
      }));
      if (REDUCED) draw(false);
    };

    const link = (a, b, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    const draw = (move = true) => {
      ctx.clearRect(0, 0, w, h);
      const v = move ? clamp(state.pace.v, -8, 8) : 0;
      const dy = move ? scrollY - lastY : 0;
      lastY = scrollY;
      const streak = Math.abs(v) > 0.7;
      // the constellation forms while nothing moves and breaks the moment the page does
      still = Math.abs(v) < 0.04 ? Math.min(1, still + 0.006) : Math.max(0, still - 0.1);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      for (const s of stars) {
        if (move) {
          s.x += s.vx;
          s.y += s.vy - dy * 0.1 * s.z;
          s.tw += s.ts;
          if (s.x < -5) s.x = w + 5;
          if (s.x > w + 5) s.x = -5;
          if (s.y < -20) s.y = h + 20;
          if (s.y > h + 20) s.y = -20;
        }
        const a = 0.25 + (Math.sin(s.tw) + 1) * 0.3;
        if (streak) {
          ctx.globalAlpha = a * 0.75;
          ctx.lineWidth = s.r;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + v * 12 * s.z);
          ctx.stroke();
        } else {
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (streak) {
        ctx.globalAlpha = 1;
        return;
      }
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = color;
      // lines around the mouse
      const R = 150;
      const near = stars.filter((s) => Math.abs(s.x - mouse.x) < R && Math.abs(s.y - mouse.y) < R);
      for (let i = 0; i < near.length; i++) {
        const a = near[i];
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm > R) continue;
        link(a, mouse, (1 - dm / R) * 0.5);
        for (let j = i + 1; j < near.length; j++) {
          const b = near[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) link(a, b, (1 - d / 90) * (1 - dm / R) * 0.5);
        }
      }
      // left to sit, the whole sky links up
      if (still > 0.02) {
        const L = 80 + 60 * still;
        for (let i = 0; i < stars.length; i++) {
          for (let j = i + 1; j < stars.length; j++) {
            const d = Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y);
            if (d < L) link(stars[i], stars[j], (1 - d / L) * 0.42 * still);
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
    addEventListener('resize', resize);
    if (mq('(hover: hover) and (pointer: fine)')) {
      addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
      doc.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });
    }
    doc.addEventListener('visibilitychange', () => { running = !doc.hidden && !REDUCED; });
    if (!REDUCED) requestAnimationFrame(loop);
    // pick up the theme color once it has been applied
    setTimeout(() => { color = accent(); }, 100);
  }

  /** Filter buttons. Each section filters only its own items */
  function initFilters() {
    // Filtering while the projects stage is held restarts its rail from the first card,
    // so the stage stays put instead of jumping when its length changes
    const restartRail = (section) => {
      const top = section.getBoundingClientRect().top + scrollY;
      state.pace.locked = true;
      scrollTo({ top, behavior: 'instant' });
      setTimeout(() => { state.pace.locked = false; }, 400);
    };
    $$('.filters').forEach((group) => {
      const section = group.closest('.scene');
      const items = $$('[data-cat]', section).filter((el) => !el.closest('.filters'));
      const chips = $$('[data-filter]', group);
      chips.forEach((chip) =>
        chip.addEventListener('click', () => {
          const f = chip.dataset.filter;
          const r = section.getBoundingClientRect();
          const held = section.id === 'work' && actFor(section) && r.top <= 1 && r.bottom >= innerHeight;
          chips.forEach((c) => {
            c.classList.toggle('is-active', c === chip);
            c.setAttribute('aria-pressed', String(c === chip));
          });
          let k = 0;
          items.forEach((item) => {
            const match = f === '*' || item.dataset.cat === f;
            const wasHidden = item.classList.contains('is-filtered');
            item.classList.toggle('is-filtered', !match);
            if (match && wasHidden && !REDUCED && item.animate) {
              item.animate(
                [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
                { duration: 420, delay: k++ * 50, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }
              );
            }
          });
          if (section.id === 'work') {
            refitRail();
            if (held) restartRail(section);
          }
          else if (state.sc) state.sc.layout();
          section.dispatchEvent(new Event('filtered'));
        })
      );
    });
  }

  /** Project detail modal */
  function initModal() {
    const modal = $('#modal');
    const content = $('#modal-content');
    const dialog = $('.modal__dialog', modal);
    let lastFocus = null;

    const open = (i) => {
      const p = state.cards[i];
      if (!p) return;
      lastFocus = doc.activeElement;
      const yt = youtubeId(p.video);
      const videoLink = !yt ? link(p.video) : '';
      content.innerHTML = `
        <div class="modal__media">${mediaHTML(p)}</div>
        <div class="modal__body">
          <p class="meta"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></p>
          <h2 class="modal__title" id="modal-title">${esc(p.title)}</h2>
          ${teamHTML(p)}
          <div class="modal__text">${paragraphs(p.details || p.description)}</div>
          ${tagsHTML(p)}
          ${yt ? `<div class="modal__video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="${esc(p.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ''}
          ${p.gallery.length ? `<div class="modal__gallery">${p.gallery.map((g) => `<img src="${esc(g)}" alt="${esc(p.title)}" loading="lazy">`).join('')}</div>` : ''}
          ${p.link || videoLink ? `<div class="modal__actions">
              ${p.link ? `<a class="btn btn--primary" href="${esc(p.link)}"${targetAttr(p.link)}>${esc(p.link_text || L('visit_project', 'View live project'))} ${ICON.out}</a>` : ''}
              ${videoLink ? `<a class="btn btn--ghost" href="${esc(videoLink)}"${targetAttr(videoLink)}>${esc(L('watch_video', 'Watch video'))} ${ICON.out}</a>` : ''}
            </div>` : ''}
        </div>`;
      $$('img[data-fallback]', content).forEach(watchImage);
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
      }, 400);
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
     Boot
     ------------------------------------------------------------------------ */
  async function boot() {
    let data;
    try {
      data = await loadContent();
    } catch (err) {
      body.classList.remove('is-loading');
      showError(err);
      return;
    }

    render(data);

    // Wait for fonts (max 1.5s) so the name is measured correctly
    if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, wait(1500)]);
    fitName();

    state.sc = window.ScrollCraft ? window.ScrollCraft.mount(doc.body) : null;
    refitRail();
    addEventListener('resize', () => {
      fitName();
      refitRail();
    });

    initPace();
    initHero();
    initStars();
    initCounters();
    initGithubStats();
    initDesk();
    initFollowSpot();
    initSlate();
    initFilters();
    initModal();

    body.classList.remove('is-loading');
    await nextFrame();
    body.classList.add('is-ready');
    initTyped();

    // If the URL has #work etc., jump there once the page is built
    if (location.hash.length > 1) {
      const target = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  boot();
})();
