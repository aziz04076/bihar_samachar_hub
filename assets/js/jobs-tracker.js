/**
 * Bihar Samachar Hub - Sarkari Naukri & Result Tracker Module
 * Fetches, filters, and renders authentic Bihar government jobs, results, admit cards, and scholarships.
 */

const JobsTracker = (function () {
  'use strict';

  let allItems = [];
  let currentCategory = 'all';
  let searchQuery = '';

  const CATEGORY_MAP = {
    'all': 'सभी',
    'latest_jobs': 'सरकारी नौकरी',
    'results': 'रिजल्ट',
    'admit_cards': 'एडमिट कार्ड',
    'scholarships': 'छात्रवृत्ति व योजना'
  };

  /**
   * Escape HTML to prevent XSS in dynamic rendering
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Initialize Jobs Tracker
   */
  async function init() {
    const trackerContainer = document.getElementById('jobs-tracker-wrapper');
    if (!trackerContainer) return;

    await fetchJobsData();
    renderUI();
  }

  /**
   * Fetch data from API or static fallback
   */
  async function fetchJobsData() {
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    try {
      const response = await fetch(isDistrict ? '../api/jobs' : 'api/jobs');
      if (response.ok) {
        const data = await response.json();
        allItems = data.items || [];
        return;
      }
    } catch (e) {
      console.warn('Jobs API unavailable, falling back to static file:', e);
    }

    try {
      const staticRes = await fetch(isDistrict ? '../data/jobs-results.json' : 'data/jobs-results.json');
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        allItems = staticData.items || [];
      }
    } catch (err) {
      console.error('Failed to load jobs data:', err);
      allItems = [];
    }
  }

  /**
   * Filter and render cards
   */
  function renderUI() {
    const grid = document.getElementById('jobs-items-grid');
    if (!grid) return;

    const filtered = allItems.filter(item => {
      const matchCat = currentCategory === 'all' || item.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        (item.title_hi && item.title_hi.toLowerCase().includes(q)) ||
        (item.org && item.org.toLowerCase().includes(q)) ||
        (item.qualification && item.qualification.toLowerCase().includes(q)) ||
        (item.description_hi && item.description_hi.toLowerCase().includes(q));

      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
          <i class="fas fa-search" style="font-size: 2.2rem; color: #94A3B8; margin-bottom: 10px; display: block;"></i>
          <h4 style="font-size: 1.1rem; color: #334155; margin-bottom: 4px;">कोई अपडेट नहीं मिला</h4>
          <p style="font-size: 0.88rem; color: #64748B;">कृपया कोई अन्य खोज शब्द या श्रेणी चुनें।</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const categoryClass = item.category === 'latest_jobs' ? 'job' :
                            item.category === 'results' ? 'result' :
                            item.category === 'admit_cards' ? 'admit_card' : 'scholarship';
      
      const urgencyBadge = item.is_urgent 
        ? `<span class="job-urgency-pill high"><i class="fas fa-bolt"></i> नया / महत्वपूर्ण</span>`
        : '';

      const applyBtnText = item.category === 'results' ? 'रिजल्ट देखें' :
                           item.category === 'admit_cards' ? 'एडमिट कार्ड' :
                           item.category === 'scholarships' ? 'योजना पोर्टल' : 'ऑनलाइन आवेदन';

      const applyIcon = item.category === 'results' ? 'fa-poll-h' :
                        item.category === 'admit_cards' ? 'fa-id-card' :
                        item.category === 'scholarships' ? 'fa-external-link-alt' : 'fa-paper-plane';

      return `
        <div class="job-card">
          <div>
            <div class="job-card-top">
              <span class="job-category-pill ${escapeHtml(categoryClass)}">
                ${escapeHtml(item.category_label_hi || CATEGORY_MAP[item.category] || 'अपडेट')}
              </span>
              ${urgencyBadge}
            </div>
            
            <h3 class="job-title">${escapeHtml(item.title_hi)}</h3>
            <div class="job-dept"><i class="fas fa-university" style="color:var(--primary);"></i> ${escapeHtml(item.org)}</div>
            
            <div class="job-meta-grid">
              ${item.posts_count ? `
                <div class="job-meta-item">
                  <span class="job-meta-label">कुल पद / विवरण</span>
                  <span class="job-meta-val">${escapeHtml(item.posts_count)}</span>
                </div>
              ` : ''}
              ${item.qualification ? `
                <div class="job-meta-item">
                  <span class="job-meta-label">योग्यता</span>
                  <span class="job-meta-val">${escapeHtml(item.qualification)}</span>
                </div>
              ` : ''}
              ${item.last_date ? `
                <div class="job-meta-item">
                  <span class="job-meta-label">अंतिम तिथि / स्थिति</span>
                  <span class="job-meta-val" style="color:#DC2626;">${escapeHtml(item.last_date)}</span>
                </div>
              ` : ''}
              ${item.age_limit ? `
                <div class="job-meta-item">
                  <span class="job-meta-label">आयु सीमा</span>
                  <span class="job-meta-val">${escapeHtml(item.age_limit)}</span>
                </div>
              ` : ''}
            </div>

            ${item.description_hi ? `
              <p style="font-size:0.82rem; color:#475569; line-height:1.5; margin-bottom:14px;">
                ${escapeHtml(item.description_hi)}
              </p>
            ` : ''}
          </div>

          <div class="job-actions">
            ${item.apply_url ? `
              <a href="${escapeHtml(item.apply_url)}" target="_blank" rel="noopener noreferrer" class="job-btn-primary">
                <i class="fas ${applyIcon}"></i> ${escapeHtml(applyBtnText)}
              </a>
            ` : ''}
            ${item.notification_url ? `
              <a href="${escapeHtml(item.notification_url)}" target="_blank" rel="noopener noreferrer" class="job-btn-outline" title="आधिकारिक नोटिस">
                <i class="fas fa-file-alt"></i> नोटिफिकेशन
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Set category filter
   */
  function setCategory(cat, btnElement) {
    currentCategory = cat;
    document.querySelectorAll('.jobs-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
      btnElement.classList.add('active');
    }
    renderUI();
  }

  /**
   * Set search query
   */
  function handleSearch(query) {
    searchQuery = query || '';
    renderUI();
  }

  return {
    init,
    setCategory,
    handleSearch
  };
})();

// Auto initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', JobsTracker.init);
} else {
  JobsTracker.init();
}
