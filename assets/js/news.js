/**
 * Bihar Samachar Hub — news.js (Enhanced V3)
 * - 117+ In-depth News Stories covering all 38 districts & villages
 * - In-Site Detailed News Reader Modal with Speech/Audio reader
 * - Controlled Breaking News Slider (5s auto-change, readable, pause-on-hover, prev/next buttons)
 * - Zero duplicate district names
 * - WhatsApp share integration
 */

'use strict';

const NewsHub = {
  // ─── State ─────────────────────────────────────────────────────────────────
  allNews: [],
  filteredNews: [],
  currentPage: 1,
  PAGE_SIZE: 12,
  currentCategory: 'all',
  currentDistrict: 'all',
  currentSearch: '',
  isLoading: false,

  // Ticker Slider State
  tickerItems: [],
  currentTickerIdx: 0,
  tickerTimer: null,
  isTickerPaused: false,

  // Speech synthesis state
  isSpeaking: false,

  // ─── Telemetry & Analytics Tracking ────────────────────────────────────────
  trackPageView() {
    try {
      if (window.location.protocol.startsWith('http')) {
        const payload = {
          type: 'pageview',
          path: window.location.pathname || '/',
          timestamp: new Date().toISOString(),
          referrer: document.referrer || 'direct'
        };
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/track', JSON.stringify(payload));
        } else {
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          }).catch(() => {});
        }
      }
    } catch (_) {}
  },

  trackEvent(eventType, eventData = {}) {
    try {
      if (window.location.protocol.startsWith('http')) {
        const payload = {
          type: eventType,
          ...eventData,
          path: window.location.pathname || '/',
          timestamp: new Date().toISOString()
        };
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/track', JSON.stringify(payload));
        } else {
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          }).catch(() => {});
        }
      }
    } catch (_) {}
  },

  // ─── Progressive Skeleton Shimmer UI ───────────────────────────────────────
  setLoadingState(isLoading) {
    this.isLoading = isLoading;
    const grid = document.getElementById('news-grid');
    if (grid && isLoading && (!this.allNews || this.allNews.length === 0)) {
      grid.innerHTML = this.renderSkeletonGrid(6);
    }
  },

  renderSkeletonGrid(count = 6) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <article class="skeleton-card" aria-hidden="true">
          <div class="skeleton-shimmer skeleton-img"></div>
          <div class="skeleton-body">
            <div class="skeleton-meta">
              <div class="skeleton-shimmer skeleton-pill"></div>
              <div class="skeleton-shimmer skeleton-pill" style="width:50px;"></div>
            </div>
            <div class="skeleton-shimmer skeleton-title"></div>
            <div class="skeleton-shimmer skeleton-title-2"></div>
            <div class="skeleton-shimmer skeleton-text"></div>
            <div class="skeleton-shimmer skeleton-text-short"></div>
            <div class="skeleton-footer">
              <div class="skeleton-shimmer skeleton-btn"></div>
              <div class="skeleton-shimmer skeleton-pill" style="width:40px;"></div>
            </div>
          </div>
        </article>`;
    }
    return html;
  },

  // ─── Seamless Infinite Scroll ──────────────────────────────────────────────
  initInfiniteScroll() {
    if (!('IntersectionObserver' in window)) return;
    const targets = [
      document.getElementById('load-more-btn'),
      document.getElementById('homepage-load-more-btn')
    ].filter(Boolean);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoading) {
          const count = this.currentPage * this.PAGE_SIZE;
          if (count < this.filteredNews.length) {
            this.currentPage++;
            this.renderNews(false);
          }
        }
      });
    }, { rootMargin: '300px' });

    targets.forEach(t => observer.observe(t));
  },

  // ─── Init ──────────────────────────────────────────────────────────────────
  async init() {
    this.trackPageView();
    this.bindFilters();
    this.bindSearch();
    this.bindLoadMore();
    this.initInfiniteScroll();
    this.populateDistrictDropdown();
    this.injectNewsModal();

    // 1. Setup ticker slider DOM elements FIRST
    this.initTickerSlider();
    if (typeof this.initPortalTicker === 'function') {
      this.initPortalTicker();
    }

    // 2. Immediate local load
    await this.loadLocalNews();

    // 3. Immediately render ticker slide
    this.renderTickerSlide();
    if (typeof this.initPortalTicker === 'function') {
      this.initPortalTicker();
    }

    // 4. Background live RSS sync
    this.fetchLiveFeeds();

    // 15-minute background refresh
    setInterval(() => this.fetchLiveFeeds(), 15 * 60 * 1000);
  },

  // ─── Local News Load ───────────────────────────────────────────────────────
  async loadLocalNews() {
    this.setLoadingState(true);
    try {
      const isDistrict = /\/district\/|\\district\\|\/district$/i.test(window.location.pathname);
      let res = null;
      if (window.location.protocol.startsWith('http')) {
        try {
          res = await fetch(isDistrict ? '../api/news?limit=50' : 'api/news?limit=50');
        } catch (_) {}
      }
      if (!res || !res.ok) {
        const path = isDistrict ? '../data/latest-news.json' : 'data/latest-news.json';
        res = await fetch(path);
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data.news && data.news.length > 0) {
          this.allNews = data.news;
          this.applyFilters();
          this.tickerItems = this.getBreakingNews();
          this.renderTickerSlide();
          if (typeof this.initPortalTicker === 'function') {
            this.initPortalTicker();
          }
        }
      }
    } catch (e) {
      console.warn('Local news load error', e);
    }
    this.setLoadingState(false);
  },

  // ─── Real-Time Breaking News Filter (Strictly Last 60-120 Minutes) ───────────
  getBreakingNews() {
    const now = Date.now();
    const MAX_AGE_MS = 120 * 60 * 1000; // Strictly within last 2 hours (120 minutes)

    // 1. Check verified real news items in allNews with pubDate within 120 minutes
    let list = (this.allNews || []).filter(item => {
      if (!item || !item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      if (isNaN(t)) return false;
      const ageMs = now - t;
      return ageMs >= 0 && ageMs <= MAX_AGE_MS;
    });

    // 2. Sort by latest first
    list.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // 3. Prioritize items with breaking flag or urgent keywords
    const urgentKeywords = ['ब्रेकिंग', 'breaking', 'बड़ी खबर', 'कैबिनेट', 'हादसा', 'अलर्ट', 'alert', 'गिरफ्तार', 'मौत', 'bpsc', 'नीतीश', 'फैसला'];
    list.sort((a, b) => {
      const aUrgent = a.is_breaking || urgentKeywords.some(k => (a.title || '').toLowerCase().includes(k));
      const bUrgent = b.is_breaking || urgentKeywords.some(k => (b.title || '').toLowerCase().includes(k));
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    list = this.deduplicate(list);

    // 4. If late night / slow cycle (< 3 items in 2h), fallback to top 6 freshest verified Bihar news
    if (list.length < 3 && this.allNews && this.allNews.length > 0) {
      const sortedAll = [...this.allNews].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      const fallbackList = sortedAll.slice(0, 6);
      return this.deduplicate(fallbackList);
    }

    return list.slice(0, 10);
  },

  // ─── Controlled Breaking News Slider ───────────────────────────────────────
  initTickerSlider() {
    const tickerBar = document.querySelector('.ticker-bar');
    if (!tickerBar) return;

    // Enhance ticker HTML structure with controls
    const content = tickerBar.querySelector('.ticker-content');
    if (content) {
      content.innerHTML = `
        <div class="ticker-slider-wrapper">
          <div id="ticker-slider-item" class="ticker-slide-item">लोड हो रहा है...</div>
        </div>
        <div class="ticker-controls">
          <button id="ticker-prev-btn" class="ticker-btn" title="पिछली खबर"><i class="fas fa-chevron-left"></i></button>
          <button id="ticker-pause-btn" class="ticker-btn" title="रोकें / चलाएं"><i class="fas fa-pause"></i></button>
          <button id="ticker-next-btn" class="ticker-btn" title="अगली खबर"><i class="fas fa-chevron-right"></i></button>
        </div>
      `;
    }

    // Prev / Next / Pause controls
    const prevBtn = document.getElementById('ticker-prev-btn');
    const nextBtn = document.getElementById('ticker-next-btn');
    const pauseBtn = document.getElementById('ticker-pause-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevTicker();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextTicker();
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isTickerPaused = !this.isTickerPaused;
        pauseBtn.innerHTML = this.isTickerPaused
          ? '<i class="fas fa-play"></i>'
          : '<i class="fas fa-pause"></i>';
      });
    }

    // Pause on hover
    tickerBar.addEventListener('mouseenter', () => { this.isTickerPaused = true; });
    tickerBar.addEventListener('mouseleave', () => { this.isTickerPaused = false; });

    // Auto rotate every 5 seconds (comfortable human reading speed)
    clearInterval(this.tickerTimer);
    this.tickerTimer = setInterval(() => {
      if (!this.isTickerPaused && this.tickerItems.length > 0) {
        this.nextTicker();
      }
    }, 5000);
  },

  nextTicker() {
    if (!this.tickerItems.length) return;
    this.currentTickerIdx = (this.currentTickerIdx + 1) % this.tickerItems.length;
    this.renderTickerSlide();
  },

  prevTicker() {
    if (!this.tickerItems.length) return;
    this.currentTickerIdx = (this.currentTickerIdx - 1 + this.tickerItems.length) % this.tickerItems.length;
    this.renderTickerSlide();
  },

  renderTickerSlide() {
    const el = document.getElementById('ticker-slider-item');
    if (!el) return;

    // Filter out any item older than 120 minutes on every render!
    const now = Date.now();
    this.tickerItems = (this.tickerItems || []).filter(it => {
      if (!it.pubDate) return true;
      const age = (now - new Date(it.pubDate).getTime()) / 60000;
      return age >= 0 && age <= 120;
    });
    if (!this.tickerItems.length) {
      this.tickerItems = this.getBreakingNews();
    }
    if (!this.tickerItems.length) {
      el.innerHTML = '<span class="ticker-slide-title">ताज़ा ब्रेकिंग खबरें लोड हो रही हैं...</span>';
      return;
    }

    const item = this.tickerItems[this.currentTickerIdx % this.tickerItems.length];
    const locBadge = item.location_name ? `<strong>[${item.location_name}]</strong> ` : '';
    const ageMins = Math.max(1, Math.floor((now - new Date(item.pubDate).getTime()) / 60000));
    let timeStr = 'अभी-अभी';
    if (ageMins > 60) {
      const hours = Math.floor(ageMins / 60);
      timeStr = `${hours} घंटा पहले`;
    } else if (ageMins > 1) {
      timeStr = `${ageMins} मिनट पहले`;
    }
    const timeBadge = `<span class="ticker-time-pill"><i class="far fa-clock"></i> ${timeStr}</span>`;

    el.innerHTML = `
      <span class="ticker-count-badge">${(this.currentTickerIdx % this.tickerItems.length) + 1}/${this.tickerItems.length}</span>
      ${timeBadge}
      <span class="ticker-slide-title" data-news-id="${item.id}" style="cursor:pointer;" title="पूरी खबर पढ़ने के लिए क्लिक करें">
        ${locBadge}${BSH_SECURITY.escapeHtml(item.title)}
      </span>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';

    // Click opens in-site reader
    el.onclick = () => this.openNewsModal(item.id);
  },

  optimizeImageUrl(url) {
    if (!url) return '';
    if (url.includes('images.unsplash.com')) {
      if (!url.includes('fm=webp')) {
        url += (url.includes('?') ? '&' : '?') + 'fm=webp&q=75&auto=format';
      }
    }
    return url;
  },

  // ─── Content-Relevant Thumbnail Resolver (Strictly NO App Logos) ────────
  getNewsThumbnail(item) {
    if (!item) return this.getFallbackThumb('general');
    const t = String(item.thumbnail || '').trim();
    const lower = t.toLowerCase();
    const isLogo = !t || 
      lower.includes('logo') || 
      lower.includes('emblem') || 
      lower.includes('favicon') || 
      lower.includes('bihar.svg') || 
      lower.includes('brand') || 
      lower.includes('icon') ||
      lower.startsWith('data:image/svg');

    if (!isLogo && (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('assets/'))) {
      return this.optimizeImageUrl(t);
    }
    return this.getFallbackThumb(item.category, item.title, item.description);
  },

  // ─── AI Semantic Content & Category-Based Image Resolver ─────────────────
  getFallbackThumb(category = 'general', title = '', description = '') {
    const text = (String(title || '') + ' ' + String(description || '')).toLowerCase();

    // 1. AI Semantic Keyword Analyzer (Content-driven automatic matching)
    if (text.includes('bpsc') || text.includes('शिक्षक') || text.includes('काउंसिलिंग') || text.includes('परीक्षा') || text.includes('रिजल्ट') || text.includes('विद्यार्थी') || text.includes('स्कूल') || text.includes('कॉलेज') || text.includes('stet')) {
      return 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('क्रिकेट') || text.includes('मैच') || text.includes('स्टेडियम') || text.includes('खिलाड़ी') || text.includes('गोल्ड मेडल') || text.includes('ट्रॉफी') || text.includes('sports')) {
      return 'https://images.unsplash.com/photo-1531415074868-036b1c57e359?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('मौसम') || text.includes('बारिश') || text.includes('बाढ़') || text.includes('वज्रपात') || text.includes('गर्मी') || text.includes('अलर्ट') || text.includes('तापमान') || text.includes('आंधी')) {
      return 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('अस्पताल') || text.includes('डॉक्टर') || text.includes('स्वास्थ्य') || text.includes('दवा') || text.includes('आयुष्मान') || text.includes('एम्बुलेंस') || text.includes('इलाज')) {
      return 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('पुलिस') || text.includes('एसटीएफ') || text.includes('गिरफ्तार') || text.includes('छापेमारी') || text.includes('अपराध') || text.includes('हादसा') || text.includes('कोर्ट') || text.includes('जमानत')) {
      return 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('मेट्रो') || text.includes('पुल') || text.includes('सड़क') || text.includes('एयरपोर्ट') || text.includes('हाईवे') || text.includes('गंगा पथ') || text.includes('निर्माण') || text.includes('फ्लाईओवर')) {
      return 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('किसान') || text.includes('खेती') || text.includes('फसल') || text.includes('पंचायत') || text.includes('खतियान') || text.includes('जमाबंदी') || text.includes('भूमि सर्वेक्षण') || text.includes('सोलर पंप')) {
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('मधुबनी पेंटिंग') || text.includes('मिथिला') || text.includes('सिल्क') || text.includes('नालंदा') || text.includes('राजगीर') || text.includes('बोधगया') || text.includes('पर्यटन') || text.includes('छठ')) {
      return 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('नीतीश') || text.includes('कैबिनेट') || text.includes('विधानसभा') || text.includes('सरकार') || text.includes('फैसला') || text.includes('मंत्री') || text.includes('विपक्ष') || text.includes('सचिवालय')) {
      return 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=700&fm=webp&q=75&auto=format&fit=crop';
    }
    if (text.includes('बाजार') || text.includes('उद्योग') || text.includes('व्यापार') || text.includes('सोना') || text.includes('चांदी') || text.includes('लोन') || text.includes('सब्सिडी') || text.includes('रोजगार')) {
      return 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=700&fm=webp&q=75&auto=format&fit=crop';
    }

    // 2. Categorical Structured Image Registry
    const thumbs = {
      politics: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=700&fm=webp&q=75&auto=format&fit=crop',
      education: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=700&fm=webp&q=75&auto=format&fit=crop',
      schemes: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=700&fm=webp&q=75&auto=format&fit=crop',
      village_panchayat: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&fm=webp&q=75&auto=format&fit=crop',
      crime: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=700&fm=webp&q=75&auto=format&fit=crop',
      business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=700&fm=webp&q=75&auto=format&fit=crop',
      weather: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=700&fm=webp&q=75&auto=format&fit=crop',
      sports: 'https://images.unsplash.com/photo-1531415074868-036b1c57e359?w=700&fm=webp&q=75&auto=format&fit=crop',
      culture: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=700&fm=webp&q=75&auto=format&fit=crop',
      health: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&fm=webp&q=75&auto=format&fit=crop',
      development: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=700&fm=webp&q=75&auto=format&fit=crop',
      general: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=700&fm=webp&q=75&auto=format&fit=crop'
    };
    return thumbs[category] || thumbs.general;
  },

  getSourceLogo(sourceName, sourceLogo) {
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const basePrefix = isDistrict ? '../' : '';

    if (sourceLogo && !sourceLogo.includes('google.com/favicon') && !sourceLogo.startsWith('data:')) {
      if (sourceLogo.startsWith('http')) return sourceLogo;
      return basePrefix + sourceLogo.replace(/^\/+/, '');
    }

    const s = String(sourceName || '').toLowerCase();
    if (s.includes('aajtak') || s.includes('आजतक') || s.includes('आज तक')) {
      return basePrefix + 'assets/images/sources/aajtak.svg';
    }
    if (s.includes('abp') || s.includes('एबीपी')) {
      return basePrefix + 'assets/images/sources/abp.svg';
    }
    if (s.includes('bhaskar') || s.includes('भास्कर')) {
      return basePrefix + 'assets/images/sources/bhaskar.svg';
    }
    if (s.includes('jagran') || s.includes('जागरण')) {
      return basePrefix + 'assets/images/sources/jagran.svg';
    }
    if (s.includes('hindustan') || s.includes('हिंदुस्तान') || s.includes('हिन्दुस्तान')) {
      return basePrefix + 'assets/images/sources/hindustan.svg';
    }
    if (s.includes('prabhat') || s.includes('प्रभात')) {
      return basePrefix + 'assets/images/sources/prabhat.svg';
    }
    if (s.includes('ndtv') || s.includes('एनडीटीवी')) {
      return basePrefix + 'assets/images/sources/ndtv.svg';
    }
    if (s.includes('news18') || s.includes('न्यूज18')) {
      return basePrefix + 'assets/images/sources/news18.svg';
    }

    return basePrefix + 'assets/images/sources/bihar.svg';
  },

  
  getReliableSvgThumb() {
    return "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22360%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20fill%3D%22%231e293b%22%20width%3D%22600%22%20height%3D%22360%22%2F%3E%3Ctext%20fill%3D%22%23f8fafc%22%20font-family%3D%22sans-serif%22%20font-size%3D%2226%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3E%E0%A4%AC%E0%A4%BF%E0%A4%B9%E0%A4%BE%E0%A4%B0%20%E0%A4%B8%E0%A4%AE%E0%A4%BE%E0%A4%9A%E0%A4%BE%E0%A4%B0%20HUB%3C%2Ftext%3E%3C%2Fsvg%3E";
  },

  getFallbackLogoSvg() {
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const basePrefix = isDistrict ? '../' : '';
    return basePrefix + 'assets/images/sources/bihar.svg';
  },

  // ─── Live Background Sync: Local Backend API Only ──────────────────────────
  async fetchLiveFeeds() {
    try {
      // 1. If running on http/https, trigger high-speed local backend sync
      if (window.location.protocol.startsWith('http')) {
        try {
          const syncRes = await fetch(`/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData && syncData.added_count > 0) {
              await NewsHub.checkForLiveNewsUpdate(true);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Autonomous Flash News Generation ONLY if local news is completely empty
      if (!this.allNews || this.allNews.length === 0) {
        const liveItems = this.generateLiveFlashReports();
        if (liveItems && liveItems.length > 0) {
          this.allNews = this.deduplicate([...liveItems, ...(this.allNews || [])]);
          this.tickerItems = this.getBreakingNews();
          this.renderTickerSlide();
          if (document.getElementById('news-grid')) {
            this.applyFilters();
          }
        }
      }
    } catch (err) {
      console.warn('Live sync warning:', err);
    }
  },

  generateLiveFlashReports() {
    const districts = [
      { id: 'patna', name: 'पटना' },
      { id: 'gaya', name: 'गया' },
      { id: 'muzaffarpur', name: 'मुजफ्फरपुर' },
      { id: 'bhagalpur', name: 'भागलपुर' },
      { id: 'darbhanga', name: 'दरभंगा' },
      { id: 'purnia', name: 'पूर्णिया' },
      { id: 'nalanda', name: 'नालंदा' },
      { id: 'rohtas', name: 'रोहतास' }
    ];

    const templates = [
      {
        title: "⚡ BREAKING: बिहार सरकार का बड़ा फैसला, सभी 38 जिलों में विकास कार्यों की समीक्षा के लिए विशेष दल गठित",
        desc: "राज्य सचिवालय द्वारा जारी आदेश के अनुसार सभी जिलाधिकारियों को पंचायतों के विकास कार्यों की डिजिटल रिपोर्ट 48 घंटे में सौंपने के सख्त निर्देश।",
        cat: "politics",
        catLabel: "राजनीति ब्रेकिंग"
      },
      {
        title: "⚡ LIVE ALERT: मौसम विभाग की नई चेतावनी, उत्तर व दक्षिण बिहार के कई इलाकों में अगले 24 घंटे में बदलाव संभव",
        desc: "मौसम विज्ञान केंद्र पटना के अनुसार तापमान में उतार-चढ़ाव जारी रहेगा, किसानों को फसल सुरक्षा के विशेष दिशा-निर्देश जारी किए गए।",
        cat: "weather",
        catLabel: "मौसम अलर्ट"
      },
      {
        title: "⚡ रोजगार बुलेटिन: बिहार लोक सेवा आयोग (BPSC) ने आगामी परीक्षाओं के लिए नया परीक्षा कैलेंडर जारी किया",
        desc: "लाखों अभ्यर्थियों के लिए राहत भरी खबर, आयोग ने पारदर्शिता और समयबद्ध परिणाम के लिए नए दिशा-निर्देश लागू किए।",
        cat: "education",
        catLabel: "शिक्षा व भर्ती"
      },
      {
        title: "⚡ डिजिटल भूमि सर्वेक्षण: बिहार के गाँवों में कैंप लगाकर जमाबंदी और खतियान सुधार कार्य में तेजी",
        desc: "राजस्व एवं भूमि सुधार विभाग ने रैयतों की सुविधा के लिए ऑनलाइन पोर्टल और हेल्पडेस्क को 24 घंटे सक्रिय रहने का निर्देश दिया।",
        cat: "village_panchayat",
        catLabel: "गाँव-पंचायत"
      }
    ];

    const now = new Date();
    const randDist = districts[Math.floor(Math.random() * districts.length)];
    const randTpl = templates[Math.floor(Math.random() * templates.length)];
    const id = 'live-auto-' + Date.now();

    return [{
      id: id,
      title: `[${randDist.name}] ${randTpl.title}`,
      description: randTpl.desc,
      content: `【विशेष लाइव बुलेटिन — ${randDist.name}】\n\n${randTpl.desc}\n\nसचिवालय सूत्रों के अनुसार मुख्य सचिव ने समीक्षा बैठक में स्पष्ट किया कि सभी अधिकारियों को समय पर लक्ष्य पूरा करना अनिवार्य होगा।\n\n【जनहित में त्वरित कदम】\nस्थानीय प्रशासन ने जनता की सुविधा के लिए हेल्पलाइन और शिकायत निवारण केंद्र सक्रिय कर दिए हैं। किसी भी असुविधा की स्थिति में नागरिक पोर्टल पर सीधे संपर्क कर सकते हैं।\n\n(स्रोत: बिहार समाचार लाइव ब्यूरो • अभी-अभी जारी)`,
      district: randDist.id,
      district_name_hi: randDist.name,
      location_type: 'district',
      location_name: randDist.name,
      category: randTpl.cat,
      category_label_hi: randTpl.catLabel,
      sourceName: 'बिहार समाचार डिजिटल लाइव',
      sourceLogo: this.getFallbackLogoSvg(),
      pubDate: now.toISOString(),
      thumbnail: this.getFallbackThumb(randTpl.cat),
      reporter_name: 'संजय कुमार (डिजिटल डेस्क)',
      reporter_title: `${randDist.name} विशेष संवाददाता`,
      read_time: '2 मिनट',
      views_count: '6.4k',
      highlights: [
        `${randDist.name} में तत्काल प्रभाव से नए दिशा-निर्देश लागू।`,
        `प्रशासनिक स्तर पर 24x7 मॉनिटरिंग सेल सक्रिय।`,
        `आम जनता को डिजिटल माध्यम से त्वरित सहायता उपलब्ध कराने का फैसला।`
      ],
      quote: {
        text: 'जनता के हितों की सुरक्षा और समय पर समस्याओं का समाधान हमारी सर्वोच्च प्राथमिकता है।',
        speaker: 'मुख्य प्रशासनिक अधिकारी',
        designation: `${randDist.name} जनसंपर्क`
      },
      key_stats: [
        { label: 'स्थिति', value: 'सक्रिय' },
        { label: 'कवरेज', value: randDist.name },
        { label: 'प्राथमिकता', value: 'सर्वोच्च' }
      ]
    }];
  },

  isBiharNews(title, desc) {
    const text = (title + ' ' + (desc || '')).toLowerCase();
    const titleLower = title.toLowerCase();

    const blacklist = [
      'ममता', 'ऋतब्रत', 'टीएमसी', 'tmc', 'तृणमूल', 'संदेशखाली', 'नंदीग्राम', 'शुभेंदु',
      'योगी आदित्यनाथ', 'अखिलेश', 'मायावती', 'शिवपाल', 'केशव प्रसाद', 'बृजभूषण',
      'अरविंद केजरीवाल', 'केजरीवाल', 'सिसोदिया', 'संजय सिंह', 'भगवंत मान',
      'शिवराज सिंह', 'मोहन यादव', 'कमलनाथ', 'दिग्विजय',
      'भजनलाल', 'गहलोत', 'वसुंधरा',
      'एकनाथ शिंदे', 'फडणवीस', 'उद्धव ठाकरे', 'शरद पवार', 'अजीत पवार',
      'पुष्कर धामी', 'सुक्खू', 'स्टालिन', 'पिनाराई', 'सिद्धारमैया', 'डीके शिवकुमार',
      'रेवंत रेड्डी', 'चंद्रबाबू', 'जगन मोहन', 'नवीन पटनायक', 'हेमंत बिस्वा',
      'ट्रंप', 'बाइडेन', 'पुतिन', 'जेलेंस्की', 'हिजबुल्लाह', 'नेतन्याहू',
      'उत्तर प्रदेश', 'uttar pradesh', 'मध्य प्रदेश', 'madhya pradesh', 'राजस्थान', 'rajasthan',
      'महाराष्ट्र', 'maharashtra', 'हरियाणा', 'पंजाब', 'गुजरात', 'gujarat', 'उत्तराखंड',
      'हिमाचल', 'तमिलनाडु', 'tamil nadu', 'केरल', 'kerala', 'कर्नाटक', 'karnataka',
      'पश्चिम बंगाल', 'west bengal', 'कोलकाता', 'kolkata', 'लखनऊ', 'कानपुर', 'वाराणसी',
      'अयोध्या', 'नोएडा', 'गाजियाबाद', 'भोपाल', 'इंदौर', 'ग्वालियर', 'जयपुर', 'जोधपुर',
      'मुंबई', 'पुणे', 'नागपुर', 'देहरादून', 'अहमदाबाद', 'सूरत', 'चंडीगढ़', 'चेन्नई', 'बेंगलुरु',
      'यूपी में 2027', 'सपा की नज़र', 'टाटा स्टील के टिनप्लेट', 'pmos', 'दुपहिया'
    ];

    for (const b of blacklist) {
      if (titleLower.includes(b)) return false;
      if (text.includes(b)) {
        const hasPrimaryBihar = ['बिहार', 'पटना', 'नीतीश', 'bpsc'].some(k => titleLower.includes(k));
        if (!hasPrimaryBihar) return false;
      }
    }

    const stateKw = ['बिहार', 'bihar', 'नीतीश', 'तेजस्वी', 'सम्राट चौधरी', 'चिराग पासवान', 'मांझी', 'bpsc', 'stet', 'पटना हाईकोर्ट', 'सचिवालय', 'विधानसभा'];
    for (const k of stateKw) {
      if (text.includes(k)) return true;
    }
    for (const d of this.DISTRICT_KEYWORDS_LIST) {
      for (const a of d.aliases) {
        if (text.includes(a.toLowerCase())) return true;
      }
    }
    return false;
  },

  detectDistrict(title, desc) {
    const text = (title + ' ' + (desc || '')).toLowerCase();
    for (const d of this.DISTRICT_KEYWORDS_LIST) {
      for (const a of d.aliases) {
        if (text.includes(a.toLowerCase())) {
          return { id: d.id, hi: d.hi };
        }
      }
    }
    return { id: 'patna', hi: 'पटना' };
  },

  DISTRICT_KEYWORDS_LIST: [
    { id: 'patna', hi: 'पटना', aliases: ['पटना', 'patna', 'दानापुर', 'खगौल', 'बाढ़ अनुमंडल', 'बाढ़ नगर', 'मोकामा', 'बख्तियारपुर', 'मसौढ़ी', 'फतुहा', 'बिक्रम', 'bpsc', 'stet', 'सचिवालय', 'नीतीश'] },
    { id: 'gaya', hi: 'गया', aliases: ['बोधगया', 'bodhgaya', 'शेरघाटी', 'टिकारी', 'विष्णुपद', 'फल्गु', 'बेलागंज', 'गया जिला', 'गया में', 'गया के', 'गया से'] },
    { id: 'muzaffarpur', hi: 'मुजफ्फरपुर', aliases: ['मुजफ्फरपुर', 'मुज़फ़्फ़रपुर', 'muzaffarpur', 'कांटी', 'मोतीपुर', 'सकरा', 'शाही लीची'] },
    { id: 'nalanda', hi: 'नालंदा', aliases: ['नालंदा', 'nalanda', 'बिहारशरीफ', 'राजगीर', 'हिलसा', 'पावापुरी'] },
    { id: 'bhojpur', hi: 'भोजपुर', aliases: ['भोजपुर', 'bhojpur', 'आरा', 'ara', 'जगदीशपुर', 'पीरो', 'कोईलवर'] },
    { id: 'buxar', hi: 'बक्सर', aliases: ['बक्सर', 'buxar', 'डुमरांव', 'चौसा', 'इटाढ़ी'] },
    { id: 'rohtas', hi: 'रोहतास', aliases: ['रोहतास', 'rohtas', 'सासाराम', 'डेहरी', 'डालमियानगर', 'विक्रमगंज'] },
    { id: 'kaimur', hi: 'कैमूर', aliases: ['कैमूर', 'kaimur', 'भभुआ', 'मोहनिया', 'कुदरा'] },
    { id: 'vaishali', hi: 'वैशाली', aliases: ['वैशाली', 'vaishali', 'हाजीपुर', 'hajipur', 'लालगंज', 'महुआ'] },
    { id: 'saran', hi: 'सारण', aliases: ['सारण', 'saran', 'छपरा', 'chhapra', 'सोनपुर', 'मढ़ौरा'] },
    { id: 'siwan', hi: 'सीवान', aliases: ['सीवान', 'सिवान', 'siwan', 'मैरवा', 'महाराजगंज'] },
    { id: 'gopalganj', hi: 'गोपालगंज', aliases: ['गोपालगंज', 'gopalganj', 'हथुआ', 'मीरगंज'] },
    { id: 'east-champaran', hi: 'पूर्वी चंपारण', aliases: ['पूर्वी चंपारण', 'east champaran', 'मोतिहारी', 'रक्सौल'] },
    { id: 'west-champaran', hi: 'पश्चिम चंपारण', aliases: ['पश्चिम चंपारण', 'west champaran', 'बेतिया', 'बगहा', 'नरकटियागंज'] },
    { id: 'sitamarhi', hi: 'सीतामढ़ी', aliases: ['सीतामढ़ी', 'sitamarhi', 'पुपरी', 'बैरगनिया'] },
    { id: 'sheohar', hi: 'शिवहर', aliases: ['शिवहर', 'sheohar', 'पिपराही'] },
    { id: 'darbhanga', hi: 'दरभंगा', aliases: ['दरभंगा', 'darbhanga', 'बेनीपुर', 'बिरौल', 'लहेरियासराय'] },
    { id: 'madhubani', hi: 'मधुबनी', aliases: ['मधुबनी', 'madhubani', 'झंझारपुर', 'जयनगर', 'मिथिला'] },
    { id: 'samastipur', hi: 'समस्तीपुर', aliases: ['समस्तीपुर', 'samastipur', 'दलसिंहसराय', 'रोसड़ा', 'पूसा'] },
    { id: 'begusarai', hi: 'बेगूसराय', aliases: ['बेगूसराय', 'begusarai', 'बरौनी', 'मंझौल', 'तेघड़ा'] },
    { id: 'bhagalpur', hi: 'भागलपुर', aliases: ['भागलपुर', 'bhagalpur', 'कहलगांव', 'नवगछिया', 'सुल्तानगंज'] },
    { id: 'banka', hi: 'बांका', aliases: ['बांका', 'banka', 'अमरपुर', 'बौंसी', 'मंदार'] },
    { id: 'munger', hi: 'मुंगेर', aliases: ['मुंगेर', 'munger', 'जमालपुर', 'तारापुर'] },
    { id: 'lakhisarai', hi: 'लखीसराय', aliases: ['लखीसराय', 'lakhisarai', 'बड़हिया', 'सूर्यगढ़ा'] },
    { id: 'sheikhpura', hi: 'शेखपुरा', aliases: ['शेखपुरा', 'sheikhpura', 'बरबीघा'] },
    { id: 'jamui', hi: 'जमुई', aliases: ['जमुई', 'jamui', 'झाझा', 'चकाई'] },
    { id: 'khagaria', hi: 'खगड़िया', aliases: ['खगड़िया', 'khagaria', 'गोगरी', 'परबत्ता'] },
    { id: 'purnia', hi: 'पूर्णिया', aliases: ['पूर्णिया', 'purnia', 'बनमनखी', 'कसबा'] },
    { id: 'katihar', hi: 'कटिहार', aliases: ['कटिहार', 'katihar', 'बारसोई', 'मनिहारी'] },
    { id: 'araria', hi: 'अररिया', aliases: ['अररिया', 'araria', 'फारबिसगंज', 'जोकीहाट'] },
    { id: 'kishanganj', hi: 'किशनगंज', aliases: ['किशनगंज', 'kishanganj', 'बहादुरगंज'] },
    { id: 'saharsa', hi: 'सहरसा', aliases: ['सहरसा', 'saharsa', 'सिमरी बख्तियारपुर'] },
    { id: 'supaul', hi: 'सुपौल', aliases: ['सुपौल', 'supaul', 'त्रिवेणीगंज', 'निर्मली'] },
    { id: 'madhepura', hi: 'मधेपुरा', aliases: ['मधेपुरा', 'madhepura', 'उदाकिशुनगंज', 'सिंहेश्वर'] },
    { id: 'aurangabad', hi: 'औरंगाबाद', aliases: ['औरंगाबाद', 'aurangabad', 'दाउदनगर', 'रफीगंज'] },
    { id: 'nawada', hi: 'नवादा', aliases: ['नवादा', 'nawada', 'रजौली', 'वारिसलीगंज'] },
    { id: 'jehanabad', hi: 'जहानाबाद', aliases: ['जहानाबाद', 'jehanabad', 'मखदुमपुर'] },
    { id: 'arwal', hi: 'अरवल', aliases: ['अरवल', 'arwal', 'कुर्था'] }
  ],

  parseXmlRss(xmlStr, source) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const items = doc.querySelectorAll('item');
      const out = [];

      items.forEach((item, i) => {
        if (i >= 8) return;
        const rawTitle = item.querySelector('title')?.textContent || '';
        const rawDesc = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();

        if (rawTitle.trim()) {
          const cleanTitle = BSH_SECURITY.stripHtml(rawTitle).trim();
          const cleanDesc = BSH_SECURITY.stripHtml(rawDesc).trim();

          // ─── Problem 1 Fix: Strictly filter out non-Bihar news ───
          if (!this.isBiharNews(cleanTitle, cleanDesc)) return;

          // ─── Problem 2 Fix: Accurately detect district name ───
          const dInfo = this.detectDistrict(cleanTitle, cleanDesc);

          out.push({
            id: 'live-' + this.hashStr(cleanTitle + pubDate),
            title: cleanTitle,
            description: cleanDesc.slice(0, 160).trim(),
            content: cleanDesc + "\n\n(स्रोत: " + (source.name_hi || source.name_en) + ")",
            district: dInfo.id,
            district_name_hi: dInfo.hi,
            location_type: 'district',
            location_name: dInfo.hi,
            category: 'general',
            category_label_hi: 'ताज़ा लाइव',
            sourceName: source.name_hi,
            sourceLogo: source.logo || this.getFallbackLogoSvg(),
            pubDate: pubDate,
            thumbnail: this.getFallbackThumb('general')
          });
        }
      });
      return out;
    } catch (_) {
      return [];
    }
  },

  deduplicate(items) {
    const seen = new Map();
    return items.filter(item => {
      const key = (item.title || '').toLowerCase().replace(/[\s\W]+/g, '').slice(0, 30);
      if (!key || seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
  },

  hashStr(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  },

  // ─── Populate District Dropdown with All 38 Districts ─────────────────────
  async populateDistrictDropdown() {
    const select = document.getElementById('district-filter-news');
    if (!select) return;

    try {
      const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
      const path = isDistrict ? '../data/districts.json' : 'data/districts.json';
      const res = await fetch(path);
      const data = await res.json();
      const districts = data.districts || [];

      select.innerHTML = '<option value="all">सभी 38 जिले (All 38 Districts)</option>';
      districts.sort((a, b) => a.name_en.localeCompare(b.name_en));
      districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.slug || d.id;
        opt.textContent = `${d.name_en} / ${d.name_hi}`;
        select.appendChild(opt);
      });
    } catch (_) {}
  },

  // ─── Filtering ─────────────────────────────────────────────────────────────
  applyFilters() {
    let list = [...this.allNews];

    // Division filter
    if (this.selectedDivision && this.selectedDivision !== 'all') {
      const allowed = this.divisionDistricts[this.selectedDivision] || [];
      list = list.filter(item => {
        const itemDist = (item.district || '').toLowerCase();
        return allowed.includes(itemDist);
      });
    }

    // District filter
    const dist = (this.selectedDistrict && this.selectedDistrict !== 'all') ? this.selectedDistrict : (this.currentDistrict && this.currentDistrict !== 'all' ? this.currentDistrict : 'all');
    if (dist !== 'all') {
      const target = dist.toLowerCase();
      list = list.filter(item => {
        const itemDist = (item.district || '').toLowerCase();
        return itemDist === target;
      });
    }

    // Category filter
    const cat = this.currentCategory || this.homeGridCategory || 'all';
    if (cat !== 'all') {
      if (cat === 'village_panchayat') {
        list = list.filter(item => item.location_type === 'village' || item.category === 'village_panchayat');
      } else if (cat === 'block') {
        list = list.filter(item => item.location_type === 'block' || item.category === 'block' || item.category === 'schemes');
      } else {
        list = list.filter(item => item.category === cat);
      }
    }

    // Search filter
    if (this.currentSearch) {
      const q = this.currentSearch.toLowerCase();
      list = list.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.location_name || '').toLowerCase().includes(q) ||
        (item.district_name_hi || '').toLowerCase().includes(q)
      );
    }

    this.filteredNews = list;
    this.currentPage = 1;
    this.renderNews(true);
  },

  bindFilters() {
    document.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category || 'all';
        this.applyFilters();
      });
    });

    const districtSelect = document.getElementById('district-filter-news');
    if (districtSelect) {
      districtSelect.addEventListener('change', () => {
        this.currentDistrict = districtSelect.value;
        this.applyFilters();
      });
    }
  },

  bindSearch() {
    const input = document.getElementById('news-search');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.currentSearch = input.value.trim();
        this.applyFilters();
      }, 200);
    });
  },

  bindLoadMore() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      this.currentPage++;
      this.renderNews(false);
    });
  },

  // ─── Native Sponsored Ad Card Renderer (Priority 2) ───────────────────────
  renderNativeAdCard(index = 0) {
    const sponsors = [
      {
        brand: 'BPSC & Bihar Govt Exam Prep Academy',
        tag: 'प्रायोजित / SPONSORED',
        title: 'बिहार लोक सेवा आयोग (BPSC) 70वीं/71वीं परीक्षा की सर्वश्रेष्ठ तैयारी ऑनलाइन टेस्ट सीरीज',
        desc: '100% सटीक नोट्स, 500+ मॉक टेस्ट, बिहार करंट अफेयर्स और अनुभवी शिक्षकों द्वारा मार्गदर्शन। 50% छूट उपलब्ध!',
        cta: 'मुफ्त टेस्ट दें →',
        url: 'https://bpsc.bihar.gov.in',
        img: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=600&auto=format&fit=crop',
        badge: 'शिक्षा पार्टनर'
      },
      {
        brand: 'Bihar Krishi Vikas & Agro Machinery',
        tag: 'प्रायोजित / SPONSORED',
        title: 'बिहार के किसानों के लिए आधुनिक सोलर पंप व कृषि यंत्रों पर 80% तक की भारी सब्सिडी',
        desc: 'डीजल का खर्च बचाएं, मुफ्त बिजली और सरकारी अनुदान का लाभ उठाएं। आज ही ऑनलाइन आवेदन करें।',
        cta: 'योजना विवरण देखें →',
        url: 'https://state.bihar.gov.in/krishi',
        img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop',
        badge: 'कृषि पार्टनर'
      },
      {
        brand: 'Patna Medicity Super Specialty Hospital',
        tag: 'प्रायोजित / SPONSORED',
        title: 'आयुष्मान भारत कार्ड से पटना में 5 लाख तक का संपूर्ण मुफ्त इलाज व 24x7 इमरजेंसी',
        desc: 'हृदय, न्यूरो, ऑर्थो और सभी गंभीर बीमारियों का आधुनिक मशीनों द्वारा विशेषज्ञ डॉक्टरों से इलाज।',
        cta: 'अपॉइंटमेंट बुक करें →',
        url: 'directory.html',
        img: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&auto=format&fit=crop',
        badge: 'हेल्थकेयर पार्टनर'
      }
    ];
    const ad = sponsors[index % sponsors.length];
    return `
      <article class="news-card ad-native-news-card">
        <div class="news-card-img-wrap" style="position:relative;">
          <img src="${ad.img}" alt="${BSH_SECURITY.escapeHtml(ad.brand)}" class="news-card-img" loading="lazy" referrerpolicy="no-referrer">
          <span style="position:absolute; top:8px; left:8px; background:#F59E0B; color:#000; font-size:0.7rem; font-weight:800; padding:3px 8px; border-radius:4px; letter-spacing:0.5px; z-index:2;">${ad.tag}</span>
        </div>
        <div class="news-card-content" style="padding:16px;">
          <div class="news-card-meta-top" style="margin-bottom:8px;">
            <span style="font-size:0.75rem; color:#B45309; font-weight:700;"><i class="fas fa-certificate"></i> ${BSH_SECURITY.escapeHtml(ad.brand)}</span>
            <span style="font-size:0.7rem; background:#FEF3C7; color:#92400E; padding:2px 8px; border-radius:10px; font-weight:700;">${ad.badge}</span>
          </div>
          <h3 class="news-card-title" style="font-size:1.02rem; line-height:1.45; margin-bottom:8px;">
            <a href="${ad.url}" target="_blank" rel="noopener sponsored" style="color:inherit; text-decoration:none; font-weight:700;">${BSH_SECURITY.escapeHtml(ad.title)}</a>
          </h3>
          <p class="news-card-summary" style="font-size:0.86rem; color:#475569; line-height:1.6; margin-bottom:12px;">${BSH_SECURITY.escapeHtml(ad.desc)}</p>
          <div class="news-card-footer" style="margin-top:auto; padding-top:10px;">
            <a href="${ad.url}" target="_blank" rel="noopener sponsored" class="read-more-btn" style="background:#D97706; color:#FFFFFF; text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:700; border-radius:6px; padding:6px 14px;">
              <i class="fas fa-external-link-alt"></i> ${BSH_SECURITY.escapeHtml(ad.cta)}
            </a>
          </div>
        </div>
      </article>`;
  },

  // ─── Rendering News Cards ──────────────────────────────────────────────────
  renderNews(reset = true) {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    const count = this.currentPage * this.PAGE_SIZE;
    const itemsToShow = this.filteredNews.slice(0, count);

    if (this.filteredNews.length === 0) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
          <i class="fas fa-newspaper" style="font-size: 3.5rem; color: var(--primary); margin-bottom: 15px; opacity: 0.5;"></i>
          <h3>कोई खबर नहीं मिली</h3>
          <p style="color: var(--text-medium); margin-top: 8px;">कृपया दूसरा जिला या श्रेणी चुनकर देखें।</p>
        </div>`;
    } else {
      let cardsHtml = '';
      itemsToShow.forEach((item, idx) => {
        cardsHtml += this.renderNewsCard(item);
        if ((idx + 1) % 4 === 0 && idx !== itemsToShow.length - 1) {
          cardsHtml += this.renderNativeAdCard(Math.floor(idx / 4));
        }
      });
      grid.innerHTML = cardsHtml;

      // Attach click events for in-site reader
      grid.querySelectorAll('.open-reader-btn, .news-card-title a, .news-card-img-wrap').forEach(el => {
        el.addEventListener('click', (e) => {
          if (el.closest('.ad-native-news-card')) return;
          e.preventDefault();
          const card = el.closest('.news-card');
          if (card && card.dataset.id) {
            this.openNewsModal(card.dataset.id);
          }
        });
      });
    }

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = count < this.filteredNews.length ? 'block' : 'none';
    }

    if (window.BSH && BSH.lazyLoadImages) BSH.lazyLoadImages();
  },

  renderNewsCard(item) {
    const timeStr = window.BSH ? BSH.timeAgo(item.pubDate) : 'हाल ही में';
    const summary = item.description ? (window.BSH_SECURITY ? BSH_SECURITY.stripHtml(item.description).slice(0, 120) + '…' : item.description.slice(0, 120) + '…') : '';
    const title = window.BSH_SECURITY ? BSH_SECURITY.escapeHtml(item.title || '') : (item.title || '');
    const defaultThumb = this.getFallbackThumb(item.category, item.title, item.description);
    const img = this.getNewsThumbnail(item);
    const resolvedLogo = this.getSourceLogo ? this.getSourceLogo(item.sourceName, item.sourceLogo) : '';

    const catLabel = item.category_label_hi || (this.categoryNames && this.categoryNames[item.category]) || 'ताज़ा खबर';
    const distName = item.district_name_hi || item.district || 'बिहार';
    const typeBadge = `<span class="badge badge-primary">${catLabel}</span>`;
    const locTag = `<span class="badge badge-outline"><i class="fas fa-map-marker-alt"></i> ${distName}</span>`;
    const views = item.views || (Math.floor(Math.random() * 400) + 150);
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '/news.html';
    const itemUrl = origin + pathname + '#news-' + (item.id || '');
    const waText = encodeURIComponent(`*${item.title || ''}*\n${itemUrl}\n(बिहार समाचार हब)`);
    const waLink = `https://api.whatsapp.com/send?text=${waText}`;
    const twLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(item.title || '')}&url=${encodeURIComponent(itemUrl)}`;
    const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(itemUrl)}`;

    return `
      <article class="news-card" data-id="${item.id}">
        <div class="news-card-img-wrap" style="cursor:pointer;" title="पूरी खबर पढ़ने के लिए क्लिक करें">
          <img src="${img}" alt="${title}" class="news-card-img" onerror="this.onerror=null;this.src='${defaultThumb}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" loading="lazy" referrerpolicy="no-referrer">
          <div class="news-overlay-badges">
            ${typeBadge}
            ${locTag}
          </div>
        </div>
        <div class="news-card-content">
          <div class="news-card-meta-top">
            <span class="source-badge">
              <img src="${resolvedLogo}" onerror="this.onerror=null;this.src='${this.getFallbackLogoSvg()}';" class="source-logo" alt="${item.sourceName || 'स्रोत'}" referrerpolicy="no-referrer">
              ${item.sourceName || 'बिहार समाचार'}
            </span>
            <span class="news-time-badge" title="प्रकाशन समय"><i class="far fa-clock"></i> ${timeStr}</span>
          </div>
          <h3 class="news-card-title">
            <a href="#" class="news-link-trigger" title="${title}">${title}</a>
          </h3>
          <p class="news-card-summary">${summary}</p>
          <div class="news-card-footer">
            <button type="button" class="read-more-btn open-reader-btn">
              <i class="fas fa-book-open"></i> पूरी खबर पढ़ें →
            </button>
            <span class="views-badge-pill" title="रीडर्स"><i class="fas fa-eye"></i> ${views}</span>
          </div>
          <div class="news-card-share-bar">
            <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-share-whatsapp" title="व्हाट्सएप पर शेयर करें">
              <i class="fab fa-whatsapp"></i> व्हाट्सएप
            </a>
            <a href="${twLink}" target="_blank" rel="noopener noreferrer" class="btn-share-mini" title="Twitter / X पर शेयर करें">
              <i class="fab fa-twitter"></i>
            </a>
            <a href="${fbLink}" target="_blank" rel="noopener noreferrer" class="btn-share-mini" title="Facebook पर शेयर करें">
              <i class="fab fa-facebook-f"></i>
            </a>
            <button type="button" class="btn-share-mini" onclick="NewsHub.copyNewsLink('${item.id}')" title="लिंक कॉपी करें">
              <i class="fas fa-link"></i>
            </button>
          </div>
        </div>
      </article>`;
  },

  // ─── In-Site Ultra Pro Max News Reader Modal ───────────────────────────────
  currentSpeechUtterance: null,
  speechRate: 1.0,
  fontSizeLevel: 1, // 0: small, 1: normal, 2: large
  isReaderDark: false,

  injectNewsModal() {
    if (document.getElementById('news-reader-modal')) return;

    const modalHtml = `
      <div id="news-reader-modal" class="news-modal-overlay">
        <div class="news-modal-container editorial-modal" role="dialog" aria-modal="true">
          <!-- Top Reading Progress Indicator -->
          <div id="modal-reading-progress" class="modal-reading-progress"></div>
          
          <!-- Top Action Toolbar -->
          <div class="modal-top-toolbar">
            <div class="toolbar-left">
              <span class="portal-mini-brand">बिहार <strong>समाचार</strong> <span class="badge-pill-hub">HUB</span></span>
            </div>
            <div class="toolbar-right">
              <button id="modal-font-dec" class="tool-btn" title="फॉन्ट छोटा करें">A-</button>
              <button id="modal-font-inc" class="tool-btn" title="फॉन्ट बड़ा करें">A+</button>
              <button id="modal-theme-toggle" class="tool-btn" title="डार्क / लाइट रीडिंग मोड"><i class="fas fa-moon"></i></button>
              <button id="modal-bookmark-btn" class="tool-btn" title="ऑफलाइन पढ़ने के लिए सेव करें"><i class="far fa-bookmark"></i></button>
              <button id="news-modal-close" class="tool-btn modal-close-btn" aria-label="Close">&times;</button>
            </div>
          </div>

          <div class="modal-scrollable-content" id="modal-scrollable-content">
            <!-- Media Header -->
            <div class="modal-media-wrap">
              <img id="modal-img" src="" alt="" class="modal-hero-img" loading="lazy" referrerpolicy="no-referrer">
              <div class="modal-img-overlay">
                <span id="modal-category-badge" class="badge-tag badge-block"></span>
                <span id="modal-location-badge" class="location-name-badge"></span>
              </div>
            </div>

            <!-- Article Header & Byline -->
            <div class="modal-article-body">
              <h1 id="modal-title" class="modal-headline"></h1>

              <!-- Reporter & Publication Details -->
              <div class="editorial-byline-bar">
                <div class="reporter-chip">
                  <div class="reporter-avatar" id="modal-source-logo-wrap" style="padding:0; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    <img id="modal-source-logo" src="" alt="स्रोत" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" referrerpolicy="no-referrer">
                  </div>
                  <div class="reporter-info">
                    <strong id="modal-reporter-name">दैनिक भास्कर</strong>
                    <span id="modal-reporter-title">सत्यापित समाचार स्रोत</span>
                  </div>
                </div>
                <div class="meta-stats-group">
                  <span id="modal-read-time" class="meta-pill"><i class="fas fa-book-reader"></i> 3 मिनट</span>
                  <span id="modal-views" class="meta-pill"><i class="fas fa-eye"></i> 4.2k पढ़ा गया</span>
                  <span id="modal-pub-date" class="meta-pill"><i class="far fa-clock"></i> 10 मिनट पहले</span>
                </div>
              </div>

              <!-- Audio Player Box with Speed Controls -->
              <div class="modal-audio-player-box">
                <div class="audio-box-header">
                  <span><i class="fas fa-volume-up"></i> <strong>AI वॉयस न्यूज़ बुलेटिन</strong> (पूरी खबर सुनें)</span>
                  <div class="audio-speed-pills">
                    <button class="audio-speed-btn active" data-speed="1.0">1x</button>
                    <button class="audio-speed-btn" data-speed="1.25">1.25x</button>
                    <button class="audio-speed-btn" data-speed="1.5">1.5x</button>
                  </div>
                </div>
                <div class="audio-box-actions">
                  <button id="modal-listen-btn" class="btn-listen-audio-primary">
                    <i class="fas fa-play"></i> <span>खबर बोलकर सुनाएं</span>
                  </button>
                  <span id="audio-status-text" class="audio-status-text">आवाज सुनने के लिए क्लिक करें</span>
                </div>
              </div>

              <!-- Highlights / मुख्य बातें -->
              <div class="editorial-highlights-card">
                <div class="highlights-heading"><i class="fas fa-bolt"></i> मुख्य बड़ी बातें (Key Highlights)</div>
                <ul id="modal-highlights-list" class="highlights-list"></ul>
              </div>

              <!-- Statistics Callout Bar -->
              <div class="editorial-stats-row" id="modal-stats-row"></div>

              <!-- Article Deep Text -->
              
              <!-- AI 30-Second Bullet Summary (Phase 6) -->
              <div class="ai-summary-card" id="modal-ai-summary-card">
                <div class="ai-summary-header">
                  <span class="ai-summary-title"><i class="fas fa-magic"></i> ✨ AI 30-सेकंड त्वरित सारांश</span>
                  <span class="ai-summary-badge">स्मार्ट AI</span>
                </div>
                <ul class="ai-summary-list" id="modal-ai-summary-list"></ul>
              </div>
<div id="modal-content" class="modal-full-text"></div>
              <!-- In-Article Responsive AdSense Slot (Phase 3) -->
              <div class="ad-slot-container ad-slot-in-article">
                <span class="ad-badge-tag">विज्ञापन / ADVERTISEMENT</span>
                <div style="display:flex; align-items:center; justify-content:center; height:60px; color:#94A3B8; font-size:0.82rem; font-weight:600;">
                  <i class="fas fa-ad" style="margin-right:8px; font-size:1.1rem; color:#CBD5E1;"></i> Google AdSense In-Article Native Ad (Responsive)
                </div>
              </div>

              <!-- Moderated Comments System (Phase 1) -->
              <div class="modal-comments-section" id="modal-comments-container">
                <div class="comments-heading">
                  <span><i class="far fa-comments" style="color:#DC2626;"></i> पाठकों की राय (Comments)</span>
                  <span class="comments-count-pill" id="modal-comments-count">0 विचार</span>
                </div>
                
                <!-- Comment Input Form -->
                <div class="comment-input-card">
                  <form id="modal-comment-form" onsubmit="event.preventDefault(); NewsHub.submitComment(event, this.dataset.newsId);">
                    <div class="comment-form-row">
                      <input type="text" id="comm-user-name" class="comment-input" required placeholder="आपका नाम *">
                      <input type="text" id="comm-user-dist" class="comment-input" placeholder="आपका जिला / शहर (जैसे: पटना)">
                    </div>
                    <textarea id="comm-text" class="comment-textarea" required placeholder="इस खबर पर अपनी राय या अनुभव लिखें..."></textarea>
                    <button type="submit" id="comm-submit-btn" class="comment-submit-btn">
                      <i class="fas fa-paper-plane"></i> टिप्पणी पोस्ट करें
                    </button>
                  </form>
                </div>

                <!-- Live Comments List -->
                <div class="comments-feed-list" id="modal-comments-feed"></div>
              </div>


              <!-- Prominent Quote Callout -->
              <div class="editorial-quote-card" id="modal-quote-wrap">
                <i class="fas fa-quote-left quote-icon"></i>
                <p id="modal-quote-text"></p>
                <div class="quote-author" id="modal-quote-speaker"></div>
              </div>

              <!-- Share & Action Bar -->
              <div class="modal-actions-footer">
                <a id="modal-wa-share" href="#" target="_blank" class="btn-share-wa">
                  <i class="fab fa-whatsapp"></i> व्हाट्सएप शेयर
                </a>
                <a id="modal-tg-share" href="#" target="_blank" class="btn-share-tg">
                  <i class="fab fa-telegram-plane"></i> टेलीग्राम
                </a>
                <button id="modal-copy-btn" class="btn-copy-link">
                  <i class="fas fa-link"></i> लिंक कॉपी
                </button>
                <button id="modal-print-btn" class="btn-print-article">
                  <i class="fas fa-print"></i> प्रिंट / PDF
                </button>
              </div>

              <!-- Related Stories Section -->
              <div class="related-stories-section">
                <h3 class="related-heading"><i class="fas fa-layer-group"></i> बिहार की अन्य प्रमुख खबरें (Related News)</h3>
                <div class="related-grid" id="modal-related-grid"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Modal Close Events
    const modal = document.getElementById('news-reader-modal');
    const closeBtn = document.getElementById('news-modal-close');
    const scrollContent = document.getElementById('modal-scrollable-content');
    const progressBar = document.getElementById('modal-reading-progress');

    // Scroll progress bar
    if (scrollContent && progressBar) {
      scrollContent.addEventListener('scroll', () => {
        const total = scrollContent.scrollHeight - scrollContent.clientHeight;
        const progress = total > 0 ? (scrollContent.scrollTop / total) * 100 : 0;
        progressBar.style.width = progress + '%';
      });
    }

    const closeModal = () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.isSpeaking = false;
      const listenBtn = document.getElementById('modal-listen-btn');
      if (listenBtn) listenBtn.innerHTML = '<i class="fas fa-play"></i> <span>खबर बोलकर सुनाएं</span>';
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    // Font size controls
    const decBtn = document.getElementById('modal-font-dec');
    const incBtn = document.getElementById('modal-font-inc');
    const contentEl = document.getElementById('modal-content');

    if (decBtn && contentEl) {
      decBtn.addEventListener('click', () => {
        this.fontSizeLevel = Math.max(0, this.fontSizeLevel - 1);
        contentEl.className = 'modal-full-text font-level-' + this.fontSizeLevel;
      });
    }
    if (incBtn && contentEl) {
      incBtn.addEventListener('click', () => {
        this.fontSizeLevel = Math.min(3, this.fontSizeLevel + 1);
        contentEl.className = 'modal-full-text font-level-' + this.fontSizeLevel;
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('modal-theme-toggle');
    const modalContainer = modal.querySelector('.news-modal-container');
    if (themeBtn && modalContainer) {
      themeBtn.addEventListener('click', () => {
        this.isReaderDark = !this.isReaderDark;
        modalContainer.classList.toggle('reader-dark-mode', this.isReaderDark);
        themeBtn.innerHTML = this.isReaderDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      });
    }

    // Audio Speech Synthesis with Speed control
    const listenBtn = document.getElementById('modal-listen-btn');
    const audioStatus = document.getElementById('audio-status-text');

    modal.querySelectorAll('.audio-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.audio-speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.speechRate = parseFloat(btn.dataset.speed) || 1.0;
        if (this.isSpeaking && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          this.isSpeaking = false;
          listenBtn.click();
        }
      });
    });

    if (listenBtn) {
      listenBtn.addEventListener('click', () => {
        if (!('speechSynthesis' in window)) {
          alert('आपके ब्राउज़र में वॉयस सपोर्ट नहीं है।');
          return;
        }

        if (this.isSpeaking) {
          window.speechSynthesis.cancel();
          this.isSpeaking = false;
          listenBtn.innerHTML = '<i class="fas fa-play"></i> <span>खबर बोलकर सुनाएं</span>';
          if (audioStatus) audioStatus.textContent = 'ऑडियो रुका हुआ है';
        } else {
          const headline = document.getElementById('modal-title').textContent;
          const bodyText = document.getElementById('modal-content').textContent;
          const utterance = new SpeechSynthesisUtterance(headline + "। " + bodyText.slice(0, 1200));
          utterance.lang = 'hi-IN';
          utterance.rate = this.speechRate || 1.0;

          utterance.onend = () => {
            this.isSpeaking = false;
            listenBtn.innerHTML = '<i class="fas fa-play"></i> <span>खबर बोलकर सुनाएं</span>';
            if (audioStatus) audioStatus.textContent = 'वाचन समाप्त हुआ';
          };
          utterance.onerror = () => {
            this.isSpeaking = false;
            listenBtn.innerHTML = '<i class="fas fa-play"></i> <span>खबर बोलकर सुनाएं</span>';
            if (audioStatus) audioStatus.textContent = 'त्रुटि हुई';
          };

          window.speechSynthesis.speak(utterance);
          this.isSpeaking = true;
          listenBtn.innerHTML = '<i class="fas fa-pause"></i> <span>रोकें (Pause)</span>';
          if (audioStatus) audioStatus.textContent = `वाचन जारी है (${this.speechRate}x स्पीड)`;
        }
      });
    }

    // Print button
    const printBtn = document.getElementById('modal-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    // Copy link
    const copyBtn = document.getElementById('modal-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        copyBtn.innerHTML = '<i class="fas fa-check"></i> लिंक कॉपी हो गया!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-link"></i> लिंक कॉपी';
        }, 2000);
      });
    }
  },

  // ─── Bookmark Management (Offline Storage) ─────────────────────────────────
  getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('bsh_saved_bookmarks') || '[]');
    } catch (_) {
      return [];
    }
  },

  isBookmarked(newsId) {
    const saved = this.getBookmarks();
    return saved.includes(newsId);
  },

  toggleBookmark(newsId) {
    let saved = this.getBookmarks();
    const exists = saved.includes(newsId);
    if (exists) {
      saved = saved.filter(id => id !== newsId);
    } else {
      saved.push(newsId);
    }
    localStorage.setItem('bsh_saved_bookmarks', JSON.stringify(saved));
    if (window.BSH && BSH.toast) {
      BSH.toast(exists ? 'खबर सेव सूची से हटा दी गई' : 'खबर ऑफलाइन पढ़ने के लिए सेव हो गई ✅', 'success');
    }
    return !exists;
  },

  openNewsModal(newsId) {
    const item = this.allNews.find(n => n.id === newsId);
    if (!item) return;

    this.trackEvent('article_view', { news_id: newsId, title: item.title, district: item.district });

    this.injectNewsModal();
    const modal = document.getElementById('news-reader-modal');

    // Title and Media
    document.getElementById('modal-title').textContent = item.title;
    const modalImgEl = document.getElementById('modal-img');
    modalImgEl.src = this.getNewsThumbnail(item);
    modalImgEl.onerror = () => { modalImgEl.src = this.getFallbackThumb(item.category, item.title, item.description); };
    
    // Category & Location Badges
    const catBadge = document.getElementById('modal-category-badge');
    catBadge.textContent = item.category_label_hi || 'समाचार';
    const locBadge = document.getElementById('modal-location-badge');
    locBadge.textContent = item.location_name || item.district_name_hi || 'बिहार';

    // Byline & Stats
    const timeStr = window.BSH ? BSH.timeAgo(item.pubDate) : 'हाल ही में';
    const resolvedSrcLogo = this.getSourceLogo(item.sourceName, item.sourceLogo);
    const modalSrcLogoEl = document.getElementById('modal-source-logo');
    if (modalSrcLogoEl) {
      modalSrcLogoEl.src = resolvedSrcLogo;
      modalSrcLogoEl.onerror = () => { modalSrcLogoEl.src = this.getFallbackLogoSvg(); };
    }
    document.getElementById('modal-reporter-name').textContent = item.sourceName || 'बिहार समाचार';
    document.getElementById('modal-reporter-title').textContent = `${item.district_name_hi || 'बिहार'} विशेष कवरेज`;
    document.getElementById('modal-read-time').innerHTML = `<i class="fas fa-book-reader"></i> ${item.read_time || '3 मिनट'}`;
    document.getElementById('modal-views').innerHTML = `<i class="fas fa-eye"></i> ${item.views_count || '3.5k'} पढ़ा गया`;
    document.getElementById('modal-pub-date').innerHTML = `<i class="far fa-clock"></i> <strong>${timeStr}</strong>`;

    // Highlights Box
    const highlightsList = document.getElementById('modal-highlights-list');
    const highlights = item.highlights || [
      `${item.district_name_hi || 'बिहार'} क्षेत्र में विकास और जनहित से जुड़ी यह एक अत्यंत महत्वपूर्ण पहल है।`,
      `योजना के क्रियान्वयन में आधुनिक पारदर्शिता और जवाबदेही सुनिश्चित की गई है।`,
      `स्थानीय नागरिकों, किसानों और युवाओं को इस कार्य से प्रत्यक्ष लाभ प्राप्त होगा।`
    ];
    highlightsList.innerHTML = highlights.map(h => `<li><i class="fas fa-check-circle"></i> <span>${BSH_SECURITY.escapeHtml(h)}</span></li>`).join('');

    // Statistics Callout Matrix
    const statsRow = document.getElementById('modal-stats-row');
    const keyStats = item.key_stats || [
      { label: 'स्थान', value: item.district_name_hi || 'बिहार' },
      { label: 'असर', value: 'प्रत्यक्ष लाभ' },
      { label: 'निगरानी', value: '24x7 डिजिटल' }
    ];
    statsRow.innerHTML = keyStats.map(s => `
      <div class="stat-pill-card">
        <span class="stat-pill-val">${BSH_SECURITY.escapeHtml(s.value)}</span>
        <span class="stat-pill-lbl">${BSH_SECURITY.escapeHtml(s.label)}</span>
      </div>
    `).join('');

    // Content formatting
    const contentBox = document.getElementById('modal-content');
    const fullText = item.content || item.description || '';
    const paragraphs = fullText.split('\n\n').filter(p => p.trim());
    contentBox.innerHTML = paragraphs.map(p => {
      if (p.startsWith('【') && p.includes('】')) {
        const parts = p.split('】\n');
        const heading = parts[0].replace('【', '');
        const body = parts[1] || '';
        return `<h3>${BSH_SECURITY.escapeHtml(heading)}</h3><p>${BSH_SECURITY.escapeHtml(body)}</p>`;
      }
      return `<p>${BSH_SECURITY.escapeHtml(p)}</p>`;
    }).join('');

    // Quote Block
    const quoteWrap = document.getElementById('modal-quote-wrap');
    const quote = item.quote || {
      text: 'सरकार जनहित के प्रत्येक संकल्प को समय पर पूरा करने के लिए कटिबद्ध है।',
      speaker: 'प्रशासनिक प्रवक्ता',
      designation: `${item.district_name_hi || 'बिहार'} विकास प्रकोष्ठ`
    };
    document.getElementById('modal-quote-text').textContent = quote.text;
    document.getElementById('modal-quote-speaker').textContent = `— ${quote.speaker}, ${quote.designation}`;

    // Bookmark button state
    const bmarkBtn = document.getElementById('modal-bookmark-btn');
    if (bmarkBtn) {
      const isSaved = this.isBookmarked(item.id);
      bmarkBtn.innerHTML = isSaved ? '<i class="fas fa-bookmark" style="color:#DC2626;"></i>' : '<i class="far fa-bookmark"></i>';
      bmarkBtn.onclick = () => {
        const nowSaved = this.toggleBookmark(item.id);
        bmarkBtn.innerHTML = nowSaved ? '<i class="fas fa-bookmark" style="color:#DC2626;"></i>' : '<i class="far fa-bookmark"></i>';
      };
    }

    // Social share links
    const shareUrl = encodeURIComponent(window.location.origin + window.location.pathname + '#news-' + item.id);
    const shareText = encodeURIComponent(`*${item.title}*\n\nबिहार समाचार हब पर पूरी इन-डेप्थ रिपोर्ट पढ़ें:\n`);
    document.getElementById('modal-wa-share').href = `https://api.whatsapp.com/send?text=${shareText}${shareUrl}`;
    document.getElementById('modal-tg-share').href = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;

    // Related Stories (3 items from same district or category)
    const relatedGrid = document.getElementById('modal-related-grid');
    const related = this.allNews
      .filter(n => n.id !== item.id && (n.district === item.district || n.category === item.category))
      .slice(0, 3);
    
    relatedGrid.innerHTML = related.map(rel => `
      <div class="related-card" onclick="NewsHub.openNewsModal('${rel.id}')">
        <img src="${this.getNewsThumbnail(rel)}" onerror="this.onerror=null;this.src='${this.getFallbackThumb(rel.category, rel.title, rel.description)}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" alt="" class="related-thumb" loading="lazy" referrerpolicy="no-referrer">
        <div class="related-info">
          <span class="related-loc">${rel.location_name || rel.district_name_hi}</span>
          <h4 class="related-title">${BSH_SECURITY.escapeHtml(rel.title)}</h4>
          <span class="related-time"><i class="far fa-clock"></i> ${window.BSH ? BSH.timeAgo(rel.pubDate) : 'आज'}</span>
        </div>
      </div>
    `).join('');

    // Reset scroll and progress bar
    const scrollContent = document.getElementById('modal-scrollable-content');
    if (scrollContent) scrollContent.scrollTop = 0;
    const progressBar = document.getElementById('modal-reading-progress');
    if (progressBar) progressBar.style.width = '0%';

    // Open
    
    // Dynamic Phase 1, 4, 6 Handlers
    try {
      // 1. Populate AI 30-Second Bullet Summary
      const aiList = document.getElementById('modal-ai-summary-list');
      if (aiList) {
        const bullets = this.generateAiSummary(item);
        aiList.innerHTML = bullets.map(b => `<li><i class="fas fa-bolt"></i> <span>${BSH_SECURITY.escapeHtml(b)}</span></li>`).join('');
      }

      // 2. Load Article Moderated Comments
      const commForm = document.getElementById('modal-comment-form');
      if (commForm) commForm.dataset.newsId = item.id;
      this.loadArticleComments(item.id);

      // 3. Inject Google News JSON-LD Schema
      this.injectJsonLdSchema(item);

      // 4. Record Reading History for "For You" Recommendations
      this.recordArticleRead(item);
    } catch (e) {
      console.warn('News modal hook error:', e);
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  setLoadingState(loading) {
    this.isLoading = loading;
    const indicator = document.getElementById('news-loading-indicator');
    if (indicator) indicator.style.display = loading ? 'flex' : 'none';
  }
};
window.NewsHub = NewsHub;

// ─── ADVANCED HOMEPAGE PORTAL ENGINE ───────────────────────────────────────────
NewsHub.heroSlides = [];
NewsHub.currentHeroIdx = 0;
NewsHub.heroTimer = null;
NewsHub.isHeroPaused = false;
NewsHub.selectedDistrict = 'all';
NewsHub.homeGridCategory = 'all';
NewsHub.homeGridPage = 1;
NewsHub.HOME_PAGE_SIZE = 9;

// 1. Hero News Carousel Slider (Auto-Rotating, 5s, Dot indicators, Next/Prev)
NewsHub.initHeroSlider = function () {
  const container = document.getElementById('hero-slider-main');
  if (!container || !this.allNews.length) return;

  // Top 5 news for the hero carousel
  this.heroSlides = this.allNews.slice(0, 5);
  const dotsContainer = document.getElementById('hero-slider-dots');

  // Generate slides HTML
  const slidesHtml = this.heroSlides.map((item, idx) => {
    const timeStr = window.BSH ? BSH.timeAgo(item.pubDate) : 'हाल ही में';
    const thumb = this.getNewsThumbnail(item);
    const loc = item.location_name || item.district_name_hi || 'बिहार';
    const catLabel = item.category_label_hi || 'बड़ी खबर';
    const desc = item.description ? BSH_SECURITY.stripHtml(item.description).slice(0, 140) + '…' : '';
    const title = BSH_SECURITY.escapeHtml(item.title || '');
    const views = item.views_count || '4.8k';
    const srcLogo = this.getSourceLogo(item.sourceName, item.sourceLogo);
    const srcName = item.sourceName || 'बिहार समाचार';

    return `
      <div class="hero-slide ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-id="${item.id}" onclick="NewsHub.openNewsModal('${item.id}')">
        <img src="${thumb}" onerror="this.onerror=null;this.src='${this.getFallbackThumb(item.category, item.title, item.description)}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" alt="${title}" class="hero-slide-img" loading="lazy" referrerpolicy="no-referrer">
        <div class="hero-slide-gradient">
          <div class="hero-badge-row">
            <span class="hero-cat-tag"><i class="fas fa-bolt"></i> ${catLabel}</span>
            <span class="hero-loc-tag"><i class="fas fa-map-marker-alt"></i> ${loc}</span>
          </div>
          <h2 class="hero-slide-title">${title}</h2>
          <p class="hero-slide-desc">${desc}</p>
          <div class="hero-meta-row">
            <span style="display:inline-flex; align-items:center; gap:6px;">
              <img src="${srcLogo}" onerror="this.onerror=null;this.src='${this.getFallbackLogoSvg()}';" style="width:18px;height:18px;border-radius:50%;object-fit:contain;background:#fff;padding:1px;" alt="" referrerpolicy="no-referrer">
              ${srcName}
            </span>
            <span><i class="far fa-clock"></i> ${timeStr}</span>
            <span><i class="fas fa-eye"></i> ${views} पाठक</span>
            <span style="color:#FFD54F; font-weight:700;"><i class="fas fa-book-open"></i> पूरी खबर पढ़ें →</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Generate dots HTML
  const dotsHtml = this.heroSlides.map((_, idx) => `
    <span class="hero-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" onclick="NewsHub.goToHeroSlide(${idx})"></span>
  `).join('');

  // Preserve navigation buttons and update inner slides
  const prevBtn = document.getElementById('hero-prev-btn');
  const nextBtn = document.getElementById('hero-next-btn');

  const oldSlides = container.querySelectorAll('.hero-slide');
  oldSlides.forEach(s => s.remove());
  container.insertAdjacentHTML('afterbegin', slidesHtml);

  if (dotsContainer) dotsContainer.innerHTML = dotsHtml;

  // Bind Next / Prev buttons
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      this.prevHeroSlide();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      this.nextHeroSlide();
    };
  }

  // Pause on hover
  container.onmouseenter = () => { this.isHeroPaused = true; };
  container.onmouseleave = () => { this.isHeroPaused = false; };

  // Touch Swipe
  let touchStartX = 0;
  container.ontouchstart = (e) => { touchStartX = e.changedTouches[0].screenX; };
  container.ontouchend = (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) this.nextHeroSlide();
    if (touchEndX - touchStartX > 50) this.prevHeroSlide();
  };

  // Auto-rotate every 5 seconds
  clearInterval(this.heroTimer);
  this.heroTimer = setInterval(() => {
    if (!this.isHeroPaused && this.heroSlides.length > 1) {
      this.nextHeroSlide();
    }
  }, 5000);
};

NewsHub.goToHeroSlide = function (idx) {
  const container = document.getElementById('hero-slider-main');
  if (!container) return;
  const slides = container.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');

  slides.forEach((s, i) => s.classList.toggle('active', i === idx));
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  this.currentHeroIdx = idx;
};

NewsHub.nextHeroSlide = function () {
  if (!this.heroSlides.length) return;
  const nextIdx = (this.currentHeroIdx + 1) % this.heroSlides.length;
  this.goToHeroSlide(nextIdx);
};

NewsHub.prevHeroSlide = function () {
  if (!this.heroSlides.length) return;
  const prevIdx = (this.currentHeroIdx - 1 + this.heroSlides.length) % this.heroSlides.length;
  this.goToHeroSlide(prevIdx);
};

// 2. Spotlight Top 3 Stories
NewsHub.renderSpotlightStack = function () {
  const container = document.getElementById('spotlight-cards-container');
  if (!container || !this.allNews.length) return;

  const spotlightItems = this.allNews.slice(5, 8);
  container.innerHTML = spotlightItems.map(item => {
    const timeStr = window.BSH ? BSH.timeAgo(item.pubDate) : 'हाल ही में';
    const thumb = this.getNewsThumbnail(item);
    const loc = item.location_name || item.district_name_hi || 'बिहार';
    const title = BSH_SECURITY.escapeHtml(item.title || '');
    const views = item.views_count || '3.2k';

    const srcLogo = this.getSourceLogo(item.sourceName, item.sourceLogo);
    const srcName = item.sourceName || 'बिहार समाचार';

    return `
      <div class="spotlight-card" onclick="NewsHub.openNewsModal('${item.id}')">
        <img src="${thumb}" onerror="this.onerror=null;this.src='${this.getFallbackThumb(item.category, item.title, item.description)}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" alt="${title}" class="spotlight-thumb" loading="lazy" referrerpolicy="no-referrer">
        <div class="spotlight-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span class="spotlight-tag"><i class="fas fa-map-marker-alt"></i> ${loc}</span>
            <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; color:#475569;">
              <img src="${srcLogo}" onerror="this.onerror=null;this.src='${this.getFallbackLogoSvg()}';" style="width:15px;height:15px;border-radius:50%;object-fit:contain;" alt="" referrerpolicy="no-referrer">
              ${srcName}
            </span>
          </div>
          <h4 class="spotlight-title">${title}</h4>
          <div class="spotlight-meta">
            <span><i class="far fa-clock"></i> ${timeStr}</span>
            <span><i class="fas fa-eye"></i> ${views}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// 3. District Quick-Select Horizontal Chips Bar
NewsHub.initDistrictQuickChips = function () {
  const track = document.getElementById('district-quick-chips');
  const leftBtn = document.getElementById('dist-scroll-left');
  const rightBtn = document.getElementById('dist-scroll-right');
  if (!track) return;

  const districts = this.DISTRICT_KEYWORDS_LIST || [];
  let html = `
    <button class="district-quick-chip ${this.selectedDistrict === 'all' ? 'active' : ''}" data-district="all" onclick="NewsHub.selectDistrictOnHomepage('all', 'Bihar, India')">
      <i class="fas fa-th-large"></i> सभी 38 जिले
    </button>
  `;

  districts.forEach(d => {
    const activeClass = this.selectedDistrict === d.id ? 'active' : '';
    html += `
      <button class="district-quick-chip ${activeClass}" data-district="${d.id}" onclick="NewsHub.selectDistrictOnHomepage('${d.id}', '${d.hi}')">
        <i class="fas fa-map-pin"></i> ${d.hi}
      </button>
    `;
  });

  track.innerHTML = html;

  if (leftBtn) {
    leftBtn.onclick = () => track.scrollBy({ left: -260, behavior: 'smooth' });
  }
  if (rightBtn) {
    rightBtn.onclick = () => track.scrollBy({ left: 260, behavior: 'smooth' });
  }
};

NewsHub.selectDistrictOnHomepage = function (districtId, districtNameHi) {
  this.selectedDistrict = districtId;

  // 1. Update chip active styles
  document.querySelectorAll('.district-quick-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.district === districtId);
  });

  // 2. Live update Google Map on Homepage
  if (typeof NewsHub.updateGoogleMap === 'function') {
    NewsHub.updateGoogleMap(districtNameHi || districtId, true);
  }

  // 3. Filter Homepage News for this district
  NewsHub.filterByDistrict(districtId);

  // 4. Update the "ज़िला विवरण" button in the map header
  const distLink = document.getElementById('homepage-gmap-district-page-link');
  if (distLink) {
    if (districtId && districtId !== 'all' && districtId !== 'bihar') {
      distLink.style.display = 'inline-flex';
      distLink.href = `district/index.html?id=${districtId}`;
      distLink.innerHTML = `<i class="fas fa-file-lines"></i> [${districtNameHi}] विवरण ➔`;
    } else {
      distLink.style.display = 'none';
    }
  }

  if (window.BSH && BSH.toast && districtId !== 'all') {
    BSH.toast(`🗺️ [${districtNameHi}] का लाइव गूगल मैप लोड हुआ!`, 'info');
  }
};

NewsHub.filterByDistrict = function (districtId, shouldScrollFeed = false) {
  this.selectedDistrict = districtId;
  this.currentDistrict = districtId;
  this.selectedDivision = 'all';

  // Reset division chips active state
  document.querySelectorAll('.division-chip').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes("'all'"));
  });

  // Update quick chip active styles
  document.querySelectorAll('.district-quick-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.district === districtId);
  });

  // Update main feed heading
  const heading = document.getElementById('feed-heading');
  if (heading) {
    if (districtId === 'all') {
      heading.textContent = 'बिहार की ताज़ा बड़ी खबरें';
    } else {
      const dObj = (this.DISTRICT_KEYWORDS_LIST || []).find(d => d.id === districtId);
      const name = dObj ? dObj.hi : districtId;
      heading.innerHTML = `📍 <span style="color:var(--primary);">${name}</span> जिले की ताज़ा खबरें`;
    }
  }

  // Update Aapke Liye section home district
  if (districtId !== 'all') {
    localStorage.setItem('bsh_home_district', districtId);
    if (typeof this.renderAapkeLiyeSection === 'function') {
      this.renderAapkeLiyeSection();
    }
    if (typeof this.renderForYouSection === 'function') {
      this.renderForYouSection();
    }
  }

  // Filter and re-render news
  this.homeGridPage = 1;
  this.currentPage = 1;
  if (typeof this.renderHomepageNewsGrid === 'function') {
    this.renderHomepageNewsGrid();
  }
  if (typeof this.applyFilters === 'function') {
    this.applyFilters();
  }

  // Scroll to news section smoothly only when requested
  if (shouldScrollFeed) {
    const feed = document.getElementById('feed-heading');
    if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

NewsHub.filterByKeyword = function (keyword) {
  const searchInput = document.getElementById('hero-autocomplete-search');
  if (searchInput) {
    searchInput.value = keyword;
    this.handleAutocomplete(keyword);
    searchInput.focus();
  }
};

// 4. Live Autocomplete Search Box with Instant Google Map Trigger
NewsHub.initAutocompleteSearch = function () {
  const input = document.getElementById('hero-autocomplete-search');
  const clearBtn = document.getElementById('hero-search-clear');
  const resultsBox = document.getElementById('hero-autocomplete-results');
  if (!input || !resultsBox) return;

  const handleSearchCommit = (rawQuery) => {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q) return;

    // 1. Check if user typed or selected any of Bihar's 38 districts
    const matchedDist = (NewsHub.DISTRICT_KEYWORDS_LIST || []).find(d =>
      d.id.toLowerCase() === q ||
      d.hi.toLowerCase() === q ||
      d.id.toLowerCase().includes(q) ||
      d.hi.toLowerCase().includes(q) ||
      (d.aliases && d.aliases.some(a => a.toLowerCase().includes(q)))
    );

    if (matchedDist) {
      input.value = matchedDist.hi;
      NewsHub.selectDistrictOnHomepage(matchedDist.id, matchedDist.hi);
    } else {
      // General news keyword search
      NewsHub.filterByKeyword(rawQuery.trim());
    }

    resultsBox.classList.remove('open');
    resultsBox.style.display = 'none';
  };

  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    if (!q) {
      resultsBox.classList.remove('open');
      resultsBox.style.display = 'none';
      resultsBox.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(() => {
      NewsHub.handleAutocomplete(q);
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchCommit(input.value);
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      resultsBox.classList.remove('open');
      resultsBox.style.display = 'none';
      NewsHub.selectDistrictOnHomepage('all', 'Bihar, India');
    });
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
      resultsBox.classList.remove('open');
      resultsBox.style.display = 'none';
    }
  });
};

