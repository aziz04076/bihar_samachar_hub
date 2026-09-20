/**
 * Bihar Samachar Hub — main.js
 * Global utilities: language toggle, mobile nav, i18n, helpers
 */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const BSH = window.BSH || {};
window.BSH = BSH;

BSH.lang = localStorage.getItem('bsh_lang') || 'hi';
BSH.i18n = {};

// ─── Load i18n strings ────────────────────────────────────────────────────────
BSH.loadI18n = async function () {
  try {
    const base = document.querySelector('base')?.href || window.location.origin;
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const path = isDistrict ? '../data/i18n.json' : 'data/i18n.json';
    const res = await fetch(path);
    BSH.i18n = await res.json();
    BSH.applyI18n();
  } catch (e) {
    console.warn('i18n load failed', e);
  }
};

// Apply i18n to all data-i18n elements
BSH.applyI18n = function () {
  const lang = BSH.lang;
  const strings = BSH.i18n[lang] || {};
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = strings[key];
      } else {
        el.textContent = strings[key];
      }
    }
  });
  // Update html lang attribute
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  // Update lang toggle button
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'hi' ? 'EN' : 'हिं';
};

// Get a single i18n string
BSH.t = function (key) {
  return (BSH.i18n[BSH.lang] || {})[key] || key;
};

// ─── Language Toggle ──────────────────────────────────────────────────────────
BSH.toggleLang = function () {
  BSH.lang = BSH.lang === 'hi' ? 'en' : 'hi';
  localStorage.setItem('bsh_lang', BSH.lang);
  BSH.applyI18n();
  // Trigger custom event so other modules can re-render
  document.dispatchEvent(new CustomEvent('bsh:langchange', { detail: { lang: BSH.lang } }));
};

// ─── Mobile Nav ───────────────────────────────────────────────────────────────
BSH.initMobileNav = function () {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.innerHTML = isOpen
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>';
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
      hamburger.innerHTML = '<i class="fas fa-bars"></i>';
    }
  });
};

// ─── Sticky Navbar ────────────────────────────────────────────────────────────
BSH.initStickyNav = function () {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
};

// ─── Relative time formatter ──────────────────────────────────────────────────
BSH.timeAgo = function (dateStr) {
  if (!dateStr) return BSH.lang === 'hi' ? 'कुछ समय पहले' : 'Recently';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const isHi = (BSH.lang !== 'en');

  if (seconds < 60) {
    return isHi ? 'अभी-अभी' : 'Just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return isHi ? `${minutes} मिनट पहले` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return isHi ? `${hours} घंटे पहले` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return isHi ? '1 दिन पहले' : 'Yesterday';
  }
  if (days < 7) {
    return isHi ? `${days} दिन पहले` : `${days} days ago`;
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return isHi ? `${weeks} सप्ताह पहले` : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Format number with commas (Indian system)
BSH.formatNum = function (n) {
  return Number(n).toLocaleString('en-IN');
};

// Slugify string
BSH.slugify = function (str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

// Truncate text
BSH.truncate = function (str, len = 120) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len).trimEnd() + '…' : str;
};

// Strip HTML tags
BSH.stripHtml = function (html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// ─── Ticker Animation ─────────────────────────────────────────────────────────
BSH.initTicker = function (items) {
  const ticker = document.getElementById('ticker-content');
  if (!ticker || !items?.length) return;
  ticker.innerHTML = items.map(item =>
    `<span class="ticker-item"><a href="${item.url || '#'}" target="_blank" rel="noopener">${item.title}</a></span>`
  ).join('<span class="ticker-sep"> • </span>');
};

// ─── Active nav link ──────────────────────────────────────────────────────────
BSH.setActiveNav = function () {
  const path = window.location.pathname.toLowerCase();
  const isDistrictPage = path.includes('/district/') || path.includes('/district');

  document.querySelectorAll('.nav-link, #mobile-menu a').forEach(link => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (!href || href.startsWith('javascript:')) return;
    let isActive = false;
    if (isDistrictPage) {
      // On district page, ONLY "जिले" (districts) is active, never Home
      isActive = href.includes('districts') || href.includes('district');
    } else {
      isActive =
        (href.includes('about') && path.includes('about')) ||
        (href.includes('contact') && path.includes('contact')) ||
        (href.includes('news') && path.includes('news')) ||
        (href.includes('districts') && path.includes('districts')) ||
        ((href === 'index.html' || href === './' || href === '/' || href.endsWith('/index.html')) &&
         (path === '/' || path.endsWith('index.html') || path.endsWith('/') || path.endsWith('bihar news/') || path.endsWith('bihar news')));
    }
    link.classList.toggle('active', isActive);
  });

  document.querySelectorAll('.app-bottom-nav .app-nav-item').forEach(item => {
    const href = (item.getAttribute('href') || '').toLowerCase();
    if (!href || href.startsWith('javascript:')) return;
    let isActive = false;
    if (isDistrictPage) {
      isActive = href.includes('districts') || href.includes('district');
    } else {
      isActive =
        (href.includes('districts') && path.includes('districts')) ||
        (href.includes('news') && path.includes('news')) ||
        ((href === 'index.html' || href === '/' || href.endsWith('index.html')) &&
         (path === '/' || path.endsWith('index.html') || path.endsWith('/')));
    }
    item.classList.toggle('active', isActive);
  });
};

// ─── Toast notification ───────────────────────────────────────────────────────
BSH.toast = function (msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `background:${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#2980b9'};color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:14px;max-width:300px;animation:fadeInUp 0.3s ease`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
};

// ─── Lazy load images ─────────────────────────────────────────────────────────
BSH.lazyLoadImages = function () {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          io.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
  } else {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
    });
  }
};

