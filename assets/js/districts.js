/**
 * Bihar Samachar Hub — districts.js (Enhanced)
 * District browser: Alphabetical A-Z filtering, live autocomplete suggestions,
 * search, division filter, and sorting.
 */

'use strict';

const DistrictHub = {
  allDistricts: [],
  filtered: [],
  currentSearch: '',
  currentDivision: 'all',
  currentLetter: 'all',
  currentSort: 'name_asc',

  // ─── Init ──────────────────────────────────────────────────────────────────
  async init() {
    await this.loadDistricts();
    this.renderAlphabetFilter();
    this.bindSearchWithAutocomplete();
    this.bindFilters();
    this.bindSort();
    this.applyFilters();

    // Listen for language change
    document.addEventListener('bsh:langchange', () => {
      this.renderAlphabetFilter();
      this.renderCards(this.filtered);
    });
  },

  // ─── Load Data ─────────────────────────────────────────────────────────────
  async loadDistricts() {
    try {
      const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
      const path = isDistrict ? '../data/districts.json' : 'data/districts.json';
      const res = await fetch(path);
      const data = await res.json();
      this.allDistricts = data.districts || [];
      this.filtered = [...this.allDistricts];
    } catch (e) {
      console.error('Failed to load districts', e);
      const grid = document.getElementById('districts-grid');
      if (grid) grid.innerHTML = `<p class="error-text">जिला डेटा लोड नहीं हो सका।</p>`;
    }
  },

  // ─── Alphabet Filter Bar ───────────────────────────────────────────────────
  renderAlphabetFilter() {
    const container = document.getElementById('alphabet-filter-container');
    if (!container) return;

    // Distinct starting letters of English names
    const letters = ['ALL', 'A', 'B', 'D', 'E', 'G', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'V', 'W'];
    
    let html = `
      <div class="alphabet-filter-bar">
        <span class="alphabet-label"><i class="fas fa-sort-alpha-down"></i> अक्षर अनुसार:</span>
        <div class="alphabet-buttons">
    `;

    letters.forEach(letter => {
      const activeClass = (this.currentLetter === letter.toLowerCase() || (letter === 'ALL' && this.currentLetter === 'all')) ? 'active' : '';
      const label = letter === 'ALL' ? (BSH.lang === 'hi' ? 'सभी' : 'All') : letter;
      html += `<button type="button" class="btn-alphabet ${activeClass}" data-letter="${letter.toLowerCase()}">${label}</button>`;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Event listeners
    container.querySelectorAll('.btn-alphabet').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.btn-alphabet').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentLetter = btn.dataset.letter;
        this.applyFilters();
      });
    });
  },

  // ─── Filtering & Sorting ───────────────────────────────────────────────────
  applyFilters() {
    let list = [...this.allDistricts];

    // 1. Alphabetical filter (A-Z)
    if (this.currentLetter && this.currentLetter !== 'all') {
      const char = this.currentLetter.toLowerCase();
      list = list.filter(d => (d.name_en || '').toLowerCase().startsWith(char));
    }

    // 2. Search query filter
    if (this.currentSearch) {
      const q = this.currentSearch.toLowerCase();
      list = list.filter(d =>
        (d.name_hi || '').includes(q) ||
        (d.name_en || '').toLowerCase().includes(q) ||
        (d.headquarters_en || '').toLowerCase().includes(q) ||
        (d.headquarters_hi || '').includes(q) ||
        (d.blocks || []).some(b => b.toLowerCase().includes(q))
      );
    }

    // 3. Division filter
    if (this.currentDivision !== 'all') {
      list = list.filter(d =>
        (d.division_en || '').toLowerCase().includes(this.currentDivision.toLowerCase())
      );
    }

    // 4. Sort
    list = this.sortDistricts(list);
    this.filtered = list;

    this.updateCount(list.length);
    this.renderCards(list);
  },

  sortDistricts(list) {
    switch (this.currentSort) {
      case 'pop_desc':
      case 'population-desc':
        return list.sort((a, b) => (b.population_2011 || 0) - (a.population_2011 || 0));
      case 'pop_asc':
      case 'population-asc':
        return list.sort((a, b) => (a.population_2011 || 0) - (b.population_2011 || 0));
      case 'area_desc':
      case 'area-desc':
        return list.sort((a, b) => (b.area_sq_km || 0) - (a.area_sq_km || 0));
      case 'area_asc':
      case 'area-asc':
        return list.sort((a, b) => (a.area_sq_km || 0) - (b.area_sq_km || 0));
      case 'name_desc':
        return list.sort((a, b) => (b.name_en || '').localeCompare(a.name_en || ''));
      case 'name_asc':
      default:
        return list.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''));
    }
  },

  // ─── Rendering ─────────────────────────────────────────────────────────────
  renderCards(list) {
    const grid = document.getElementById('districts-grid');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
          <i class="fas fa-search" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px; opacity: 0.6;"></i>
          <h3>कोई जिला नहीं मिला</h3>
          <p style="color: var(--text-medium); margin-top: 8px;">कृपया दूसरा नाम या अक्षर चुनकर खोजें।</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(d => this.renderDistrictCard(d)).join('');
    if (window.BSH && BSH.lazyLoadImages) BSH.lazyLoadImages();
  },

  renderDistrictCard(d) {
    const lang = window.BSH ? BSH.lang : 'hi';
    const displayName = lang === 'hi'
      ? `${d.name_hi} <span class="en-subname">(${d.name_en})</span>`
      : d.name_en;
    const div = lang === 'hi' ? d.division_hi : d.division_en;
    const hq = lang === 'hi' ? d.headquarters_hi : d.headquarters_en;
    const pop = d.population_2011 ? Number(d.population_2011).toLocaleString('en-IN') : '—';
    const area = d.area_sq_km ? Number(d.area_sq_km).toLocaleString('en-IN') + ' वर्ग किमी' : '—';
    const defaultDistrictImg = 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop';
    const img = d.image_url || defaultDistrictImg;

    return `
      <article class="district-card" data-slug="${d.slug}" onclick="window.location.href='district/index.html?id=${d.slug}'" style="cursor:pointer;">
        <div class="district-card-img-wrap">
          <img src="${img}" alt="${d.name_en}" class="district-card-img" onerror="this.onerror=null;this.src='${defaultDistrictImg}'" loading="lazy">
          <div class="district-card-overlay">
            <span class="division-tag">${div}</span>
          </div>
        </div>
        <div class="district-card-body">
          <h3 class="district-card-name">${displayName}</h3>
          <div class="district-card-stats">
            <div class="stat-item">
              <i class="fas fa-building"></i>
              <span>मुख्यालय: <strong>${hq}</strong></span>
            </div>
            <div class="stat-item">
              <i class="fas fa-users"></i>
              <span>जनसंख्या: <strong>${pop}</strong></span>
            </div>
            <div class="stat-item">
              <i class="fas fa-expand-arrows-alt"></i>
              <span>क्षेत्रफल: <strong>${area}</strong></span>
            </div>
          </div>
          <a href="district/index.html?id=${d.slug}" class="btn btn-primary btn-sm district-card-btn">
            जिला देखें (Explore) →
          </a>
        </div>
      </article>`;
  },

  // ─── Search & Autocomplete ─────────────────────────────────────────────────
  bindSearchWithAutocomplete() {
    const input = document.getElementById('district-search');
    if (!input) return;

    // Create floating suggestion dropdown
    let dropdown = document.getElementById('district-autocomplete-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'district-autocomplete-dropdown';
      dropdown.className = 'district-autocomplete-menu';
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(dropdown);
    }

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      this.currentSearch = q;

      if (!q) {
        dropdown.style.display = 'none';
        this.applyFilters();
        return;
      }

      // Filter matches
      const matches = this.allDistricts.filter(d =>
        (d.name_hi || '').includes(q) ||
        (d.name_en || '').toLowerCase().includes(q) ||
        (d.headquarters_en || '').toLowerCase().includes(q) ||
        (d.headquarters_hi || '').includes(q)
      ).slice(0, 8);

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map(m => `
          <div class="autocomplete-item" data-slug="${m.slug}">
            <div class="item-main">
              <span class="item-name">${m.name_hi} / <strong>${m.name_en}</strong></span>
              <span class="item-div">${m.division_hi}</span>
            </div>
            <span class="item-hq"><i class="fas fa-map-marker-alt"></i> ${m.headquarters_hi}</span>
          </div>
        `).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const slug = item.dataset.slug;
            window.location.href = `district/index.html?id=${slug}`;
          });
        });
      } else {
        dropdown.style.display = 'none';
      }

      this.applyFilters();
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Focus opens if query exists
    input.addEventListener('focus', () => {
      if (input.value.trim().length > 0) {
        dropdown.style.display = 'block';
      }
    });
  },

  bindFilters() {
    const divisionSelect = document.getElementById('division-filter');
    if (divisionSelect) {
      divisionSelect.addEventListener('change', () => {
        this.currentDivision = divisionSelect.value;
        this.applyFilters();
      });
    }
  },

  bindSort() {
    const sortSelect = document.getElementById('sort-districts');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.currentSort = sortSelect.value;
        this.applyFilters();
      });
    }
  },

  updateCount(count) {
    const el = document.getElementById('results-count');
    if (el) el.textContent = count;
  }
};
window.DistrictHub = DistrictHub;