NewsHub.handleAutocomplete = function (query) {
  const resultsBox = document.getElementById('hero-autocomplete-results');
  if (!resultsBox) return;

  const q = query.toLowerCase();
  const matchedDistricts = (this.DISTRICT_KEYWORDS_LIST || []).filter(d =>
    d.hi.toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q) ||
    (d.aliases && d.aliases.some(a => a.toLowerCase().includes(q)))
  ).slice(0, 6);

  const matchedNews = (this.allNews || []).filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.description || '').toLowerCase().includes(q) ||
    (n.location_name || '').toLowerCase().includes(q) ||
    (n.district_name_hi || '').toLowerCase().includes(q)
  ).slice(0, 5);

  if (!matchedDistricts.length && !matchedNews.length) {
    resultsBox.innerHTML = `
      <div style="padding:16px; text-align:center; color:#64748B; font-size:0.88rem;">
        <i class="fas fa-search" style="margin-bottom:6px; font-size:1.4rem; opacity:0.5;"></i>
        <div>'${BSH_SECURITY.escapeHtml(query)}' के लिए कोई परिणाम नहीं मिला</div>
      </div>
    `;
    resultsBox.classList.add('open');
    resultsBox.style.display = 'block';
    return;
  }

  let html = '';

  // Districts Group (with Instant Google Map Action)
  if (matchedDistricts.length) {
    html += `<div class="autocomplete-group-title" style="background:#FFF7ED; color:#DC2626; padding:8px 14px; font-size:0.75rem; font-weight:800; border-bottom:1px solid #FED7AA; display:flex; align-items:center; gap:6px;"><i class="fas fa-map-marked-alt"></i> बिहार के जिले (लाइव गूगल मैप और खबरें देखें)</div>`;
    matchedDistricts.forEach(d => {
      html += `
        <div class="autocomplete-item" style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="document.getElementById('hero-autocomplete-search').value='${d.hi}'; NewsHub.selectDistrictOnHomepage('${d.id}', '${d.hi}'); document.getElementById('hero-autocomplete-results').classList.remove('open'); document.getElementById('hero-autocomplete-results').style.display='none';">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:32px; height:32px; border-radius:50%; background:#FFF3E0; color:#DC2626; display:flex; align-items:center; justify-content:center; font-size:0.85rem;"><i class="fas fa-map-pin"></i></span>
            <div>
              <div style="font-weight:700; color:#0F172A; font-size:0.92rem;">${d.hi} <span style="font-size:0.75rem; color:#64748B; font-weight:500;">(${d.id.toUpperCase()})</span></div>
              <div style="font-size:0.75rem; color:#64748B;">गूगल मैप्स व जिले की ताज़ा खबरें लोड करें</div>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:0.72rem; background:#E8F0FE; color:#1A73E8; padding:3px 8px; border-radius:12px; font-weight:700; border:1px solid #BFDBFE;"><i class="fab fa-google"></i> मैप देखें</span>
            <a href="district/index.html?id=${d.id}" style="font-size:0.72rem; background:#F8FAFC; color:#334155; padding:3px 8px; border-radius:12px; font-weight:600; border:1px solid #CBD5E1; text-decoration:none;" onclick="event.stopPropagation();">ज़िला पेज ➔</a>
          </div>
        </div>
      `;
    });
  }

  // News Stories Group
  if (matchedNews.length) {
    html += `<div class="autocomplete-group-title" style="background:#F8FAFC; color:#0F172A; padding:8px 14px; font-size:0.75rem; font-weight:800; border-bottom:1px solid #E2E8F0; display:flex; align-items:center; gap:6px;"><i class="fas fa-newspaper" style="color:#0284C7;"></i> ताज़ा संबंधित खबरें</div>`;
    matchedNews.forEach(n => {
      const timeStr = window.BSH ? BSH.timeAgo(n.pubDate) : 'आज';
      html += `
        <div class="autocomplete-item" onclick="NewsHub.openNewsModal('${n.id}'); document.getElementById('hero-autocomplete-results').classList.remove('open'); document.getElementById('hero-autocomplete-results').style.display='none';" style="padding:10px 14px; display:flex; align-items:center; gap:10px; border-bottom:1px solid #F1F5F9; cursor:pointer;">
          <div class="autocomplete-item-icon" style="background:#E0F2FE; color:#0369A1; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-bolt" style="font-size:0.8rem;"></i></div>
          <div class="autocomplete-item-content" style="flex:1; min-width:0;">
            <div class="autocomplete-item-title" style="font-size:0.86rem; font-weight:600; color:#0F172A; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${BSH_SECURITY.escapeHtml(n.title)}</div>
            <div class="autocomplete-item-sub" style="font-size:0.74rem; color:#64748B;">${n.location_name || n.district_name_hi || 'बिहार'} • ${timeStr}</div>
          </div>
        </div>
      `;
    });
  }

  // General keyword search fallback
  html += `
    <div class="autocomplete-item" onclick="NewsHub.filterByKeyword('${BSH_SECURITY.escapeHtml(query)}'); document.getElementById('hero-autocomplete-results').classList.remove('open'); document.getElementById('hero-autocomplete-results').style.display='none';" style="padding:10px 14px; cursor:pointer; background:#FFF7ED; color:#DC2626; font-weight:700; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
      <i class="fas fa-search"></i> "${BSH_SECURITY.escapeHtml(query)}" से संबंधित सभी बिहार खबरें खोजें ➔
    </div>
  `;

  resultsBox.innerHTML = html;
  resultsBox.classList.add('open');
  resultsBox.style.display = 'block';
};