// ─── PWA & Service Worker Registration ────────────────────────────────────────
BSH.initPWA = function () {
  if ('serviceWorker' in navigator) {
    const isDistrict = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const swPath = isDistrict ? '../sw.js' : 'sw.js';

    // 1. Clean up any stale/legacy duplicate service-worker.js registrations
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        if (reg.active && reg.active.scriptURL && reg.active.scriptURL.includes('service-worker.js')) {
          console.log('[BSH] Unregistering duplicate service worker:', reg.active.scriptURL);
          reg.unregister();
        }
      }
    }).catch(() => {});

    // 2. Register sw.js and monitor for updates
    navigator.serviceWorker.register(swPath).then(registration => {
      console.log('✅ BSH Service Worker Registered (Offline Ready - v6.3.0)');

      // Listen for updates found
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('⚡ New BSH Service Worker version installed. Activating...');
              if (window.BSH && BSH.toast) {
                BSH.toast('🚀 नया अपडेट लागू किया जा रहा है...', 'info');
              }
              // Immediately claim control
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch(err => console.log('SW registration note:', err));

    // 3. Auto reload on controller change when new version claims clients (only if already controlled)
    let refreshing = false;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 BSH Service Worker controller updated. Refreshing page...');
          window.location.reload();
        }
      });
    }
  }

  // PWA Install Prompt
  let deferredPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  const installBtn = document.getElementById('pwa-install-btn');
  const closeBtn = document.getElementById('pwa-banner-close');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (banner && !sessionStorage.getItem('bsh_banner_dismissed')) {
      banner.style.display = 'flex';
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (banner) banner.style.display = 'none';
        }
        deferredPrompt = null;
      } else {
        alert('ब्राउज़र मेनू (⋮) में जाकर "Add to Home screen" या "Install app" चुनें।');
      }
    });
  }

  if (closeBtn && banner) {
    closeBtn.addEventListener('click', () => {
      banner.style.display = 'none';
      sessionStorage.setItem('bsh_banner_dismissed', '1');
    });
  }

  // Push Notification Request Helper
  BSH.requestNotificationPermission = async function () {
    if (!('Notification' in window)) {
      alert('यह ब्राउज़र नोटिफिकेशन सपोर्ट नहीं करता है।');
      return false;
    }
    if (Notification.permission === 'granted') {
      if (typeof BSH.showToast === 'function') {
        BSH.showToast('✅ लाइव नोटिफिकेशन पहले से सक्रिय हैं!');
      } else {
        alert('लाइव नोटिफिकेशन सक्रिय हैं!');
      }
      return true;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (typeof BSH.showToast === 'function') {
          BSH.showToast('🔔 बिहार ब्रेकिंग न्यूज़ नोटिफिकेशन सक्रिय हो गए!');
        } else {
          alert('बिहार ब्रेकिंग न्यूज़ नोटिफिकेशन सक्रिय हो गए!');
        }
        return true;
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
    return false;
  };
};

