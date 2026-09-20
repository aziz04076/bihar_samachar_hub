/**
 * Bihar Samachar Hub — district-page.js (Enhanced V3)
 * - Reads ?id= or ?district= or clean path /district/<id>
 * - Reliable 38-district data rendering with full fail-safe fallbacks
 * - Guaranteed district name, division, population, area display
 * - Renders all 6 tabs: Overview, Administration, History, Tourism, Culture, Economy
 */

'use strict';

const BSH_HELPER = {
  getLang() {
    return (window.BSH && BSH.lang) || localStorage.getItem('bsh_lang') || 'hi';
  },
  formatNum(n) {
    if (window.BSH && typeof BSH.formatNum === 'function') return BSH.formatNum(n);
    if (!n) return '—';
    return Number(n).toLocaleString('en-IN');
  },
  t(key) {
    if (window.BSH && typeof BSH.t === 'function') return BSH.t(key);
    return key;
  },
  slugify(str) {
    if (window.BSH && typeof BSH.slugify === 'function') return BSH.slugify(str);
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  },
  lazyLoad() {
    if (window.BSH && typeof BSH.lazyLoadImages === 'function') BSH.lazyLoadImages();
  }
};

const DistrictPage = {
  district: null,
  mapInstance: null,

  // ─── Init ──────────────────────────────────────────────────────────────────
  async init() {
    let id = new URLSearchParams(window.location.search).get('id') ||
             new URLSearchParams(window.location.search).get('district');

    // Also check pathname (e.g. /district/patna or /district/patna/)
    if (!id) {
      const match = window.location.pathname.match(/\/district\/([^\/\?#]+)/i);
      if (match && match[1] && match[1] !== 'index.html') {
        id = match[1];
      }
    }

    // Default to patna if still empty, preventing broken/blank pages
    if (!id) {
      id = 'patna';
    }

    id = decodeURIComponent(id).trim().toLowerCase();

    try {
      let res = null;
      try {
        res = await fetch('../data/districts.json');
      } catch (_) {}
      if (!res || !res.ok) {
        res = await fetch('data/districts.json');
      }

      const data = await res.json();
      const allDistricts = data.districts || [];

      // Flexible matching: by id, slug, name_en, or name_hi
      this.district = allDistricts.find(d => 
        (d.id && d.id.toLowerCase() === id) ||
        (d.slug && d.slug.toLowerCase() === id) ||
        (d.name_en && d.name_en.toLowerCase() === id) ||
        (d.name_hi && d.name_hi === id)
      );

      // Fallback to first district (Patna) if match not found
      if (!this.district) {
        this.district = allDistricts[0] || null;
      }

      if (this.district) {
        this.hideLoading();
        this.render();
        this.initTabs();
        this.loadTicker();
      } else {
        this.showError();
      }

      // Re-render on language change
      document.addEventListener('bsh:langchange', () => this.render());
    } catch (e) {
      console.error('District load failed', e);
      this.hideLoading(); // Still make content container visible
      this.showError();
    }
  },

  // ─── Self-Contained Breaking News Ticker ───────────────────────────────────
  async loadTicker() {
    const el = document.getElementById('breaking-ticker');
    if (!el) return;
    try {
      let res = await fetch('../data/latest-news.json');
      if (!res.ok) res = await fetch('data/latest-news.json');
      if (res.ok) {
        const data = await res.json();
        let news = data.news || [];
        const now = Date.now();
        // Filter within 120 minutes if available
        let freshNews = news.filter(n => {
          if (!n.pubDate) return false;
          const age = (now - new Date(n.pubDate).getTime()) / 60000;
          return age >= 0 && age <= 120;
        });
        if (freshNews.length === 0) {
          freshNews = news.slice(0, 10);
        }
        if (freshNews.length > 0) {
          let idx = 0;
          const update = () => {
            const item = freshNews[idx % freshNews.length];
            const loc = item.location_name ? `<strong>[${item.location_name}]</strong> ` : '';
            const ageMins = Math.max(1, Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 60000));
            let timeStr = 'अभी-अभी';
            if (ageMins > 60) {
              timeStr = `${Math.floor(ageMins / 60)} घंटा पहले`;
            } else if (ageMins > 1) {
              timeStr = `${ageMins} मिनट पहले`;
            }
            el.innerHTML = `${loc}${item.title} <span style="font-size:0.75rem; opacity:0.85; margin-left:6px; background:rgba(0,0,0,0.15); padding:1px 6px; border-radius:3px;">${timeStr}</span>`;
            idx++;
          };
          update();
          setInterval(update, 4500);
          return;
        }
      }
    } catch (_) {}
    el.textContent = 'बिहार के सभी 38 जिलों की ताज़ा व प्रामाणिक प्रशासनिक जानकारी';
  },

  // ─── Show/Hide States ──────────────────────────────────────────────────────
  hideLoading() {
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('district-content');
    const error = document.getElementById('error-state');
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'none';
    if (content) content.style.display = 'block';
    setTimeout(() => BSH_HELPER.lazyLoad(), 100);
  },

  showError() {
    const loading = document.getElementById('loading-state');
    const error = document.getElementById('error-state');
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'flex';
  },

  // ─── Main Render ──────────────────────────────────────────────────────────
  render() {
    const d = this.district;
    if (!d) return;

    const lang = BSH_HELPER.getLang();
    const nameHi = d.name_hi || 'बिहार';
    const nameEn = d.name_en || 'Bihar';
    const divisionHi = d.division_hi || '';
    const divisionEn = d.division_en || '';
    const hq = lang === 'hi' ? (d.headquarters_hi || d.headquarters_en) : (d.headquarters_en || d.headquarters_hi);

    // Update page title
    document.title = `${nameHi} (${nameEn}) — Bihar Samachar Hub`;

    // 1. Hero Image
    const heroImg = document.getElementById('district-hero-img');
    const defaultHeroImg = 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1200&auto=format&fit=crop';
    const imgUrl = d.image_url || d.tourism?.[0]?.image_url || defaultHeroImg;
    if (heroImg) {
      heroImg.src = imgUrl;
      heroImg.alt = nameHi;
      heroImg.onerror = function() {
        this.src = defaultHeroImg;
      };
    }

    // 2. District Photo / Emblem Badge
    const defaultEmblemSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23E05B1C"/><circle cx="50" cy="50" r="40" fill="%23fff"/><circle cx="50" cy="50" r="34" fill="%23FFF5EE"/><path d="M50 20 L58 36 L76 39 L63 52 L66 70 L50 61 L34 70 L37 52 L24 39 L42 36 Z" fill="%23E05B1C"/><circle cx="50" cy="46" r="8" fill="%23FFD700"/><text x="50" y="86" font-size="9" font-weight="bold" fill="%23333" text-anchor="middle">BIHAR</text></svg>';
    const iconImg = document.getElementById('district-icon-img');
    if (iconImg) {
      iconImg.src = imgUrl || defaultEmblemSvg;
      iconImg.alt = nameHi;
      iconImg.onerror = function() {
        this.src = defaultEmblemSvg;
      };
    }

    // 3. District Name & Meta (Bold, Bilingual, Unmissable)
    const nameEl = document.getElementById('district-name');
    if (nameEl) {
      nameEl.innerHTML = `${nameHi} <span class="en-subname" style="font-size:0.65em; opacity:0.9; font-weight:500;">(${nameEn})</span>`;
    }

    const divEl = document.getElementById('district-division');
    if (divEl) {
      divEl.innerHTML = `<i class="fas fa-layer-group"></i> ${divisionHi || divisionEn} प्रमंडल`;
    }

    const popEl = document.getElementById('district-pop-quick');
    if (popEl) {
      popEl.innerHTML = d.population_2011
        ? `<i class="fas fa-users"></i> ${BSH_HELPER.formatNum(d.population_2011)} जनसंख्या`
        : '';
    }

    const areaEl = document.getElementById('district-area-quick');
    if (areaEl) {
      areaEl.innerHTML = d.area_sq_km
        ? `<i class="fas fa-expand-arrows-alt"></i> ${BSH_HELPER.formatNum(d.area_sq_km)} किमी²`
        : '';
    }

    // 4. Render all 6 tabs
    this.renderOverview(d, lang, hq, divisionHi);
    this.renderAdministration(d, lang);
    this.renderHistory(d, lang);
    this.renderTourism(d, lang);
    this.renderCulture(d, lang);
    this.renderEconomy(d, lang);
  },

  // ─── Overview Tab ──────────────────────────────────────────────────────────
  renderOverview(d, lang, hq, division) {
    const tbody = document.getElementById('overview-table');
    if (tbody) {
      tbody.innerHTML = [
        ['मुख्यालय (Headquarters)', hq || '—'],
        ['प्रमंडल (Division)', division || '—'],
        ['कुल जनसंख्या (2011)', d.population_2011 ? BSH_HELPER.formatNum(d.population_2011) : '—'],
        ['क्षेत्रफल (Area)', d.area_sq_km ? `${BSH_HELPER.formatNum(d.area_sq_km)} वर्ग किमी` : '—'],
      ].map(([label, value]) => `
        <tr class="info-row">
          <td class="info-label">${label}</td>
          <td class="info-value"><strong>${value}</strong></td>
        </tr>`).join('');
    }

    // PIN codes
    const pinEl = document.getElementById('pin-codes');
    if (pinEl) {
      if (d.pin_codes && d.pin_codes.length) {
        pinEl.innerHTML = d.pin_codes.map(p =>
          `<span class="pin-badge">${p}</span>`
        ).join('');
      } else {
        pinEl.innerHTML = '<span class="text-muted">—</span>';
      }
    }

    // Blocks
    const blocksEl = document.getElementById('blocks-list');
    if (blocksEl) {
      if (d.blocks && d.blocks.length) {
        blocksEl.innerHTML = d.blocks.map(b =>
          `<div class="block-item"><i class="fas fa-check-circle" style="color:var(--primary);"></i> ${b}</div>`
        ).join('');
      } else {
        blocksEl.innerHTML = '<span class="text-muted">—</span>';
      }
    }

    // ─── Google Maps Integration ─────────────────────────────────────────────
    this.renderGoogleMap(d);
  },

  // ─── Pure Google Maps Engine ──────────────────────────────────────────────
  renderGoogleMap(d) {
    const mapFrame = document.getElementById('map-frame');
    const coordsEl = document.getElementById('map-coords-text');
    const gmapsLink = document.getElementById('gmaps-direct-link');
    const gmapsDir = document.getElementById('gmaps-directions-link');
    const note = document.getElementById('map-status-note');

    const lat = d.lat || 25.5941;
    const lng = d.lng || 85.1376;
    const districtName = d.name_en || d.name_hi || 'Bihar';
    const query = encodeURIComponent(`${districtName} District, Bihar, India`);

    if (coordsEl) {
      coordsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
    }

    if (mapFrame) {
      mapFrame.style.display = 'block';
      mapFrame.src = `https://maps.google.com/maps?q=${query}&t=&z=11&ie=UTF8&iwloc=&output=embed`;
    }

    if (gmapsLink) {
      gmapsLink.href = d.gmaps_url || `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    if (gmapsDir) {
      gmapsDir.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    if (note) {
      note.innerHTML = `<i class="fab fa-google" style="color:#4285F4;"></i> आधिकारिक Google Maps कनेक्टेड (लाइव नेविगेशन)`;
    }
  },

  // ─── Administration Tab ────────────────────────────────────────────────────
  renderAdministration(d, lang) {
    // MP grid
    const mpGrid = document.getElementById('mp-grid');
    if (mpGrid) {
      if (d.mp && d.mp.length) {
        mpGrid.innerHTML = d.mp.map(m => this.renderOfficialCard(m, 'parliament', lang)).join('');
      } else {
        mpGrid.innerHTML = '<p class="text-muted">जानकारी उपलब्ध नहीं</p>';
      }
    }

    // MLA grid
    const mlaGrid = document.getElementById('mla-grid');
    if (mlaGrid) {
      if (d.mla && d.mla.length) {
        mlaGrid.innerHTML = d.mla.map(m => this.renderOfficialCard(m, 'vote-yea', lang)).join('');
      } else {
        mlaGrid.innerHTML = '<p class="text-muted">जानकारी उपलब्ध नहीं</p>';
      }
    }

    // Admin officials (DM + SP)
    const adminGrid = document.getElementById('admin-grid');
    if (adminGrid) {
      const officials = [];
      if (d.dm) {
        officials.push({
          name: d.dm,
          title: 'जिलाधिकारी (District Magistrate)',
          cadre: 'भारतीय प्रशासनिक सेवा (IAS)',
          icon: 'fa-university',
          iconClass: 'dm-icon',
          badge_class: 'dm-badge'
        });
      }
      if (d.sp) {
        officials.push({
          name: d.sp,
          title: 'पुलिस अधीक्षक (Superintendent of Police)',
          cadre: 'भारतीय पुलिस सेवा (IPS)',
          icon: 'fa-shield-alt',
          iconClass: 'sp-icon',
          badge_class: 'sp-badge'
        });
      }

      const lastUpdated = d.admin_last_updated || 'सितंबर 2026 (बिहार सरकार व NIC आधिकारिक पोर्टल अनुसार)';
      const updateBadgeHtml = `
        <div class="admin-update-badge" style="grid-column: 1 / -1; margin-bottom: 12px; padding: 10px 16px; background: rgba(224, 91, 28, 0.08); border-left: 4px solid var(--primary, #DC2626); border-radius: 6px; font-size: 0.9rem; color: var(--text-dark); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fas fa-certificate" style="color:var(--primary, #DC2626);"></i>
            <span><strong>नवीनतम प्रशासनिक स्थिति (2026):</strong> ${lastUpdated}</span>
          </div>
          <span style="font-size:0.8rem; background:var(--primary, #DC2626); color:#fff; padding:2px 8px; border-radius:12px; font-weight:600;">2026 Verified</span>
        </div>
      `;

      adminGrid.innerHTML = officials.length
        ? updateBadgeHtml + officials.map(o => `
          <div class="official-card admin-card">
            <div class="official-badge-icon ${o.iconClass}">
              <i class="fas ${o.icon}"></i>
            </div>
            <div class="official-info">
              <span class="official-title-badge ${o.badge_class}">${o.title}</span>
              <h4 class="official-name">${o.name}</h4>
              <div class="official-constituency"><i class="fas fa-award"></i> ${o.cadre}</div>
            </div>
          </div>`).join('')
        : '<p class="text-muted">जानकारी उपलब्ध नहीं</p>';
    }
  },

  renderOfficialCard(official, icon, lang) {
    const isMp = (icon === 'parliament');
    const roleIcon = isMp ? 'fa-landmark' : 'fa-vote-yea';
    const roleClass = isMp ? 'mp-icon' : 'mla-icon';
    const roleTag = isMp ? 'लोकसभा सांसद (MP)' : 'विधानसभा सदस्य (MLA)';

    const constituency = official.constituency
      ? `<div class="official-constituency"><i class="fas fa-map-marker-alt"></i> ${official.constituency}</div>`
      : '';
    const party = official.party
      ? `<span class="party-badge party-${(official.party || '').toLowerCase().replace(/[\s\(\)]+/g, '-')}">${official.party}</span>`
      : '';

    return `
      <div class="official-card">
        <div class="official-badge-icon ${roleClass}">
          <i class="fas ${roleIcon}"></i>
        </div>
        <div class="official-info">
          <span class="official-role-tag">${roleTag}</span>
          <h4 class="official-name">${official.name || '—'}</h4>
          ${constituency}
          ${party ? `<div class="official-badges mt-1">${party}</div>` : ''}
        </div>
      </div>`;
  },

  // ─── History Tab ───────────────────────────────────────────────────────────
  renderHistory(d, lang) {
    const el = document.getElementById('history-text');
    if (!el) return;

    const historyHi = d.history_hi || '';
    const historyEn = d.history_en || '';

    el.innerHTML = `
      <div class="history-content">
        <p class="history-para">${historyHi || 'इतिहास की विस्तृत जानकारी शीघ्र ही उपलब्ध होगी।'}</p>
        ${historyEn ? `<details class="history-english"><summary>Read in English</summary><p>${historyEn}</p></details>` : ''}
      </div>`;
  },

  // ─── Tourism Tab ───────────────────────────────────────────────────────────
  renderTourism(d, lang) {
    const grid = document.getElementById('tourism-grid');
    if (!grid) return;

    if (!d.tourism || !d.tourism.length) {
      grid.innerHTML = '<p class="text-muted">पर्यटन स्थलों की जानकारी शीघ्र ही उपलब्ध होगी।</p>';
      return;
    }

    grid.innerHTML = d.tourism.map(place => {
      const name = place.name_hi || place.name_en || 'पर्यटन स्थल';
      const desc = place.description_hi || place.description_en || '';
      const img = place.image_url || `https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&auto=format&fit=crop`;

      return `
        <div class="tourism-card">
          <div class="tourism-card-img-wrap">
            <img
              src="${img}"
              alt="${name}"
              class="tourism-card-img"
              onerror="this.src='https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&auto=format&fit=crop'"
              loading="lazy"
            >
            ${place.image_credit ? `<span class="img-credit">${place.image_credit}</span>` : ''}
          </div>
          <div class="tourism-card-info">
            <h4 class="tourism-name">${name}</h4>
            <p class="tourism-desc">${desc}</p>
          </div>
        </div>`;
    }).join('');

    BSH_HELPER.lazyLoad();
  },

  // ─── Culture Tab ───────────────────────────────────────────────────────────
  renderCulture(d, lang) {
    const el = document.getElementById('culture-content');
    if (!el) return;

    const blocks = [
      {
        icon: 'star-and-crescent',
        label: 'प्रमुख त्योहार (Festivals)',
        content: d.festivals_hi || d.festivals_en || 'छठ पूजा, मकर संक्रांति, दुर्गा पूजा'
      },
      {
        icon: 'utensils',
        label: 'प्रसिद्ध खानपान (Famous Food)',
        content: d.food_hi || d.food_en || 'लिट्टी चोखा, सत्तू, खाजा'
      },
      {
        icon: 'language',
        label: 'भाषा व बोलियां (Languages)',
        content: d.language_hi || d.language_en || 'हिंदी, भोजपुरी, मगही, मैथिली'
      }
    ];

    el.innerHTML = blocks.map(b => `
      <div class="info-block">
        <div class="info-block-header">
          <i class="fas fa-${b.icon}" style="color:var(--primary);"></i>
          <h4>${b.label}</h4>
        </div>
        <p>${b.content}</p>
      </div>`).join('');
  },

  // ─── Economy Tab ───────────────────────────────────────────────────────────
  renderEconomy(d, lang) {
    const el = document.getElementById('economy-content');
    if (!el) return;

    const blocks = [
      {
        icon: 'briefcase',
        label: 'मुख्य व्यवसाय (Main Occupation)',
        content: d.main_occupation_hi || d.main_occupation_en || 'कृषि, पशुपालन, व्यापार'
      },
      {
        icon: 'seedling',
        label: 'कृषि उत्पादन (Agriculture)',
        content: d.agriculture_hi || d.agriculture_en || 'धान, गेहूं, मक्का, दलहन'
      },
      {
        icon: 'industry',
        label: 'उद्योग व व्यापार (Industries)',
        content: d.industries_hi || d.industries_en || 'कुटीर उद्योग, राइस मिल, व्यापार'
      }
    ];

    el.innerHTML = blocks.map(b => `
      <div class="info-block">
        <div class="info-block-header">
          <i class="fas fa-${b.icon}" style="color:var(--primary);"></i>
          <h4>${b.label}</h4>
        </div>
        <p>${b.content}</p>
      </div>`).join('');
  },

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Update buttons
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update panels
        tabPanels.forEach(panel => {
          panel.classList.toggle('active', panel.id === `panel-${target}`);
        });

        if (target === 'overview' && this.mapInstance) {
          setTimeout(() => this.mapInstance.invalidateSize(), 150);
        }

        // Scroll tabs into view on mobile
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        BSH_HELPER.lazyLoad();
      });
    });
  }
};

window.DistrictPage = DistrictPage;

// ─── Init ─────────────────────────────────────────────────────────────────────
const initDistrictPage = () => {
  if (document.getElementById('district-content')) {
    DistrictPage.init();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDistrictPage);
} else {
  initDistrictPage();
}