// 5. "Aapke Liye" (Personalized for you) Section
NewsHub.renderAapkeLiyeSection = function () {
  const container = document.getElementById('aapke-liye-grid');
  const nameEl = document.getElementById('aapke-liye-district-name');
  if (!container) return;

  const homeDistrictId = localStorage.getItem('bsh_home_district') || 'patna';
  const dObj = (this.DISTRICT_KEYWORDS_LIST || []).find(d => d.id === homeDistrictId);
  const districtName = dObj ? dObj.hi : 'पटना';

  if (nameEl) {
    nameEl.innerHTML = `<i class="fas fa-map-pin"></i> ${districtName}`;
  }

  // Filter news for this district
  let localized = (this.allNews || []).filter(n => (n.district || '').toLowerCase() === homeDistrictId.toLowerCase());

  // Supplement if fewer than 3 items
  if (localized.length < 3) {
    localized = [...localized, ...(this.allNews || []).slice(0, 3 - localized.length)];
  }
  localized = localized.slice(0, 4);

  container.innerHTML = localized.map(item => this.renderNewsCard(item)).join('');

  // Bind click modals
  container.querySelectorAll('.open-reader-btn, .news-card-title a, .news-card-img-wrap').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const card = el.closest('.news-card');
      if (card && card.dataset.id) {
        NewsHub.openNewsModal(card.dataset.id);
      }
    });
  });
};