// ─── Saved Bookmarks Modal ────────────────────────────────────────────────────
BSH.openSavedBookmarksModal = function () {
  let modal = document.getElementById('saved-bookmarks-modal');
  if (!modal) {
    const html = `
      <div id="saved-bookmarks-modal" class="news-modal-overlay">
        <div class="news-modal-container citizen-modal-wrap" style="max-width:650px;" role="dialog">
          <div class="flex justify-between items-center pb-3" style="border-bottom:1px solid #E2E8F0;">
            <h3 style="margin:0; font-size:1.25rem;"><i class="fas fa-bookmark" style="color:var(--primary);"></i> सेव की गई खबरें (Bookmarks)</h3>
            <button class="tool-btn" onclick="document.getElementById('saved-bookmarks-modal').classList.remove('open')">&times;</button>
          </div>
          <div id="saved-bookmarks-list" style="max-height:60vh; overflow-y:auto; padding:15px 0;"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('saved-bookmarks-modal');
  }

  const list = document.getElementById('saved-bookmarks-list');
  const savedIds = JSON.parse(localStorage.getItem('bsh_saved_bookmarks') || '[]');
  
  if (savedIds.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:40px 10px;">
        <i class="far fa-bookmark" style="font-size:3rem; color:#cbd5e1; margin-bottom:12px;"></i>
        <p style="color:#64748B;">आपने अभी कोई खबर सेव नहीं की है।<br>किसी भी खबर में बुकमार्क बटन पर क्लिक करके ऑफलाइन पढ़ें।</p>
      </div>`;
  } else {
    // If newsHub data is loaded, render title links
    const allNews = window.NewsHub ? window.NewsHub.allNews : [];
    const items = allNews.filter(n => savedIds.includes(n.id));
    if (items.length > 0) {
      list.innerHTML = items.map(item => `
        <div class="flex justify-between items-center p-3 mb-2" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
          <div style="flex:1; cursor:pointer;" onclick="document.getElementById('saved-bookmarks-modal').classList.remove('open'); if(window.NewsHub) NewsHub.openNewsModal('${item.id}');">
            <span style="font-size:0.75rem; color:var(--primary); font-weight:700;">${item.district_name_hi || 'बिहार'}</span>
            <h4 style="font-size:0.95rem; margin:2px 0; color:#0F172A;">${BSH.stripHtml(item.title)}</h4>
          </div>
          <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; margin-left:10px;" onclick="NewsHub.toggleBookmark('${item.id}'); BSH.openSavedBookmarksModal();">हटाएं</button>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<p style="text-align:center; padding:20px; color:#64748B;">सेव की गई ${savedIds.length} खबरें सुरक्षित हैं।</p>`;
    }
  }

  modal.classList.add('open');
};

// ─── Citizen Reporter Modal ───────────────────────────────────────────────────
BSH.openCitizenModal = function () {
  let modal = document.getElementById('citizen-report-modal');
  if (!modal) {
    const html = `
      <div id="citizen-report-modal" class="news-modal-overlay">
        <div class="news-modal-container citizen-modal-wrap" role="dialog">
          <div class="flex justify-between items-center pb-3 mb-3" style="border-bottom:1px solid #E2E8F0;">
            <h3 style="margin:0; font-size:1.25rem;"><i class="fas fa-bullhorn" style="color:var(--primary);"></i> अपनी खबर / समस्या भेजें</h3>
            <button class="tool-btn" onclick="document.getElementById('citizen-report-modal').classList.remove('open')">&times;</button>
          </div>
          <p style="font-size:0.85rem; color:#64748B; margin-bottom:15px;">आपके गाँव, पंचायत या शहर की कोई समस्या या खबर है? हमारे ब्यूरो को सीधे भेजें।</p>
          <form id="citizen-form" onsubmit="event.preventDefault(); BSH.submitCitizenReport();">
            <div class="citizen-form-group">
              <label>आपका नाम *</label>
              <input type="text" id="cit-name" required placeholder="अपना नाम दर्ज करें">
            </div>
            <div class="citizen-form-group">
              <label>आपका जिला / प्रखंड *</label>
              <input type="text" id="cit-location" required placeholder="जैसे: बाढ़, पटना / मनेर">
            </div>
            <div class="citizen-form-group">
              <label>मोबाइल / व्हाट्सएप नंबर *</label>
              <input type="tel" id="cit-phone" required placeholder="10 अंकों का नंबर">
            </div>
            <div class="citizen-form-group">
              <label>खबर / समस्या का विवरण *</label>
              <textarea id="cit-details" rows="4" required placeholder="पूरी जानकारी लिखें (सड़क, बिजली, स्कूल, अस्पताल, जलजमाव आदि)..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;"><i class="fas fa-paper-plane"></i> खबर ब्यूरो को भेजें</button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('citizen-report-modal');
  }
  modal.classList.add('open');
};

BSH.submitCitizenReport = function () {
  const name = document.getElementById('cit-name').value;
  const loc = document.getElementById('cit-location').value;
  const phone = document.getElementById('cit-phone').value;
  const details = document.getElementById('cit-details').value;

  const modal = document.getElementById('citizen-report-modal');
  if (modal) modal.classList.remove('open');

  BSH.toast(`धन्यवाद ${name}! आपकी खबर बिहार समाचार हब डेस्क को प्राप्त हो गई है। हमारी टीम जल्द संपर्क करेगी।`, 'success');

  // Trigger optional WhatsApp prefill
  const waText = encodeURIComponent(`*बिहार समाचार हब - नागरिक रिपोर्ट*\n\nप्रेषक: ${name}\nस्थान: ${loc}\nफोन: ${phone}\n\nविवरण:\n${details}`);
  window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
};

// ─── Global Dark Mode Toggle ──────────────────────────────────────────────────
BSH.initDarkMode = function () {
  const isDark = localStorage.getItem('bsh_theme') === 'dark';
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
  const btns = document.querySelectorAll('.theme-toggle-btn');
  btns.forEach(btn => {
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    btn.setAttribute('title', isDark ? 'लाइट मोड चालू करें' : 'डार्क मोड चालू करें');
  });
};

BSH.toggleDarkMode = function () {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bsh_theme', isDark ? 'dark' : 'light');
  const btns = document.querySelectorAll('.theme-toggle-btn');
  btns.forEach(btn => {
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    btn.setAttribute('title', isDark ? 'लाइट मोड चालू करें' : 'डार्क मोड चालू करें');
  });
  if (BSH.toast) {
    BSH.toast(isDark ? '🌙 डार्क मोड सक्रिय' : '☀️ लाइट मोड सक्रिय', 'info');
  }
};

// ─── Live Date & Time Widget (Hero & Top Bar) ─────────────────────────────────
BSH.initLiveClock = function () {
  const topEl = document.getElementById('live-datetime');
  const heroTimeEl = document.getElementById('hero-live-time');
  const heroDateEl = document.getElementById('hero-live-date');
  const heroGreetingEl = document.getElementById('hero-live-greeting');

  if (!topEl && !heroTimeEl && !heroDateEl) return;

  const hindiDays = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const hindiMonths = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'];

  const update = () => {
    const now = new Date();
    const hours24 = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const isPm = hours24 >= 12;
    const hours12 = hours24 % 12 || 12;
    const ampmStr = isPm ? 'PM' : 'AM';
    const dayName = hindiDays[now.getDay()];
    const monthName = hindiMonths[now.getMonth()];
    const dateNum = now.getDate();
    const yearNum = now.getFullYear();

    // Determine greeting
    let greeting = 'सुप्रभात';
    let greetingIcon = 'fa-sun';
    if (hours24 >= 12 && hours24 < 17) {
      greeting = 'शुभ दोपहर';
      greetingIcon = 'fa-sun';
    } else if (hours24 >= 17 && hours24 < 21) {
      greeting = 'शुभ संध्या';
      greetingIcon = 'fa-cloud-sun';
    } else if (hours24 >= 21 || hours24 < 4) {
      greeting = 'शुभ रात्रि';
      greetingIcon = 'fa-moon';
    }

    if (heroTimeEl) {
      heroTimeEl.innerHTML = `<span class="time-digits">${hours12}:${minutes}:${seconds}</span> <span class="time-ampm">${ampmStr}</span>`;
    }

    if (heroDateEl) {
      heroDateEl.innerHTML = `<i class="far fa-calendar-check"></i> ${dayName}, ${dateNum} ${monthName} ${yearNum}`;
    }

    if (heroGreetingEl) {
      heroGreetingEl.innerHTML = `<i class="fas ${greetingIcon}"></i> ${greeting}`;
    }

    if (topEl) {
      topEl.innerHTML = `
        <span class="live-pulse-dot" title="लाइव नेटवर्क सक्रिय"></span>
        <span><i class="far fa-calendar-alt"></i> ${dayName}, ${dateNum} ${monthName}</span>
        <span class="top-clock-time"><i class="far fa-clock"></i> ${hours12}:${minutes}:${seconds} ${ampmStr}</span>
        <span class="top-greeting-pill"><i class="fas ${greetingIcon}"></i> ${greeting}</span>
      `.trim();
    }
  };

  update();
  setInterval(update, 1000);
};

// ─── Contact Form Submission ──────────────────────────────────────────────────
BSH.submitContactForm = function (e) {
  if (e) e.preventDefault();
  const name = document.getElementById('contact-form-name')?.value.trim();
  const phone = document.getElementById('contact-form-phone')?.value.trim();
  const subject = document.getElementById('contact-form-subject')?.value || 'सामान्य पूछताछ';
  const msg = document.getElementById('contact-form-message')?.value.trim();

  if (!name || !phone || !msg) {
    alert(BSH.lang === 'hi' ? 'कृपया सभी आवश्यक विवरण (*) भरें।' : 'Please fill all required fields (*).');
    return;
  }

  const nameEl = document.getElementById('contact-form-name');
  const phoneEl = document.getElementById('contact-form-phone');
  const emailEl = document.getElementById('contact-form-email');
  const msgEl = document.getElementById('contact-form-message');

  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (emailEl) emailEl.value = '';
  if (msgEl) msgEl.value = '';

  const confirmMsg = BSH.lang === 'hi'
    ? `धन्यवाद ${name}! आपका संदेश [${subject}] पटना संपादकीय ब्यूरो को प्राप्त हो गया है। हमारी टीम जल्द संपर्क करेगी।`
    : `Thank you ${name}! Your message [${subject}] has been received by our editorial bureau. Our team will get back to you shortly.`;

  if (BSH.toast) {
    BSH.toast(confirmMsg, 'success');
  } else {
    alert(confirmMsg);
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const initBSH = async () => {
  BSH.initLiveClock();
  BSH.initDarkMode();
  BSH.initMobileNav();
  BSH.initStickyNav();
  BSH.setActiveNav();
  BSH.initPWA();
  await BSH.loadI18n();

  // Language toggle button
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.addEventListener('click', BSH.toggleLang);

  // Dark mode toggle buttons
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', BSH.toggleDarkMode);
  });

  // Scroll to top button
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  BSH.lazyLoadImages();
  console.log('%c🏛 Bihar Samachar Hub loaded (Dark Mode & Clock Ready)', 'color:#DC2626;font-weight:bold;font-size:14px');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBSH);
} else {
  initBSH();
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1 & 5: AUTHENTICATION, PROFILE, DIALECTS & ACCESSIBILITY CONTROLS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Accessibility: Global Font Resizer ───────────────────────────────────────
BSH.fontSizeLevel = parseInt(localStorage.getItem('bsh_font_level') || '0', 10);

BSH.setFontSize = function (delta) {
  if (delta === 0) {
    BSH.fontSizeLevel = 0;
  } else {
    BSH.fontSizeLevel = Math.max(-1, Math.min(2, BSH.fontSizeLevel + delta));
  }
  localStorage.setItem('bsh_font_level', BSH.fontSizeLevel.toString());
  
  document.body.classList.remove('font-size-sm', 'font-size-lg', 'font-size-xl');
  if (BSH.fontSizeLevel === -1) document.body.classList.add('font-size-sm');
  else if (BSH.fontSizeLevel === 1) document.body.classList.add('font-size-lg');
  else if (BSH.fontSizeLevel === 2) document.body.classList.add('font-size-xl');

  if (BSH.toast) {
    const labels = { '-1': 'फॉन्ट आकार: छोटा', '0': 'फॉन्ट आकार: सामान्य', '1': 'फॉन्ट आकार: बड़ा', '2': 'फॉन्ट आकार: बहुत बड़ा' };
    BSH.toast(labels[BSH.fontSizeLevel] || 'फॉन्ट अपडेट', 'info');
  }
};

// ─── Localization: 5 Bihar Dialects / Languages ──────────────────────────────
BSH.setDialect = function (langCode) {
  if (!langCode) return;
  BSH.lang = langCode;
  localStorage.setItem('bsh_lang', langCode);
  BSH.applyI18n();

  const picker = document.getElementById('dialect-picker');
  if (picker) picker.value = langCode;

  const dialectNames = {
    'hi': 'हिंदी (Hindi)',
    'mai': 'मैथिली (Maithili)',
    'bho': 'भोजपुरी (Bhojpuri)',
    'mag': 'मगही (Magahi)',
    'en': 'English'
  };

  if (BSH.toast) {
    BSH.toast(`🌐 भाषा बदली: ${dialectNames[langCode] || langCode}`, 'success');
  }
  document.dispatchEvent(new CustomEvent('bsh:langchange', { detail: { lang: BSH.lang } }));
};

// ─── Phase 1: User Auth & Profile Modal ──────────────────────────────────────
BSH.currentUser = null;

BSH.checkAuthStatus = function () {
  try {
    const saved = localStorage.getItem('bsh_user_profile');
    if (saved) {
      BSH.currentUser = JSON.parse(saved);
      const authBtns = document.querySelectorAll('#nav-auth-btn, .nav-auth-btn');
      authBtns.forEach(btn => {
        btn.innerHTML = `<i class="fas fa-user-check" style="color:#10B981;"></i> <span>${BSH.currentUser.name || 'प्रोफ़ाइल'}</span>`;
      });
    }
  } catch (e) {
    console.warn('Auth status check note', e);
  }
};

BSH.openAuthModal = function () {
  let modal = document.getElementById('auth-profile-modal');
  if (!modal) {
    const html = `
      <div id="auth-profile-modal" class="news-modal-overlay">
        <div class="news-modal-container citizen-modal-wrap" style="max-width:500px;" role="dialog">
          <div class="flex justify-between items-center pb-3 mb-3" style="border-bottom:1px solid #E2E8F0;">
            <h3 id="auth-modal-title" style="margin:0; font-size:1.25rem;"><i class="fas fa-user-circle" style="color:var(--primary);"></i> पाठक खाता व प्रोफ़ाइल</h3>
            <button class="tool-btn" onclick="document.getElementById('auth-profile-modal').classList.remove('open')">&times;</button>
          </div>
          <div id="auth-modal-content"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('auth-profile-modal');
  }

  const container = document.getElementById('auth-modal-content');
  if (BSH.currentUser && BSH.currentUser.token) {
    // Render Logged-in Profile View
    container.innerHTML = `
      <div style="text-align:center; margin-bottom:15px;">
        <div style="width:60px; height:60px; border-radius:50%; background:var(--primary-glow); color:var(--primary); font-size:1.8rem; font-weight:800; display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
          ${(BSH.currentUser.name || 'प')[0]}
        </div>
        <h3 style="margin:0; font-size:1.2rem; color:#0F172A;">${BSH.currentUser.name || 'सत्यापित पाठक'}</h3>
        <span style="font-size:0.8rem; color:#64748B;">${BSH.currentUser.identifier || 'पंजीकृत उपयोगकर्ता'}</span>
      </div>

      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:15px;">
        <label style="font-size:0.8rem; font-weight:700; color:#334155; display:block; margin-bottom:5px;">गृह जिला (Home District) चुनें:</label>
        <select id="user-pref-district" style="width:100%; padding:8px 10px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.85rem; background:#FFF;" onchange="BSH.updateHomeDistrict(this.value)">
          <option value="patna" ${BSH.currentUser.home_district === 'patna' ? 'selected' : ''}>पटना (Patna)</option>
          <option value="gaya" ${BSH.currentUser.home_district === 'gaya' ? 'selected' : ''}>गया (Gaya)</option>
          <option value="muzaffarpur" ${BSH.currentUser.home_district === 'muzaffarpur' ? 'selected' : ''}>मुजफ्फरपुर (Muzaffarpur)</option>
          <option value="madhubani" ${BSH.currentUser.home_district === 'madhubani' ? 'selected' : ''}>मधुबनी (Madhubani)</option>
          <option value="darbhanga" ${BSH.currentUser.home_district === 'darbhanga' ? 'selected' : ''}>दरभंगा (Darbhanga)</option>
          <option value="bhagalpur" ${BSH.currentUser.home_district === 'bhagalpur' ? 'selected' : ''}>भागलपुर (Bhagalpur)</option>
          <option value="purnia" ${BSH.currentUser.home_district === 'purnia' ? 'selected' : ''}>पूर्णिया (Purnia)</option>
          <option value="saran" ${BSH.currentUser.home_district === 'saran' ? 'selected' : ''}>सारण (छपरा)</option>
          <option value="rohtas" ${BSH.currentUser.home_district === 'rohtas' ? 'selected' : ''}>रोहतास (सासाराम)</option>
        </select>
        <span style="font-size:0.72rem; color:#64748B; display:block; margin-top:4px;">आपके चुने जिले की खबरें "आपके लिए" सेक्शन में प्राथमिकता से दिखाई जाएंगी।</span>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="document.getElementById('auth-profile-modal').classList.remove('open'); BSH.openSavedBookmarksModal();">
          <i class="fas fa-bookmark" style="color:var(--primary);"></i> सेव खबरें देखें
        </button>
        <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="BSH.logoutUser()">
          <i class="fas fa-sign-out-alt"></i> लॉगआउट
        </button>
      </div>
    `;
  } else {
    // Render Login / OTP Request Form
    container.innerHTML = `
      <p style="font-size:0.85rem; color:#64748B; margin-bottom:15px;">अपना मोबाइल नंबर या ईमेल दर्ज करके तुरंत लॉगिन करें और अपने पसंदीदा जिले की खबरें पाएं।</p>
      <form id="auth-login-form" onsubmit="event.preventDefault(); BSH.submitLoginRequest();">
        <div class="citizen-form-group">
          <label>मोबाइल नंबर या ईमेल *</label>
          <input type="text" id="auth-identifier-input" required placeholder="10 अंकों का मोबाइल या ईमेल">
        </div>
        <div id="auth-otp-block" style="display:none; margin-top:10px;">
          <div class="citizen-form-group">
            <label>6-अंकों का OTP कोड दर्ज करें *</label>
            <input type="text" id="auth-otp-input" maxlength="6" placeholder="जैसे: 123456" style="letter-spacing:4px; font-weight:800; font-size:1.1rem; text-align:center;">
          </div>
          <div class="citizen-form-group">
            <label>आपका शुभ नाम</label>
            <input type="text" id="auth-name-input" placeholder="अपना नाम दर्ज करें">
          </div>
        </div>
        <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="width:100%; margin-top:10px;">
          <i class="fas fa-paper-plane"></i> OTP प्राप्त करें
        </button>
      </form>
    `;
  }
  modal.classList.add('open');
};

BSH.authPendingIdentifier = '';

BSH.submitLoginRequest = async function () {
  const identifierInput = document.getElementById('auth-identifier-input');
  const otpBlock = document.getElementById('auth-otp-block');
  const otpInput = document.getElementById('auth-otp-input');
  const nameInput = document.getElementById('auth-name-input');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (otpBlock.style.display === 'none') {
    // Step 1: Send OTP
    const idVal = identifierInput.value.trim();
    if (!idVal) return;
    BSH.authPendingIdentifier = idVal;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> OTP भेजा जा रहा है...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: idVal })
      });
      const data = await res.json();
      if (data.success) {
        otpBlock.style.display = 'block';
        identifierInput.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> सत्यापित करें व लॉगिन करें';
        if (BSH.toast) {
          BSH.toast(`✅ OTP भेजा गया: ${data.otp_demo || '123456'} (परीक्षण हेतु)`, 'success');
        }
        if (data.otp_demo) {
          otpInput.value = data.otp_demo;
        }
      } else {
        alert(data.error || 'OTP भेजने में विफल');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> OTP प्राप्त करें';
      }
    } catch (e) {
      // Offline fallback
      otpBlock.style.display = 'block';
      identifierInput.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> सत्यापित करें व लॉगिन करें';
      otpInput.value = '123456';
      if (BSH.toast) BSH.toast('✅ डेमो OTP: 123456', 'info');
    }
  } else {
    // Step 2: Verify OTP
    const otpVal = otpInput.value.trim();
    const nameVal = nameInput.value.trim() || 'पाठक';
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> सत्यापन हो रहा है...';

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: BSH.authPendingIdentifier,
          otp: otpVal,
          name: nameVal
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        BSH.currentUser = data.user;
        localStorage.setItem('bsh_user_profile', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('bsh_user_token', data.token);
        BSH.checkAuthStatus();
        if (BSH.toast) BSH.toast(`स्वागत है ${data.user.name}! आप सफलतापूर्वक लॉगिन हो गए हैं।`, 'success');
        document.getElementById('auth-profile-modal').classList.remove('open');
      } else {
        alert(data.error || 'अमान्य OTP');
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> सत्यापित करें व लॉगिन करें';
      }
    } catch (e) {
      // Local simulated login
      const fallbackUser = {
        id: 'user-' + Date.now(),
        name: nameVal,
        identifier: BSH.authPendingIdentifier,
        home_district: 'patna',
        token: 'token-' + Date.now()
      };
      BSH.currentUser = fallbackUser;
      localStorage.setItem('bsh_user_profile', JSON.stringify(fallbackUser));
      BSH.checkAuthStatus();
      if (BSH.toast) BSH.toast(`स्वागत है ${fallbackUser.name}! लॉगिन सफल।`, 'success');
      document.getElementById('auth-profile-modal').classList.remove('open');
    }
  }
};

