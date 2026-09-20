/**
 * Bihar Samachar Hub — Security Utilities
 * XSS prevention, input sanitization, rate limiting, safe rendering
 */

window.BSH_SECURITY = (function () {
  'use strict';

  /* ─── 1. HTML entity escaper (anti-XSS) ─────────────────────────────── */
  const ESC_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
    '`': '&#x60;', '=': '&#x3D;'
  };

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`=/]/g, s => ESC_MAP[s] || s);
  }

  /* ─── 2. Strip all HTML tags (for RSS descriptions) ──────────────────── */
  function stripHtml(html) {
    if (typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /* ─── 3. Sanitize URL — only allow http/https/mailto ─────────────────── */
  function sanitizeUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') return '#';
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed, location.href);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '#';
      return parsed.href;
    } catch (_) {
      return '#';
    }
  }

  /* ─── 4. Sanitize image URL — allow http, https, and relative paths ──── */
  function sanitizeImgSrc(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('assets/') || trimmed.startsWith('../') || trimmed.startsWith('./') || trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    const safe = sanitizeUrl(trimmed);
    return safe === '#' ? '' : safe;
  }

  /* ─── 5. Truncate text safely ─────────────────────────────────────────── */
  function truncate(str, len) {
    str = stripHtml(String(str || ''));
    return str.length > len ? str.slice(0, len).trimEnd() + '…' : str;
  }

  /* ─── 6. Rate limiter (prevent too many API calls) ────────────────────── */
  const _rateStore = {};
  function rateLimit(key, limitMs) {
    const now = Date.now();
    if (_rateStore[key] && now - _rateStore[key] < limitMs) return false;
    _rateStore[key] = now;
    return true;
  }

  /* ─── 7. Safe JSON parse (never throws) ──────────────────────────────── */
  function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); }
    catch (_) { return fallback !== undefined ? fallback : null; }
  }

  /* ─── 8. Safe localStorage access ────────────────────────────────────── */
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); }
      catch (_) { return null; }
    },
    set(key, val) {
      try { localStorage.setItem(key, val); return true; }
      catch (_) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); }
      catch (_) {}
    }
  };

  /* ─── 9. CSP nonce injection (for inline scripts) ────────────────────── */
  function getNonce() {
    const meta = document.querySelector('meta[name="csp-nonce"]');
    return meta ? meta.content : '';
  }

  /* ─── 10. Safe DOM text setter (never uses innerHTML) ─────────────────── */
  function safeText(element, text) {
    if (element) element.textContent = String(text || '');
  }

  /* ─── 11. Build a safe news card HTML string ──────────────────────────── */
  function buildNewsCard(item, lang) {
    const title   = escapeHtml(truncate(item.title || 'No title', 120));
    const summary = escapeHtml(truncate(item.description || '', 200));
    const link    = sanitizeUrl(item.link || '#');
    const src     = escapeHtml(item.sourceName || '');
    const time    = escapeHtml(item.timeAgo || '');
    const cat     = escapeHtml(item.category || 'general');
    const catLabel = escapeHtml(item.categoryLabel || cat);
    const imgSrc  = sanitizeImgSrc(item.thumbnail || '');
    const logo    = sanitizeImgSrc(item.sourceLogo || '');

    const imgHtml = imgSrc && imgSrc !== 'https://picsum.photos/seed/default/800/400'
      ? `<div class="news-card-img-wrap">
           <img src="${imgSrc}" alt="${title}" loading="lazy" onerror="this.parentElement.remove()">
         </div>`
      : '';

    return `<article class="news-card" role="article">
      ${imgHtml}
      <div class="news-card-content" style="padding:16px; flex:1; display:flex; flex-direction:column;">
        <div class="news-card-meta-top">
          <span class="category-badge cat-${cat}">${catLabel}</span>
          <span class="news-time"><i class="far fa-clock"></i> ${time}</span>
        </div>
        <h3 class="news-card-title">
          <a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>
        </h3>
        <p class="news-card-summary">${summary}</p>
        <div class="news-card-footer">
          <span class="source-badge">
            ${logo ? `<img class="source-logo" src="${logo}" alt="${src}" onerror="this.remove()">` : ''}
            ${src}
          </span>
          <a class="read-more-btn" href="${link}" target="_blank" rel="noopener noreferrer">
            पूरी खबर पढ़ें →
          </a>
        </div>
      </div>
    </article>`;
  }

  /* ─── 12. Build a safe district card ─────────────────────────────────── */
  function buildDistrictCard(d, lang) {
    const name       = escapeHtml(d[`name_${lang}`] || d.name_en || '');
    const div        = escapeHtml(d[`division_${lang}`] || d.division_en || '');
    const hq         = escapeHtml(d[`headquarters_${lang}`] || d.headquarters_en || '');
    const pop        = escapeHtml(d.population_2011 ? Number(d.population_2011).toLocaleString('en-IN') : 'N/A');
    const area       = escapeHtml(d.area_sq_km ? d.area_sq_km.toLocaleString('en-IN') + ' km²' : 'N/A');
    const slug       = escapeHtml(d.slug || d.id || '');
    const imgSrc     = sanitizeImgSrc(d.image_url || '');
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const basePath   = isDistrict ? '../' : '';
    const href       = `${basePath}district/index.html?id=${slug}`;

    const popLabel   = lang === 'hi' ? 'जनसंख्या' : 'Population';
    const areaLabel  = lang === 'hi' ? 'क्षेत्रफल' : 'Area';
    const hqLabel    = lang === 'hi' ? 'मुख्यालय' : 'HQ';
    const viewLabel  = lang === 'hi' ? 'जिला देखें' : 'View District';

    return `<a href="${href}" class="district-card" aria-label="${name}">
      <div class="district-card-img-wrap">
        <img src="${imgSrc}" alt="${name}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${slug}/800/400'">
        <div class="district-card-overlay">
          <span class="division-tag">${div}</span>
        </div>
      </div>
      <div class="district-card-body">
        <h3 class="district-card-name">${name}</h3>
        <div class="district-card-stats">
          <div class="stat-item"><i class="fas fa-building"></i> ${hqLabel}: ${hq}</div>
          <div class="stat-item"><i class="fas fa-users"></i> ${popLabel}: ${pop}</div>
          <div class="stat-item"><i class="fas fa-map"></i> ${areaLabel}: ${area}</div>
        </div>
        <span class="btn btn-primary btn-sm district-card-btn">${viewLabel} →</span>
      </div>
    </a>`;
  }

  /* ─── 13. Validate that district slug is safe ─────────────────────────── */
  function isSafeSlug(slug) {
    return typeof slug === 'string' && /^[a-z0-9-]{1,60}$/.test(slug);
  }

  /* ─── 14. Sanitize search query (prevent injection) ───────────────────── */
  function sanitizeQuery(q) {
    return String(q || '').trim().replace(/[<>'"`;]/g, '').slice(0, 100);
  }

  /* ─── 15. Form Input Scrubber & Prototype Pollution Defense ────────────── */
  function sanitizeFormInput(str) {
    if (typeof str !== 'string') return '';
    let clean = str.replace(/[<>]/g, '').replace(/__proto__|constructor|prototype/gi, '');
    return clean.trim().slice(0, 1000);
  }

  /* ─── 16. Enforce HTTPS in Production ─────────────────────────────────── */
  function enforceHttps() {
    try {
      if (location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
        location.replace('https://' + location.host + location.pathname + location.search + location.hash);
      }
    } catch (_) {}
  }

  /* ─── 17. Form Validation Helpers ──────────────────────────────────────── */
  function validatePhone(phone) {
    return /^[6-9]\d{9}$/.test(String(phone || '').replace(/\D/g, ''));
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  // Enforce HTTPS on script evaluation
  enforceHttps();

  /* ─── Expose public API ───────────────────────────────────────────────── */
  const api = {
    escapeHtml,
    stripHtml,
    sanitizeUrl,
    sanitizeImgSrc,
    truncate,
    rateLimit,
    safeJsonParse,
    storage,
    getNonce,
    safeText,
    buildNewsCard,
    buildDistrictCard,
    isSafeSlug,
    sanitizeQuery,
    sanitizeFormInput,
    enforceHttps,
    validatePhone,
    validateEmail
  };
  window.BSH_SECURITY = api;
  window.SecurityHub = api;
  return api;
})();