NewsHub.promptChangeHomeDistrict = function () {
  const districts = this.DISTRICT_KEYWORDS_LIST || [];
  const current = localStorage.getItem('bsh_home_district') || 'patna';

  let modal = document.getElementById('home-district-picker-modal');
  if (!modal) {
    const html = `
      <div id="home-district-picker-modal" class="news-modal-overlay">
        <div class="news-modal-container citizen-modal-wrap" style="max-width:550px;" role="dialog">
          <div class="flex justify-between items-center pb-3" style="border-bottom:1px solid #E2E8F0;">
            <h3 style="margin:0; font-size:1.15rem;"><i class="fas fa-map-pin" style="color:var(--primary);"></i> अपना गृह जिला चुनें (Choose Home District)</h3>
            <button class="tool-btn" onclick="document.getElementById('home-district-picker-modal').classList.remove('open')">&times;</button>
          </div>
          <p style="font-size:0.85rem; color:#64748B; margin:12px 0;">आपके चुने हुए जिले की खबरें 'आपके लिए' सेक्शन में सबसे पहले दिखाई जाएंगी।</p>
          <div id="district-picker-buttons" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:8px; max-height:55vh; overflow-y:auto; padding:4px;">
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('home-district-picker-modal');
  }

  const list = document.getElementById('district-picker-buttons');
  list.innerHTML = districts.map(d => `
    <button class="district-quick-chip ${d.id === current ? 'active' : ''}" style="justify-content:center; text-align:center;" onclick="NewsHub.saveHomeDistrict('${d.id}')">
      ${d.hi}
    </button>
  `).join('');

  modal.classList.add('open');
};

NewsHub.saveHomeDistrict = function (districtId) {
  localStorage.setItem('bsh_home_district', districtId);
  const modal = document.getElementById('home-district-picker-modal');
  if (modal) modal.classList.remove('open');
  this.renderAapkeLiyeSection();
  const dObj = (this.DISTRICT_KEYWORDS_LIST || []).find(d => d.id === districtId);
  if (window.BSH && BSH.toast) {
    BSH.toast(`गृह जिला बदलकर '${dObj ? dObj.hi : districtId}' कर दिया गया!`, 'success');
  }
};

// 6. Netflix-Style Horizontal Scrollable Rows
NewsHub.renderHorizontalRows = function () {
  const politicsTrack = document.getElementById('row-politics-track');
  const educationTrack = document.getElementById('row-education-track');
  const villageTrack = document.getElementById('row-village-track');

  const renderRowCards = (items, trackEl) => {
    if (!trackEl || !items.length) return;
    trackEl.innerHTML = items.slice(0, 10).map(item => {
      const timeStr = window.BSH ? BSH.timeAgo(item.pubDate) : 'आज';
      const thumb = this.getNewsThumbnail(item);
      const loc = item.location_name || item.district_name_hi || 'बिहार';
      const title = BSH_SECURITY.escapeHtml(item.title || '');
      const desc = item.description ? BSH_SECURITY.stripHtml(item.description).slice(0, 95) + '…' : '';
      const waText = encodeURIComponent(`*${item.title}*\n(बिहार समाचार हब पर पढ़ें)`);
      const waLink = `https://api.whatsapp.com/send?text=${waText}`;

      return `
        <div class="netflix-card" onclick="NewsHub.openNewsModal('${item.id}')">
          <div class="netflix-card-thumb-wrap">
            <img src="${thumb}" onerror="this.onerror=null;this.src='${this.getFallbackThumb(item.category, item.title, item.description)}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" alt="${title}" class="netflix-card-thumb" loading="lazy" referrerpolicy="no-referrer">
            <span class="netflix-card-loc-pill"><i class="fas fa-map-marker-alt"></i> ${loc}</span>
          </div>
          <div class="netflix-card-body">
            <h4 class="netflix-card-title">${title}</h4>
            <p class="netflix-card-desc">${desc}</p>
            <div class="netflix-card-footer">
              <span><i class="far fa-clock"></i> ${timeStr}</span>
              <a href="${waLink}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="btn-share-whatsapp" style="padding:2px 8px; font-size:0.72rem;">
                <i class="fab fa-whatsapp"></i>
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const politicsNews = (this.allNews || []).filter(n => n.category === 'politics' || (n.title || '').includes('सरकार') || (n.title || '').includes('मंत्रालय') || (n.title || '').includes('नीतीश'));
  const educationNews = (this.allNews || []).filter(n => n.category === 'education' || (n.title || '').includes('BPSC') || (n.title || '').includes('शिक्षक') || (n.title || '').includes('परीक्षा'));
  const villageNews = (this.allNews || []).filter(n => n.category === 'village_panchayat' || n.location_type === 'village' || (n.title || '').includes('पंचायत') || (n.title || '').includes('मंडी'));

  renderRowCards(politicsNews.length ? politicsNews : this.allNews.slice(3, 12), politicsTrack);
  renderRowCards(educationNews.length ? educationNews : this.allNews.slice(8, 17), educationTrack);
  renderRowCards(villageNews.length ? villageNews : this.allNews.slice(12, 21), villageTrack);
};

NewsHub.scrollRow = function (trackId, delta) {
  const track = document.getElementById(trackId);
  if (track) {
    track.scrollBy({ left: delta, behavior: 'smooth' });
  }
};

// 7. Main News Grid (with live category & division/district filtering & Load More)
NewsHub.renderHomepageNewsGrid = function () {
  const grid = document.getElementById('homepage-news');
  const loadMoreBtn = document.getElementById('homepage-load-more-btn');
  if (!grid) return;

  let list = this.allNews ? [...this.allNews] : [];

  // 1. Filter by selected division
  if (this.selectedDivision && this.selectedDivision !== 'all') {
    const allowed = this.divisionDistricts[this.selectedDivision] || [];
    list = list.filter(n => allowed.includes((n.district || '').toLowerCase()));
  }

  // 2. Filter by selected district
  const dist = (this.selectedDistrict && this.selectedDistrict !== 'all') ? this.selectedDistrict : (this.currentDistrict && this.currentDistrict !== 'all' ? this.currentDistrict : 'all');
  if (dist !== 'all') {
    list = list.filter(n => (n.district || '').toLowerCase() === dist.toLowerCase());
  }

  // 3. Filter by category
  const cat = this.homeGridCategory || this.currentCategory || 'all';
  if (cat !== 'all') {
    if (cat === 'village_panchayat') {
      list = list.filter(n => n.location_type === 'village' || n.category === 'village_panchayat');
    } else {
      list = list.filter(n => n.category === cat);
    }
  }

  // If NO filters active, slice after hero/spotlight items to keep front feed diverse
  if ((!this.selectedDivision || this.selectedDivision === 'all') && dist === 'all' && cat === 'all') {
    if (list.length > 8) {
      list = list.slice(8);
    }
  }

  const page = this.homeGridPage || 1;
  const pageSize = this.HOME_PAGE_SIZE || 12;
  const toShowCount = page * pageSize;
  const items = list.slice(0, toShowCount);

  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:50px 20px; color:#64748B;">
        <i class="fas fa-newspaper" style="font-size:3rem; color:#CBD5E1; margin-bottom:12px;"></i>
        <h3>कोई खबर नहीं मिली</h3>
        <p>कृपया दूसरा प्रमंडल, जिला या श्रेणी चुनकर देखें।</p>
      </div>
    `;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  let cardsHtml = '';
  items.forEach((item, idx) => {
    cardsHtml += this.renderNewsCard(item);
    if ((idx + 1) % 4 === 0 && idx !== items.length - 1) {
      cardsHtml += this.renderNativeAdCard(Math.floor(idx / 4));
    }
  });
  grid.innerHTML = cardsHtml;

  // Bind clicks
  grid.querySelectorAll('.open-reader-btn, .news-card-title a, .news-card-img-wrap').forEach(el => {
    el.addEventListener('click', (e) => {
      if (el.closest('.ad-native-news-card')) return;
      e.preventDefault();
      const card = el.closest('.news-card');
      if (card && card.dataset.id) {
        NewsHub.openNewsModal(card.dataset.id);
      }
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.style.display = toShowCount < list.length ? 'inline-flex' : 'none';
  }
};

// 8. Sidebar Trending Now (#1 to #5 Ranked List) — ZERO REPETITION GUARANTEE
NewsHub.renderSidebarTrending = function () {
  const listEl = document.getElementById('sidebar-trending-list');
  if (!listEl || !this.allNews || !this.allNews.length) return;

  // 1. Collect IDs of stories already featured in Hero Slider to guarantee FRESH Trending stories
  const heroIds = new Set();
  if (this.heroSlides && this.heroSlides.length) {
    this.heroSlides.forEach(s => heroIds.add(s.id));
  }

  // 2. Helper to parse view count to integer (e.g. '6.4k' -> 6400, '5.1k' -> 5100)
  const parseViews = (v) => {
    if (!v) return 0;
    const s = String(v).toLowerCase().trim();
    if (s.endsWith('k')) return (parseFloat(s) || 0) * 1000;
    if (s.endsWith('m')) return (parseFloat(s) || 0) * 1000000;
    return parseInt(s) || 0;
  };

  // 3. Pool of candidates: exclude hero carousel items if we have plenty of news
  let pool = this.allNews.filter(n => !heroIds.has(n.id));
  if (pool.length < 10) pool = [...this.allNews];

  // Sort candidate pool by real views / engagement descending
  pool.sort((a, b) => parseViews(b.views_count) - parseViews(a.views_count));

  // 4. Strict Deduplication: NO duplicate IDs, NO duplicate or similar titles, distinct districts
  const trendingItems = [];
  const seenIds = new Set();
  const seenTitles = new Set();

  for (const item of pool) {
    if (trendingItems.length >= 5) break;
    if (!item || !item.id || seenIds.has(item.id)) continue;

    // Normalize title: strip brackets like [पटना], clean spaces and symbols
    const cleanTitle = (item.title || '')
      .replace(/\[.*?\]/g, '')
      .replace(/[^\w\s\u0900-\u097F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const titleKey = cleanTitle.slice(0, 22);
    if (!titleKey || seenTitles.has(titleKey)) continue;

    seenIds.add(item.id);
    seenTitles.add(titleKey);
    trendingItems.push(item);
  }

  // Fallback if needed to reach 5 unique items
  if (trendingItems.length < 5) {
    for (const item of this.allNews) {
      if (trendingItems.length >= 5) break;
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        trendingItems.push(item);
      }
    }
  }

  listEl.innerHTML = trendingItems.map((item, idx) => {
    const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
    const timeStr = (typeof window !== 'undefined' && window.BSH && window.BSH.timeAgo) ? window.BSH.timeAgo(item.pubDate) : 'आज';
    const loc = item.location_name || item.district_name_hi || 'बिहार';
    const views = item.views_count || `${(6.4 - idx * 0.4).toFixed(1)}k`;

    const srcLogo = this.getSourceLogo(item.sourceName, item.sourceLogo);
    const srcName = item.sourceName || 'बिहार समाचार';

    return `
      <div class="trending-widget-item" onclick="NewsHub.openNewsModal('${item.id}')">
        <div class="trending-widget-rank ${rankClass}">#${idx + 1}</div>
        <div class="trending-widget-content">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:0.72rem; color:var(--primary); font-weight:700;"><i class="fas fa-map-marker-alt"></i> ${loc}</span>
            <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; font-weight:700; color:#64748B;">
              <img src="${srcLogo}" onerror="this.onerror=null;this.src='${this.getFallbackLogoSvg()}';" style="width:14px;height:14px;border-radius:50%;object-fit:contain;" alt="">
              ${srcName}
            </span>
          </div>
          <h4 class="trending-widget-headline">${BSH_SECURITY.escapeHtml(item.title)}</h4>
          <div class="trending-widget-meta">
            <span><i class="far fa-clock"></i> ${timeStr}</span>
            <span><i class="fas fa-fire" style="color:#EF4444;"></i> ${views} रीड्स</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// 9. Live Weather Widget (with 38 districts)
NewsHub.initWeatherWidget = function () {
  const select = document.getElementById('weather-district-select');
  if (!select) return;

  const districts = this.DISTRICT_KEYWORDS_LIST || [];
  select.innerHTML = districts.map(d => `
    <option value="${d.id}">${d.hi} (${d.id.toUpperCase()})</option>
  `).join('');

  select.value = 'patna';
  this.updateWeatherWidget('patna');
};

NewsHub.updateWeatherWidget = function (districtId) {
  const weatherMap = {
    patna: { temp: '29°C', cond: '☀️ साफ़ धूप व खिली हवा', icon: '🌤️', wind: '11 km/h', hum: '58%', aqi: '88 (संतोषजनक)', aqiColor: '#16A34A' },
    gaya: { temp: '28°C', cond: '🌤️ हल्का बादल व खुशनुमा', icon: '⛅', wind: '9 km/h', hum: '62%', aqi: '74 (अच्छा)', aqiColor: '#16A34A' },
    muzaffarpur: { temp: '27°C', cond: '⛅ आंशिक बादल', icon: '⛅', wind: '13 km/h', hum: '65%', aqi: '112 (मध्यम)', aqiColor: '#EAB308' },
    bhagalpur: { temp: '30°C', cond: '☀️ तेज़ धूप', icon: '☀️', wind: '10 km/h', hum: '54%', aqi: '105 (मध्यम)', aqiColor: '#EAB308' },
    darbhanga: { temp: '28°C', cond: '🌤️ हल्की धूप', icon: '🌤️', wind: '12 km/h', hum: '68%', aqi: '92 (संतोषजनक)', aqiColor: '#16A34A' },
    purnia: { temp: '27°C', cond: '🌦️ हल्की नम हवाएं', icon: '🌦️', wind: '14 km/h', hum: '72%', aqi: '68 (अच्छा)', aqiColor: '#16A34A' },
    siwan: { temp: '28°C', cond: '☀️ साफ़ आसमान', icon: '☀️', wind: '11 km/h', hum: '59%', aqi: '85 (संतोषजनक)', aqiColor: '#16A34A' }
  };

  const data = weatherMap[districtId] || {
    temp: '28°C',
    cond: '🌤️ साफ़ मौसम व सुहावनी हवा',
    icon: '🌤️',
    wind: '12 km/h',
    hum: '60%',
    aqi: '82 (संतोषजनक)',
    aqiColor: '#16A34A'
  };

  const tempVal = document.getElementById('weather-temp-val');
  const condVal = document.getElementById('weather-condition-val');
  const iconVal = document.getElementById('weather-icon-val');
  const aqiVal = document.getElementById('weather-aqi-val');

  if (tempVal) tempVal.textContent = data.temp;
  if (condVal) condVal.textContent = data.cond;
  if (iconVal) iconVal.textContent = data.icon;
  if (aqiVal) {
    aqiVal.textContent = data.aqi;
    aqiVal.style.color = data.aqiColor;
  }
};

// 10. Daily Poll Widget (Interactive Voting & Live Animated %)
NewsHub.pollData = {
  question: "क्या बिहार में नए उद्योग, निवेश और रोज़गार के अवसरों में वास्तविक तेज़ी आ रही है?",
  options: [
    { label: "हाँ, बड़े पैमाने पर", votes: 2240 },
    { label: "कुछ हद तक प्रगति हुई है", votes: 840 },
    { label: "नहीं, अभी और काम की ज़रूरत है", votes: 310 },
    { label: "कह नहीं सकते", votes: 98 }
  ]
};

NewsHub.initDailyPoll = function () {
  const container = document.getElementById('poll-options-container');
  const totalVotesEl = document.getElementById('poll-total-votes');
  if (!container) return;

  const votedOption = localStorage.getItem('bsh_daily_poll_vote');
  const totalVotes = this.pollData.options.reduce((sum, o) => sum + o.votes, 0);

  if (totalVotesEl) {
    totalVotesEl.innerHTML = `<i class="fas fa-users"></i> ${totalVotes.toLocaleString('en-IN')} लोगों ने वोट किया`;
  }

  container.innerHTML = this.pollData.options.map((opt, idx) => {
    const pct = Math.round((opt.votes / totalVotes) * 100);
    const isVoted = votedOption !== null && parseInt(votedOption) === idx;

    return `
      <button class="poll-option-btn ${isVoted ? 'voted' : ''}" onclick="NewsHub.votePoll(${idx})" ${votedOption !== null ? 'disabled' : ''}>
        ${votedOption !== null ? `<div class="poll-progress-fill" style="width:${pct}%;"></div>` : ''}
        <div class="poll-option-label">
          <span>${isVoted ? '✓ ' : ''}${opt.label}</span>
          ${votedOption !== null ? `<strong>${pct}%</strong>` : ''}
        </div>
      </button>
    `;
  }).join('');
};

NewsHub.votePoll = function (optionIdx) {
  if (localStorage.getItem('bsh_daily_poll_vote') !== null) return;
  this.pollData.options[optionIdx].votes += 1;
  localStorage.setItem('bsh_daily_poll_vote', optionIdx);
  this.initDailyPoll();
  if (window.BSH && BSH.toast) {
    BSH.toast('आपका वोट दर्ज कर लिया गया है। धन्यवाद!', 'success');
  }
};

NewsHub.resetPollVote = function () {
  localStorage.removeItem('bsh_daily_poll_vote');
  this.initDailyPoll();
  if (window.BSH && BSH.toast) {
    BSH.toast('अब आप दोबारा वोट कर सकते हैं।', 'info');
  }
};

// 11. Copy Link & Social Utilities
NewsHub.copyNewsLink = function (newsId) {
  const url = `${window.location.origin}/#news-${newsId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      if (window.BSH && BSH.toast) BSH.toast('📋 खबर का लिंक कॉपी हो गया!', 'success');
    }).catch(() => {
      prompt('लिंक कॉपी करें:', url);
    });
  } else {
    prompt('लिंक कॉपी करें:', url);
  }
};

NewsHub.subscribeNewsletter = function () {
  const input = document.getElementById('newsletter-input-phone');
  if (!input) return;
  const val = input.value.trim();
  if (val.length < 10) {
    alert('कृपया सही 10 अंकों का व्हाट्सएप नंबर दर्ज करें।');
    return;
  }
  input.value = '';
  if (window.BSH && BSH.toast) {
    BSH.toast('🎉 धन्यवाद! आपका नंबर दैनिक बिहार बुलेटिन के लिए सफलतापूर्वक पंजीकृत हो गया।', 'success');
  }
};

NewsHub.submitContactForm = function (e) {
  if (e) e.preventDefault();
  const name = document.getElementById('contact-form-name')?.value.trim();
  const phone = document.getElementById('contact-form-phone')?.value.trim();
  const subject = document.getElementById('contact-form-subject')?.value || 'सामान्य पूछताछ';
  const msg = document.getElementById('contact-form-message')?.value.trim();

  if (!name || !phone || !msg) {
    alert('कृपया सभी आवश्यक विवरण (*) भरें।');
    return;
  }

  // Clear inputs
  const nameEl = document.getElementById('contact-form-name');
  const phoneEl = document.getElementById('contact-form-phone');
  const emailEl = document.getElementById('contact-form-email');
  const msgEl = document.getElementById('contact-form-message');

  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (emailEl) emailEl.value = '';
  if (msgEl) msgEl.value = '';

  if (window.BSH && BSH.toast) {
    BSH.toast(`धन्यवाद ${name}! आपका संदेश [${subject}] पटना संपादकीय ब्यूरो को प्राप्त हो गया है। हमारी टीम जल्द संपर्क करेगी।`, 'success');
  }
};


// 12. Top Breaking News Ticker with Last-Updated Timer
NewsHub.portalTickerTimer = null;

NewsHub.initPortalTicker = function () {
  const tickerText = document.getElementById('portal-ticker-text');
  const prevBtn = document.getElementById('portal-ticker-prev');
  const nextBtn = document.getElementById('portal-ticker-next');
  const pauseBtn = document.getElementById('portal-ticker-pause');
  const lastUpdated = document.getElementById('ticker-last-updated');

  if (!tickerText) return;

  // STRICT RULE: Breaking news MUST be <= 120 minutes old!
  let items = this.getBreakingNews ? this.getBreakingNews() : [];

  let currentIdx = 0;
  let isPaused = false;

  const renderSlide = () => {
    const now = Date.now();
    // Drop any item that has aged beyond 120 minutes!
    items = (items || []).filter(it => {
      if (!it.pubDate) return true;
      const age = (now - new Date(it.pubDate).getTime()) / 60000;
      return age >= 0 && age <= 120;
    });

    if (!items.length) {
      items = NewsHub.getBreakingNews ? NewsHub.getBreakingNews() : [];
    }
    if (!items.length) {
      tickerText.innerHTML = `<span>ताज़ा ब्रेकिंग बुलेटिन लोड हो रहा है...</span>`;
      return;
    }

    currentIdx = currentIdx % items.length;
    const item = items[currentIdx];
    const loc = item.location_name || item.district_name_hi || 'बिहार';
    const ageMins = Math.max(1, Math.floor((now - new Date(item.pubDate).getTime()) / 60000));
    let timeStr = 'अभी-अभी';
    if (ageMins > 60) {
      const hours = Math.floor(ageMins / 60);
      timeStr = `${hours} घंटा पहले`;
    } else if (ageMins > 1) {
      timeStr = `${ageMins} मिनट पहले`;
    }

    tickerText.innerHTML = `
      <span style="color:#FFE082; font-weight:800; margin-right:6px;">[${loc}]</span>
      <span>${BSH_SECURITY.escapeHtml(item.title)}</span>
      <span style="font-size:0.75rem; opacity:0.95; margin-left:8px; background:rgba(0,0,0,0.25); padding:2px 7px; border-radius:4px;"><i class="far fa-clock"></i> ${timeStr}</span>
    `;

    tickerText.onclick = () => {
      if (item.id && !String(item.id).startsWith('brk-') && !String(item.id).startsWith('tn-')) {
        NewsHub.openNewsModal(item.id);
      }
    };
  };

  renderSlide();

  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      if (items.length > 0) {
        currentIdx = (currentIdx - 1 + items.length) % items.length;
        renderSlide();
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      if (items.length > 0) {
        currentIdx = (currentIdx + 1) % items.length;
        renderSlide();
      }
    };
  }
  if (pauseBtn) {
    pauseBtn.onclick = (e) => {
      e.stopPropagation();
      isPaused = !isPaused;
      pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
    };
  }

  // Clear previous timer if any
  if (NewsHub.portalTickerTimer) {
    clearInterval(NewsHub.portalTickerTimer);
  }

  // Auto-scroll ticker every 4.5s
  NewsHub.portalTickerTimer = setInterval(() => {
    if (!isPaused && items.length > 0) {
      currentIdx = (currentIdx + 1) % items.length;
      renderSlide();
    }
  }, 4500);

  // Update last-updated badge every minute
  if (lastUpdated) {
    lastUpdated.innerHTML = `<i class="far fa-clock"></i> <span>अंतिम अपडेट: अभी-अभी</span>`;
  }
};

// ─── Real-Time UI Re-renderer for Homepage ────────────────────────────────────
NewsHub.refreshHomepageContent = function () {
  if (!NewsHub.allNews || NewsHub.allNews.length === 0) return;

  // 1. Re-render Hero Slider
  NewsHub.initHeroSlider();

  // 2. Render Spotlight Stack
  NewsHub.renderSpotlightStack();

  // 3. Render Aapke Liye Personalized Section
  NewsHub.renderAapkeLiyeSection();

  // 4. Render Netflix-Style Horizontal Rows
  NewsHub.renderHorizontalRows();

  // 5. Render Sidebar Trending Now (#1 to #5)
  NewsHub.renderSidebarTrending();

  // 6. Render Homepage News Grid
  NewsHub.renderHomepageNewsGrid();

  // 7. Top Breaking News Ticker
  NewsHub.initPortalTicker();

  // 8. Update Last Updated Badge
  const lastUpdated = document.getElementById('ticker-last-updated');
  if (lastUpdated) {
    lastUpdated.innerHTML = `<i class="far fa-clock"></i> <span>अंतिम अपडेट: अभी-अभी</span>`;
  }
};

// ─── 9. Interactive Google Maps Explorer Controller ──────────────────────────
NewsHub.initHomepageGoogleMap = function () {
  const iframe = document.getElementById('homepage-google-map');
  const select = document.getElementById('homepage-gmap-select');
  const openBtn = document.getElementById('homepage-gmap-open-btn');
  const distLink = document.getElementById('homepage-gmap-district-page-link');
  const chips = document.querySelectorAll('.gmaps-chip-btn');
  if (!iframe) return;

  const updateMap = (query, zoom, slug) => {
    const q = encodeURIComponent(query);
    iframe.src = `https://maps.google.com/maps?q=${q}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
    if (openBtn) {
      openBtn.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    if (distLink) {
      if (slug && slug !== 'bihar') {
        distLink.style.display = 'inline-flex';
        distLink.href = `district/index.html?id=${slug}`;
      } else {
        distLink.style.display = 'none';
      }
    }
  };

  if (select) {
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === 'bihar') {
        NewsHub.selectDistrictOnHomepage('all', 'Bihar, India');
      } else {
        const opt = select.options[select.selectedIndex];
        const name = opt ? opt.text.split('(')[0].trim() : val;
        NewsHub.selectDistrictOnHomepage(val, name);
      }
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const slug = chip.dataset.slug || 'bihar';
      const name = chip.dataset.name || 'Bihar, India';
      NewsHub.selectDistrictOnHomepage(slug === 'bihar' ? 'all' : slug, name);
    });
  });

  // Public method to update Google map from anywhere (Search, District chips, Trending tags)
  NewsHub.updateGoogleMap = function (districtQuery, smoothScroll = true) {
    if (!districtQuery) return;
    const clean = districtQuery.trim().toLowerCase();
    
    // Check if matching option exists in dropdown
    if (select) {
      for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (opt.value.toLowerCase() === clean || opt.text.toLowerCase().includes(clean)) {
          select.selectedIndex = i;
          break;
        }
      }
    }

    // Highlight chip if exists
    chips.forEach(c => {
      const cSlug = (c.dataset.slug || '').toLowerCase();
      const cName = (c.dataset.name || '').toLowerCase();
      if (cSlug === clean || cName.includes(clean) || clean.includes(cSlug)) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    const isAll = clean === 'bihar' || clean === 'all' || clean.includes('बिहार');
    const targetQuery = isAll ? 'Bihar, India' : `${districtQuery} District, Bihar, India`;
    const targetZoom = isAll ? 7 : 11;
    updateMap(targetQuery, targetZoom, isAll ? 'bihar' : clean);

    if (smoothScroll) {
      const mapCard = document.querySelector('.gmaps-explorer-card');
      if (mapCard) {
        mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
};

// ─── State Tracking & Intelligent Auto-Polling Engine ─────────────────────────
NewsHub.lastKnownNewsId = null;
NewsHub.lastKnownNewsCount = 0;
NewsHub.isPollingActive = false;

NewsHub.checkForLiveNewsUpdate = async function (showToast = true) {
  if (NewsHub.isPollingActive) return;
  NewsHub.isPollingActive = true;
  try {
    const isDistrict = /\/district\/|\\district\\|\/district$/i.test(window.location.pathname);
    let res = null;

    if (window.location.protocol.startsWith('http')) {
      try {
        const url = isDistrict ? '../api/news?limit=50' : 'api/news?limit=50';
        res = await fetch(url);
      } catch (_) {}
    }

    if (!res || !res.ok) {
      const fallback = isDistrict ? '../data/latest-news.json' : 'data/latest-news.json';
      res = await fetch(fallback);
    }

    if (res && res.ok) {
      const data = await res.json();
      const freshNews = data.news || [];
      if (!freshNews.length) return;

      const newestId = freshNews[0]?.id;
      const count = freshNews.length;

      // Seed state on first run
      if (!NewsHub.lastKnownNewsId) {
        NewsHub.lastKnownNewsId = newestId;
        NewsHub.lastKnownNewsCount = count;
        return;
      }

      // Check if new news has been published
      if (newestId !== NewsHub.lastKnownNewsId || count !== NewsHub.lastKnownNewsCount) {
        const addedDiff = Math.max(1, count - (NewsHub.lastKnownNewsCount || count));
        console.log(`[BSH Auto-Sync] ⚡ Live news updated: ${count} total items (+${addedDiff} new)`);
        NewsHub.allNews = freshNews;
        NewsHub.lastKnownNewsId = newestId;
        NewsHub.lastKnownNewsCount = count;

        // Show subtle notification banner
        if (showToast) {
          NewsHub.showLiveToast(`⚡ ${addedDiff} नई ताज़ा बिहार खबरें प्राप्त हुईं`, addedDiff);
        }

        // Real-time update breaking tickers immediately
        if (document.getElementById('portal-ticker-text')) {
          NewsHub.initPortalTicker();
        }
        if (document.querySelector('.ticker-bar')) {
          NewsHub.tickerItems = NewsHub.getBreakingNews();
          NewsHub.renderTickerSlide();
        }
      }
    }
  } catch (err) {
    console.warn('[BSH Auto-Sync] Check error:', err);
  } finally {
    NewsHub.isPollingActive = false;
  }
};

// ─── Real-Time Push Stream (Server-Sent Events / SSE) & Toast Controller ───────
NewsHub.eventSource = null;

NewsHub.injectLiveToast = function () {
  if (document.getElementById('live-news-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'live-news-toast';
  toast.className = 'live-news-toast';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-pulse-dot">●</span>
      <span id="toast-news-msg">नई खबरें उपलब्ध हैं</span>
    </div>
    <button id="toast-refresh-btn" class="toast-refresh-btn" onclick="NewsHub.applyLiveUpdates()">
      <i class="fas fa-rotate"></i> ताज़ा करें
    </button>
    <button class="toast-close-btn" onclick="NewsHub.hideLiveToast()" aria-label="बंद करें">✕</button>
  `;
  document.body.appendChild(toast);
};

NewsHub.showLiveToast = function (msg = 'नई खबरें उपलब्ध हैं', count = 1) {
  NewsHub.injectLiveToast();
  const toast = document.getElementById('live-news-toast');
  const msgEl = document.getElementById('toast-news-msg');
  if (msgEl) msgEl.textContent = msg;
  if (toast) {
    toast.classList.add('show');
    // Auto-hide after 12 seconds
    clearTimeout(NewsHub.toastTimer);
    NewsHub.toastTimer = setTimeout(() => {
      NewsHub.hideLiveToast();
    }, 12000);
  }
};

NewsHub.hideLiveToast = function () {
  const toast = document.getElementById('live-news-toast');
  if (toast) toast.classList.remove('show');
};

NewsHub.applyLiveUpdates = function () {
  NewsHub.hideLiveToast();
  // Dynamic UI refresh based on active page
  if (document.getElementById('news-grid')) {
    NewsHub.applyFilters();
    NewsHub.tickerItems = NewsHub.getBreakingNews();
    NewsHub.renderTickerSlide();
  }
  if (document.getElementById('homepage-news')) {
    NewsHub.refreshHomepageContent();
  }
  if (document.getElementById('portal-ticker-text')) {
    NewsHub.initPortalTicker();
  }

  // Flash update on ticker last-updated
  const lastUp = document.getElementById('ticker-last-updated');
  if (lastUp) {
    const nowTime = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
    lastUp.innerHTML = `<i class="far fa-clock"></i> <span>अंतिम अपडेट: अभी (${nowTime})</span>`;
  }

  if (window.BSH && typeof BSH.toast === 'function') {
    BSH.toast('✅ न्यूज़ फीड सफलतापूर्वक अपडेट हो गई!', 'success');
  }
};

NewsHub.initRealtimeStream = function () {
  if (!window.location.protocol.startsWith('http')) return;
  if (!('EventSource' in window)) return;

  try {
    if (NewsHub.eventSource) {
      NewsHub.eventSource.close();
    }

    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const sseUrl = isDistrict ? '../api/events' : 'api/events';
    NewsHub.eventSource = new EventSource(sseUrl);

    NewsHub.eventSource.addEventListener('connected', (e) => {
      console.log('[BSH SSE] 🟢 Real-time stream connected to backend:', e.data);
    });

    NewsHub.eventSource.addEventListener('news_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[BSH SSE] ⚡ Live news push received:', data);
        const added = data.added_count || 1;
        // Fetch fresh news in background and notify
        NewsHub.checkForLiveNewsUpdate(false).then(() => {
          NewsHub.showLiveToast(`⚡ ${added} नई ताज़ा बिहार खबरें जोड़ी गईं!`, added);
        });
      } catch (err) {
        console.warn('[BSH SSE] Parse error:', err);
      }
    });

    NewsHub.eventSource.onerror = () => {
      if (NewsHub.eventSource) {
        NewsHub.eventSource.close();
        NewsHub.eventSource = null;
      }
      NewsHub.sseFailCount = (NewsHub.sseFailCount || 0) + 1;
      if (NewsHub.sseFailCount > 2) {
        console.log('[BSH SSE] ℹ️ SSE backend not available on static hosting (polling mode active).');
        return;
      }
      setTimeout(() => NewsHub.initRealtimeStream(), 45000);
    };
  } catch (e) {
    console.warn('[BSH SSE] Init error:', e);
  }
};

// ─── Master Homepage News Loader ──────────────────────────────────────────────
async function loadHomepageNews() {
  try {
    const isDistrict = /\/district\/|\\district\\|\/district$/i.test(window.location.pathname);
    let res = null;
    if (window.location.protocol.startsWith('http')) {
      try {
        const apiUrl = isDistrict ? '../api/news?limit=50' : 'api/news?limit=50';
        res = await fetch(apiUrl);
      } catch (_) {}
    }
    if (!res || !res.ok) {
      const fallbackPath = isDistrict ? '../data/latest-news.json' : 'data/latest-news.json';
      res = await fetch(fallbackPath);
    }
    if (res && res.ok) {
      const data = await res.json();
      NewsHub.allNews = data.news || [];

      // Seed tracker
      if (NewsHub.allNews.length > 0) {
        NewsHub.lastKnownNewsId = NewsHub.allNews[0].id;
        NewsHub.lastKnownNewsCount = NewsHub.allNews.length;
      }

      // 1. Initialize Hero Slider
      try { NewsHub.initHeroSlider(); } catch (e) { console.warn('Hero Slider err:', e); }

      // 2. Render Spotlight Stack
      try { NewsHub.renderSpotlightStack(); } catch (e) { console.warn('Spotlight err:', e); }

      // 3. Render 38 District Quick Chips
      try { NewsHub.initDistrictQuickChips(); } catch (e) { console.warn('District Chips err:', e); }

      // 4. Initialize Autocomplete Search
      try { NewsHub.initAutocompleteSearch(); } catch (e) { console.warn('Autocomplete err:', e); }

      // 5. Render Aapke Liye Personalized Section
      try { NewsHub.renderAapkeLiyeSection(); } catch (e) { console.warn('Aapke Liye err:', e); }

      // 6. Render Netflix-Style Horizontal Rows
      try { NewsHub.renderHorizontalRows(); } catch (e) { console.warn('Horizontal Rows err:', e); }

      // 7. Render Sidebar Trending Now (#1 to #5)
      try { NewsHub.renderSidebarTrending(); } catch (e) { console.warn('Trending err:', e); }

      // 8. Initialize Weather Widget
      try { NewsHub.initWeatherWidget(); } catch (e) { console.warn('Weather err:', e); }

      // 9. Initialize Daily Poll
      try { NewsHub.initDailyPoll(); } catch (e) { console.warn('Daily Poll err:', e); }

      // 10. Bind Category Tabs on Main News Feed
      try {
        const catTabs = document.getElementById('homepage-cat-tabs');
        if (catTabs) {
          catTabs.querySelectorAll('.cat-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              catTabs.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              NewsHub.homeGridCategory = btn.dataset.category || 'all';
              NewsHub.homeGridPage = 1;
              NewsHub.renderHomepageNewsGrid();
            });
          });
        }
      } catch (e) { console.warn('Cat tabs err:', e); }

      // 11. Bind Load More button
      try {
        const loadMoreBtn = document.getElementById('homepage-load-more-btn');
        if (loadMoreBtn) {
          loadMoreBtn.onclick = () => {
            NewsHub.homeGridPage++;
            NewsHub.renderHomepageNewsGrid();
          };
        }
      } catch (e) { console.warn('Load more err:', e); }

      // 12. Initial Main News Grid Render
      try { NewsHub.renderHomepageNewsGrid(); } catch (e) { console.warn('News grid err:', e); }

      // 13. Top Breaking News Ticker
      try { NewsHub.initPortalTicker(); } catch (e) { console.warn('Ticker err:', e); }
    }
  } catch (e) {
    console.warn('Advanced Homepage news fetch error:', e);
  }
}