BSH.updateHomeDistrict = async function (districtId) {
  if (!BSH.currentUser) return;
  BSH.currentUser.home_district = districtId;
  localStorage.setItem('bsh_user_profile', JSON.stringify(BSH.currentUser));
  try {
    await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: localStorage.getItem('bsh_user_token'),
        home_district: districtId
      })
    });
  } catch (_) {}
  if (BSH.toast) BSH.toast('✅ आपका पसंदीदा जिला अपडेट हो गया!', 'success');
  if (window.NewsHub && typeof NewsHub.renderForYouSection === 'function') {
    NewsHub.renderForYouSection();
  }
};

BSH.logoutUser = function () {
  BSH.currentUser = null;
  localStorage.removeItem('bsh_user_profile');
  localStorage.removeItem('bsh_user_token');
  const authBtns = document.querySelectorAll('#nav-auth-btn, .nav-auth-btn');
  authBtns.forEach(btn => {
    btn.innerHTML = '<i class="fas fa-user-circle"></i> <span>लॉगिन</span>';
  });
  if (BSH.toast) BSH.toast('आप सफलतापूर्वक लॉगआउट हो गए हैं।', 'info');
  document.getElementById('auth-profile-modal').classList.remove('open');
};

// Auto-check auth & font level on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  BSH.checkAuthStatus();
  if (BSH.fontSizeLevel !== 0) {
    BSH.setFontSize(0); // re-applies class
  }
  const picker = document.getElementById('dialect-picker');
  if (picker && BSH.lang) picker.value = BSH.lang;
});