// ─── Homepage hero search wiring with Autocomplete ───────────────────────────
function bindHeroSearchWithAutocomplete() {
  const input = document.getElementById('hero-search');
  const btn = document.getElementById('hero-search-btn');
  if (!input) return;

  let dropdown = document.getElementById('hero-autocomplete-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'hero-autocomplete-dropdown';
    dropdown.className = 'district-autocomplete-menu hero-autocomplete';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);
  }

  let districtsData = [];
  fetch('data/districts.json')
    .then(r => r.json())
    .then(d => { districtsData = d.districts || []; })
    .catch(() => {});

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q || !districtsData.length) {
      dropdown.style.display = 'none';
      return;
    }

    const matches = districtsData.filter(d =>
      (d.name_hi || '').includes(q) ||
      (d.name_en || '').toLowerCase().includes(q) ||
      (d.headquarters_en || '').toLowerCase().includes(q)
    ).slice(0, 7);

    if (matches.length > 0) {
      dropdown.innerHTML = matches.map(m => `
        <div class="autocomplete-item" data-slug="${m.slug}">
          <div class="item-main">
            <span class="item-name">${m.name_hi} (${m.name_en})</span>
            <span class="item-div">${m.division_en}</span>
          </div>
          <span class="item-hq"><i class="fas fa-map-marker-alt"></i> ${m.headquarters_hi}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          window.location.href = `district/index.html?id=${item.dataset.slug}`;
        });
      });
    } else {
      dropdown.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  const doSearch = () => {
    const q = input.value.trim();
    if (q) {
      window.location.href = `districts.html?q=${encodeURIComponent(q)}`;
    }
  };

  if (btn) btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}

// ─── Homepage quick district grid (with Division Tabs Filter) ───────────────
async function loadHomepageDistricts() {
  const grid = document.getElementById('homepage-districts');
  const divTabs = document.getElementById('homepage-division-tabs');
  if (!grid) return;

  try {
    const res = await fetch('data/districts.json');
    const data = await res.json();
    const allDistricts = data.districts || [];

    const renderDistList = (division = 'all') => {
      let toShow = allDistricts;
      if (division !== 'all') {
        toShow = allDistricts.filter(d => d.division_en.toLowerCase() === division.toLowerCase() || d.division_hi === division);
      } else {
        toShow = allDistricts.slice(0, 8); // Top 8 for homepage
      }
      grid.innerHTML = toShow.map(d => DistrictHub.renderDistrictCard(d)).join('');
    };

    if (divTabs) {
      divTabs.querySelectorAll('.cat-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          divTabs.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderDistList(btn.dataset.division);
        });
      });
    }

    renderDistList('all');
  } catch (e) {
    console.warn('Failed to load homepage districts', e);
  }
}

// ─── Init on page load ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('districts-grid')) {
    DistrictHub.init();
  }
  if (document.getElementById('homepage-districts')) {
    loadHomepageDistricts();
  }
  if (document.getElementById('hero-search')) {
    bindHeroSearchWithAutocomplete();
  }
});