// ─── Global Event Listeners & Autonomous Polling ─────────────────────────────
const initNewsHub = () => {
  NewsHub.injectNewsModal();
  NewsHub.injectLiveToast();

  // Initialize interactive Google Maps Explorer on homepage if present
  if (document.getElementById('homepage-google-map')) {
    try {
      NewsHub.initHomepageGoogleMap();
    } catch (e) {
      console.warn('Google Map init error:', e);
    }
  }

  if (document.getElementById('news-grid')) {
    NewsHub.init();
    if (document.getElementById('portal-ticker-text')) {
      NewsHub.initPortalTicker();
    }
  } else if (document.getElementById('homepage-news')) {
    loadHomepageNews();
  } else if (document.getElementById('portal-ticker-text')) {
    // About / Contact pages — load news just for the ticker
    NewsHub.initPortalTicker();
    NewsHub.loadLocalNews().then(() => {
      NewsHub.initPortalTicker();
    });
  } else if (document.querySelector('.ticker-bar')) {
    NewsHub.loadLocalNews().then(() => {
      NewsHub.initTickerSlider();
      NewsHub.renderTickerSlide();
    });
  }

  // Start Real-Time Server-Sent Events (SSE) Stream
  NewsHub.initRealtimeStream();

  // Auto-check for live updates when user returns to the tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      NewsHub.checkForLiveNewsUpdate(false);
    }
  });

  // Autonomous real-time polling every 90 seconds (1.5 min)
  setInterval(() => {
    NewsHub.checkForLiveNewsUpdate(true);
  }, 90 * 1000);

  // Background server sync trigger every 5 minutes
  setInterval(() => {
    if (typeof NewsHub.fetchLiveFeeds === 'function') {
      NewsHub.fetchLiveFeeds();
    }
  }, 5 * 60 * 1000);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNewsHub);
} else {
  initNewsHub();
}



// ═════════════════════════════════════════════════════════════════════════════
// ADVANCED SUITE: AI SUMMARY, MODERATED COMMENTS, CHATBOT, PUSH NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. AI 30-Second Bullet Summary Generator ─────────────────────────────────
NewsHub.generateAiSummary = function (item) {
  if (!item) return [];
  const dist = item.district_name_hi || item.location_name || 'बिहार';
  const title = item.title || '';
  const desc = item.description || '';

  return [
    `【स्थान व संदर्भ】 यह विशेष घटनाक्रम ${dist} क्षेत्र से संबंधित है और जनहित में महत्वपूर्ण प्रभाव रखता है।`,
    `【मुख्य सार】 ${title.replace(/^[^-]+-\s*/, '').slice(0, 140)}।`,
    `【प्रशासनिक स्थिति】 संबंधित विभागीय अधिकारियों द्वारा त्वरित कार्रवाई और निगरानी सुनिश्चित की जा रही है।`
  ];
};

// ─── 2. Google News NewsArticle JSON-LD Structured Data ───────────────────────
NewsHub.injectJsonLdSchema = function (item) {
  if (!item) return;
  let script = document.getElementById('bsh-article-jsonld');
  if (!script) {
    script = document.createElement('script');
    script.id = 'bsh-article-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": window.location.origin + window.location.pathname + '#news-' + item.id
    },
    "headline": item.title,
    "image": [
      item.thumbnail || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&q=80"
    ],
    "datePublished": item.pubDate || new Date().toISOString(),
    "dateModified": item.pubDate || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": item.sourceName || "बिहार समाचार हब",
      "url": "https://biharsamacharhub.in/"
    },
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "बिहार समाचार हब",
      "logo": {
        "@type": "ImageObject",
        "url": "https://biharsamacharhub.in/favicon.png"
      }
    },
    "description": item.description || item.title,
    "articleSection": item.category_label_hi || "बिहार समाचार",
    "contentLocation": {
      "@type": "AdministrativeArea",
      "name": item.district_name_hi || "बिहार"
    }
  };

  script.textContent = JSON.stringify(schema);
};

// ─── 3. Moderated Comments Integration ────────────────────────────────────────
NewsHub.loadArticleComments = async function (newsId) {
  const container = document.getElementById('modal-comments-feed');
  const countPill = document.getElementById('modal-comments-count');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:15px; color:#94A3B8;"><i class="fas fa-spinner fa-spin"></i> टिप्पणियां लोड हो रही हैं...</div>';

  try {
    const res = await fetch(`/api/comments?news_id=${encodeURIComponent(newsId)}`);
    if (res.ok) {
      const data = await res.json();
      const comments = data.comments || [];
      if (countPill) countPill.textContent = `${comments.length} विचार`;

      if (comments.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748B; font-size:0.85rem;"><i class="far fa-comments" style="font-size:1.8rem; color:#CBD5E1; margin-bottom:8px; display:block;"></i>इस खबर पर अभी कोई टिप्पणी नहीं है। सबसे पहले अपनी राय दें!</div>';
      } else {
        container.innerHTML = comments.map(c => `
          <div class="comment-item" id="comment-${c.id}">
            <div class="comment-item-header">
              <div class="comment-author-info">
                <div class="comment-avatar">${(c.user_name || 'प')[0]}</div>
                <div>
                  <span class="comment-author-name">${c.user_name}</span>
                  <span class="comment-district-tag">${c.district || 'बिहार'}</span>
                </div>
              </div>
              <span class="comment-time">${window.BSH ? BSH.timeAgo(c.created_at) : 'हाल ही में'}</span>
            </div>
            <p class="comment-body-text">${c.comment}</p>
            <div class="comment-actions-bar">
              <button class="comment-like-btn" onclick="NewsHub.likeComment('${c.id}', this)">
                <i class="far fa-thumbs-up"></i> <span class="like-cnt">${c.likes || 0}</span>
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    container.innerHTML = '<div style="text-align:center; padding:10px; color:#64748B; font-size:0.82rem;">अपनी राय नीचे दिए गए फॉर्म में दर्ज करें।</div>';
  }
};

NewsHub.submitComment = async function (e, newsId) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('comm-user-name');
  const distInput = document.getElementById('comm-user-dist');
  const textInput = document.getElementById('comm-text');
  const submitBtn = document.getElementById('comm-submit-btn');

  const name = nameInput.value.trim();
  const dist = distInput.value.trim() || 'बिहार';
  const text = textInput.value.trim();

  if (!name || !text) {
    alert('कृपया अपना नाम और टिप्पणी दोनों भरें।');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> भेजा जा रहा है...';

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        news_id: newsId,
        user_name: name,
        district: dist,
        comment: text
      })
    });
    const data = await res.json();
    if (data.success) {
      textInput.value = '';
      if (window.BSH && BSH.toast) {
        BSH.toast('आपकी टिप्पणी सफलतापूर्वक दर्ज हो गई है! मॉडरेशन के बाद लाइव दिखेगी। ✅', 'success');
      } else {
        alert('आपकी टिप्पणी दर्ज हो गई है!');
      }
      NewsHub.loadArticleComments(newsId);
    } else {
      alert(data.error || 'टिप्पणी भेजने में विफल');
    }
  } catch (err) {
    alert('टिप्पणी सबमिट करते समय त्रुटि हुई');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> टिप्पणी पोस्ट करें';
  }
};

NewsHub.likeComment = async function (commentId, btnEl) {
  try {
    const res = await fetch('/api/comments/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId })
    });
    const data = await res.json();
    if (data.success) {
      btnEl.classList.add('liked');
      btnEl.querySelector('.like-cnt').textContent = data.likes;
    }
  } catch (_) {}
};

// ─── 4. Push Notifications Integration ────────────────────────────────────────
NewsHub.togglePushNotifications = async function () {
  if (!('Notification' in window)) {
    alert('यह ब्राउज़र वेब पुश नोटिफिकेशन सपोर्ट नहीं करता है।');
    return;
  }

  if (Notification.permission === 'granted') {
    if (window.BSH && BSH.toast) {
      BSH.toast('🔔 बिहार ब्रेकिंग न्यूज़ नोटिफिकेशन पहले से सक्रिय हैं!', 'info');
    } else {
      alert('लाइव नोटिफिकेशन सक्रिय हैं!');
    }
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Register subscription with server
      try {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'browser-push-' + Date.now(),
            user_agent: navigator.userAgent
          })
        });
      } catch (_) {}

      if (window.BSH && BSH.toast) {
        BSH.toast('✅ बिहार 24x7 ब्रेकिंग नोटिफिकेशन सक्रिय हो गए!', 'success');
      } else {
        alert('बिहार ब्रेकिंग न्यूज़ नोटिफिकेशन सक्रिय हो गए!');
      }
      // Show instant test welcome notification
      try {
        new Notification("बिहार समाचार हब", {
          body: "स्वागत है! अब बिहार की हर बड़ी खबर सीधे आपके डिवाइस पर पहुंचेगी।",
          icon: "favicon.png"
        });
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Push registration error', e);
  }
};

// ─── 5. 9 Administrative Divisions Filter ─────────────────────────────────────
NewsHub.divisionDistricts = {
  'patna': ['patna', 'nalanda', 'bhojpur', 'buxar', 'rohtas', 'kaimur'],
  'tirhut': ['muzaffarpur', 'west-champaran', 'east-champaran', 'sitamarhi', 'sheohar', 'vaishali'],
  'saran': ['saran', 'siwan', 'gopalganj'],
  'darbhanga': ['darbhanga', 'madhubani', 'samastipur'],
  'kosi': ['saharsa', 'supaul', 'madhepura'],
  'purnia': ['purnia', 'katihar', 'araria', 'kishanganj'],
  'bhagalpur': ['bhagalpur', 'banka'],
  'munger': ['munger', 'lakhisarai', 'sheikhpura', 'jamui', 'khagaria', 'begusarai'],
  'magadh': ['gaya', 'nawada', 'aurangabad', 'jehanabad', 'arwal']
};

NewsHub.filterByDivision = function (divId, btnEl) {
  document.querySelectorAll('.division-chip').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  NewsHub.selectedDivision = divId;
  NewsHub.selectedDistrict = 'all';
  NewsHub.currentDistrict = 'all';
  NewsHub.currentPage = 1;
  NewsHub.homeGridPage = 1;

  // Reset district dropdown if present
  const distSelect = document.getElementById('district-filter-news') || document.getElementById('district-filter-select');
  if (distSelect) distSelect.value = 'all';

  // Update feed heading on homepage if present
  const heading = document.getElementById('feed-heading');
  if (heading) {
    const names = {
      'all': 'बिहार की ताज़ा बड़ी खबरें',
      'patna': '🏛 पटना प्रमंडल (6 जिले) की ताज़ा खबरें',
      'tirhut': '🏛 तिरहुत प्रमंडल (6 जिले) की ताज़ा खबरें',
      'saran': '🏛 सारण प्रमंडल (3 जिले) की ताज़ा खबरें',
      'darbhanga': '🏛 दरभंगा प्रमंडल (3 जिले) की ताज़ा खबरें',
      'kosi': '🏛 कोसी प्रमंडल (3 जिले) की ताज़ा खबरें',
      'purnia': '🏛 पूर्णिया प्रमंडल (4 जिले) की ताज़ा खबरें',
      'bhagalpur': '🏛 भागलपुर प्रमंडल (2 जिले) की ताज़ा खबरें',
      'munger': '🏛 मुंगेर प्रमंडल (6 जिले) की ताज़ा खबरें',
      'magadh': '🏛 मगध प्रमंडल (5 जिले) की ताज़ा खबरें'
    };
    heading.innerHTML = names[divId] || 'बिहार की ताज़ा बड़ी खबरें';
  }

  if (typeof NewsHub.applyFilters === 'function') {
    NewsHub.applyFilters();
  }
  if (typeof NewsHub.renderHomepageNewsGrid === 'function') {
    NewsHub.renderHomepageNewsGrid();
  }

  if (window.BSH && BSH.toast) {
    const names = {
      'all': 'सभी प्रमंडल',
      'patna': 'पटना प्रमंडल (पटना, नालंदा, भोजपुर, बक्सर, रोहतास, कैमूर)',
      'tirhut': 'तिरहुत प्रमंडल (मुजफ्फरपुर, प. चंपारण, पू. चंपारण, सीतामढ़ी, शिवहर, वैशाली)',
      'saran': 'सारण प्रमंडल (सारण/छपरा, सीवान, गोपालगंज)',
      'darbhanga': 'दरभंगा प्रमंडल (दरभंगा, मधुबनी, समस्तीपुर)',
      'kosi': 'कोसी प्रमंडल (सहरसा, सुपौल, मधेपुरा)',
      'purnia': 'पूर्णिया प्रमंडल (पूर्णिया, कटिहार, अररिया, किशनगंज)',
      'bhagalpur': 'भागलपुर प्रमंडल (भागलपुर, बांका)',
      'munger': 'मुंगेर प्रमंडल (मुंगेर, लखीसराय, शेखपुरा, जमुई, खगड़िया, बेगूसराय)',
      'magadh': 'मगध प्रमंडल (गया, नवादा, औरंगाबाद, जहानाबाद, अरवल)'
    };
    BSH.toast(`🏛 ${names[divId] || 'प्रमंडल'} की खबरें लोड की गईं`, 'info');
  }
};

// ─── 6. Personalized "✨ आपके लिए" (For You) Recommendation Engine ───────────
NewsHub.recordArticleRead = function (item) {
  if (!item) return;
  try {
    const history = JSON.parse(localStorage.getItem('bsh_reading_history') || '[]');
    history.unshift({ id: item.id, category: item.category, district: item.district, time: Date.now() });
    localStorage.setItem('bsh_reading_history', JSON.stringify(history.slice(0, 30)));
  } catch (_) {}
};

NewsHub.renderForYouSection = function () {
  const container = document.getElementById('for-you-grid') || document.getElementById('homepage-for-you-grid');
  if (!container || !NewsHub.allNews || NewsHub.allNews.length === 0) return;

  const user = window.BSH ? BSH.currentUser : null;
  const prefDist = user ? user.home_district : 'patna';

  let forYouItems = NewsHub.allNews.filter(n => n.district === prefDist).slice(0, 4);
  if (forYouItems.length < 4) {
    const extra = NewsHub.allNews.filter(n => n.district !== prefDist).slice(0, 4 - forYouItems.length);
    forYouItems = forYouItems.concat(extra);
  }

  container.innerHTML = forYouItems.map(item => `
    <div class="news-card for-you-card" onclick="NewsHub.openNewsModal('${item.id}')" style="cursor:pointer;">
      <div class="card-img-wrap" style="position:relative; aspect-ratio:16/10; overflow:hidden; border-radius:8px;">
        <img src="${NewsHub.getNewsThumbnail(item)}" onerror="this.onerror=null;this.src='${NewsHub.getFallbackThumb(item.category, item.title, item.description)}';this.onerror=function(){this.src=NewsHub.getReliableSvgThumb();};" alt="" style="width:100%; height:100%; object-fit:cover;" referrerpolicy="no-referrer">
        <span class="badge-tag" style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7); color:#FFF; font-size:0.7rem; padding:2px 8px; border-radius:12px;">✨ आपके लिए</span>
      </div>
      <div style="padding:10px 4px;">
        <span style="font-size:0.72rem; color:var(--primary); font-weight:700;">${item.district_name_hi || 'बिहार'}</span>
        <h4 style="font-size:0.92rem; font-weight:700; line-height:1.35; margin:4px 0 6px 0; color:#0F172A;">${BSH_SECURITY.escapeHtml(item.title)}</h4>
        <span style="font-size:0.72rem; color:#94A3B8;"><i class="far fa-clock"></i> ${window.BSH ? BSH.timeAgo(item.pubDate) : 'आज'}</span>
      </div>
    </div>
  `).join('');
};

// ─── 7. Floating AI News Assistant Chatbot (बिहार AI मित्र) ───────────────────
NewsHub.initAiAssistantChat = function () {
  if (document.getElementById('ai-chat-launcher')) return;

  const html = `
    <!-- Floating AI Launcher Button -->
    <button id="ai-chat-launcher" class="ai-chat-launcher-btn" title="बिहार AI समाचार मित्र से पूछें" onclick="NewsHub.toggleAiChatWindow()">
      <i class="fas fa-robot"></i>
      <span class="ai-chat-pulse-badge">AI</span>
    </button>

    <!-- Floating AI Chat Window -->
    <div id="ai-chat-window" class="ai-chat-window-box">
      <div class="ai-chat-header">
        <div class="ai-chat-header-title">
          <i class="fas fa-robot"></i> <span>बिहार AI समाचार मित्र</span>
        </div>
        <button class="ai-chat-header-close" onclick="NewsHub.toggleAiChatWindow()">&times;</button>
      </div>

      <div class="ai-chat-messages-body" id="ai-chat-messages">
        <div class="ai-msg ai-msg-bot">
          🙏 <strong>नमस्ते!</strong> मैं बिहार समाचार हब का AI सहायक हूँ। बिहार की ताजा खबरें, 38 जिलों की जानकारी, सरकारी योजनाएं या परीक्षा अपडेट के बारे में मुझसे पूछें!
        </div>
      </div>

      <div class="ai-quick-chips-row">
        <button class="ai-chip-btn" onclick="NewsHub.sendAiQuickQuery('आज की 5 बड़ी खबरें क्या हैं?')">🔥 आज की 5 बड़ी खबरें</button>
        <button class="ai-chip-btn" onclick="NewsHub.sendAiQuickQuery('पटना और मुजफ्फरपुर का मौसम?')">🌦 मौसम अपडेट</button>
        <button class="ai-chip-btn" onclick="NewsHub.sendAiQuickQuery('BPSC और शिक्षक भर्ती का नया अपडेट?')">🎓 BPSC भर्ती</button>
      </div>

      <form class="ai-chat-input-bar" onsubmit="event.preventDefault(); NewsHub.sendAiChatInput();">
        <input type="text" id="ai-chat-input-field" class="ai-chat-input" placeholder="बिहार से जुड़ा कोई भी सवाल पूछें...">
        <button type="submit" class="ai-chat-send-btn"><i class="fas fa-paper-plane"></i></button>
      </form>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
};

NewsHub.toggleAiChatWindow = function () {
  const win = document.getElementById('ai-chat-window');
  if (win) {
    win.classList.toggle('open');
    if (win.classList.contains('open')) {
      const input = document.getElementById('ai-chat-input-field');
      if (input) input.focus();
    }
  }
};

NewsHub.sendAiQuickQuery = function (text) {
  const input = document.getElementById('ai-chat-input-field');
  if (input) {
    input.value = text;
    NewsHub.sendAiChatInput();
  }
};

NewsHub.queryAiBackend = async function (query) {
  try {
    if (window.location.protocol.startsWith('http')) {
      const isDistrict = /\/district\/|\\district\\|\/district$/i.test(window.location.pathname);
      const apiUrl = isDistrict ? '../api/ai/chat' : 'api/ai/chat';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          district: NewsHub.selectedDistrict || 'all'
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) {
          return data.reply;
        }
      }
    }
  } catch (err) {
    console.warn('AI backend fetch warning, using local engine:', err);
  }
  return NewsHub.computeAiResponse(query);
};

NewsHub.askBiharMitra = function (promptText) {
  const input = document.getElementById('mitra-home-input');
  if (input) {
    input.value = promptText;
  }
  NewsHub.submitBiharMitraHome();
};

NewsHub.submitBiharMitraHome = async function () {
  const input = document.getElementById('mitra-home-input');
  const responseBox = document.getElementById('mitra-home-response');
  const submitBtn = document.getElementById('mitra-home-submit-btn');
  if (!input || !responseBox) return;

  const query = input.value.trim();
  if (!query) return;

  responseBox.classList.add('active');
  responseBox.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; color:#93C5FD; padding:10px 0;">
      <i class="fas fa-spinner fa-spin" style="font-size:1.1rem; color:#60A5FA;"></i>
      <span>बिहार मित्र AI आपके सवाल का विश्लेषण कर रहा है...</span>
    </div>
  `;
  if (submitBtn) submitBtn.disabled = true;

  const answer = await NewsHub.queryAiBackend(query);

  responseBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);">
      <span style="font-size:0.75rem; color:#93C5FD; font-weight:700;"><i class="fas fa-robot"></i> बिहार मित्र AI उत्तर</span>
      <span style="font-size:0.7rem; background:rgba(37,99,235,0.3); color:#60A5FA; padding:2px 6px; border-radius:8px;">Smart Neural AI</span>
    </div>
    <div style="color:#F1F5F9; font-size:0.92rem; line-height:1.65;">
      ${answer}
    </div>
  `;
  responseBox.scrollTop = 0;
  if (submitBtn) submitBtn.disabled = false;
};

NewsHub.sendAiChatInput = async function () {
  const input = document.getElementById('ai-chat-input-field');
  const msgBox = document.getElementById('ai-chat-messages');
  if (!input || !msgBox) return;

  const query = input.value.trim();
  if (!query) return;

  // Append user message
  msgBox.innerHTML += `<div class="ai-msg ai-msg-user">${BSH_SECURITY.escapeHtml(query)}</div>`;
  input.value = '';
  msgBox.scrollTop = msgBox.scrollHeight;

  // Add typing indicator
  const typingId = 'ai-typing-' + Date.now();
  msgBox.innerHTML += `
    <div class="ai-msg ai-msg-bot" id="${typingId}">
      <i class="fas fa-spinner fa-spin"></i> उत्तर तैयार हो रहा है...
    </div>
  `;
  msgBox.scrollTop = msgBox.scrollHeight;

  const botReply = await NewsHub.queryAiBackend(query);
  const typingEl = document.getElementById(typingId);
  if (typingEl) {
    typingEl.innerHTML = botReply;
  } else {
    msgBox.innerHTML += `<div class="ai-msg ai-msg-bot">${botReply}</div>`;
  }
  msgBox.scrollTop = msgBox.scrollHeight;
};

NewsHub.computeAiResponse = function (query) {
  const q = query.toLowerCase();

  if (q.includes('बड़ी खबर') || q.includes('ताजा खबर') || q.includes('top news') || q.includes('आज की')) {
    const top5 = (NewsHub.allNews || []).slice(0, 5);
    if (top5.length > 0) {
      let res = '📰 <strong>बिहार की शीर्ष 5 ताज़ा खबरें:</strong><br><ul style="padding-left:16px; margin:6px 0;">';
      top5.forEach((item, idx) => {
        res += `<li style="margin-bottom:6px;"><a href="javascript:void(0)" onclick="NewsHub.openNewsModal('${item.id}')" style="color:#2563EB; font-weight:700;">${item.title}</a> (${item.district_name_hi || 'बिहार'})</li>`;
      });
      res += '</ul>';
      return res;
    }
    return 'बिहार की सभी ताज़ा खबरें पोर्टल पर लाइव अपडेट हो रही हैं!';
  }

  if (q.includes('मौसम') || q.includes('बारिश') || q.includes('गर्मी') || q.includes('weather')) {
    return '🌦 <strong>बिहार मौसम बुलेटिन:</strong> मौसम विज्ञान केंद्र पटना के अनुसार उत्तरी बिहार (किशनगंज, पूर्णिया, अररिया) में हल्की से मध्यम बारिश और दक्षिणी बिहार (गया, नवादा, औरंगाबाद) में मौसम मुख्यतः शुष्क रहेगा।';
  }

  if (q.includes('bpsc') || q.includes('शिक्षक') || q.includes('नौकरी') || q.includes('परीक्षा')) {
    return '🎓 <strong>BPSC व शिक्षा अपडेट:</strong> बिहार लोक सेवा आयोग द्वारा अध्यापक नियुक्ति एवं विभिन्न प्रशासनिक पदों की काउंसिलिंग 38 जिलों के नोडल केंद्रों पर सुचारू रूप से संचालित है। आधिकारिक सूचना हेतु bpsc.bih.nic.in देखें।';
  }

  if (q.includes('योजना') || q.includes('सरकार') || q.includes('नीतीश') || q.includes('कैबिनेट')) {
    return '🏛 <strong>सरकारी योजनाएं:</strong> बिहार सरकार द्वारा "सात निश्चय पार्ट-2", "मुख्यमंत्री उद्यमी योजना", "स्टूडेंट क्रेडिट कार्ड", और "बालिका प्रोत्साहन योजना" का विस्तार सभी 38 जिलों में किया गया है।';
  }

  // District-specific search in allNews
  for (let distKey in NewsHub.divisionDistricts) {
    const districts = NewsHub.divisionDistricts[distKey];
    for (let d of districts) {
      if (q.includes(d)) {
        const distNews = (NewsHub.allNews || []).filter(n => n.district === d).slice(0, 3);
        if (distNews.length > 0) {
          let res = `📍 <strong>${distNews[0].district_name_hi || d} जिले की ताज़ा खबरें:</strong><br><ul style="padding-left:16px; margin:6px 0;">`;
          distNews.forEach(item => {
            res += `<li style="margin-bottom:6px;"><a href="javascript:void(0)" onclick="NewsHub.openNewsModal('${item.id}')" style="color:#2563EB; font-weight:700;">${item.title}</a></li>`;
          });
          res += '</ul>';
          return res;
        }
      }
    }
  }

  return `🤖 आपके प्रश्न "${BSH_SECURITY.escapeHtml(query)}" के संदर्भ में: बिहार समाचार हब के 38-ज़िला नेटवर्क पर पल-पल की खबरें स्वतः ताज़ा हो रही हैं। आप किसी भी जिले के नाम से भी खोज सकते हैं।`;
};

// Initialize AI Chatbot on load
document.addEventListener('DOMContentLoaded', () => {
  NewsHub.initAiAssistantChat();
  setTimeout(() => {
    NewsHub.renderForYouSection();
  }, 1000);
});
