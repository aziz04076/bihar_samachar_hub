/**
 * Bihar Samachar Hub — A/B Testing & Optimization Framework (ab-testing.js)
 * High-performance, zero-dependency experimentation engine.
 */

'use strict';

const BSH_AB = {
  TESTS: {
    hero_headline: {
      id: 'hero_headline',
      variants: ['headline_variant_a', 'headline_variant_b'],
      weights: [0.5, 0.5],
      titles: {
        headline_variant_a: 'बिहार की हर खबर, हर गाँव-जिले की सच्ची रिपोर्ट',
        headline_variant_b: '⚡ 24x7 बिहार लाइव न्यूज़: 38 जिलों की सबसे तेज़ व सटीक कवरेज'
      }
    },
    cta_button: {
      id: 'cta_button',
      variants: ['cta_variant_a', 'cta_variant_b'],
      weights: [0.5, 0.5],
      labels: {
        cta_variant_a: 'और खबरें लोड करें',
        cta_variant_b: '🔥 ताज़ा लाइव बुलेटिन देखें ➔'
      }
    }
  },

  init() {
    try {
      this.assignVariants();
      this.applyVariants();
      this.trackImpression();
    } catch (e) {
      console.warn('[BSH AB] Init warning:', e);
    }
  },

  assignVariants() {
    for (const testKey in this.TESTS) {
      const test = this.TESTS[testKey];
      const storageKey = `bsh_ab_${test.id}`;
      let assigned = localStorage.getItem(storageKey);

      if (!assigned || !test.variants.includes(assigned)) {
        assigned = Math.random() < test.weights[0] ? test.variants[0] : test.variants[1];
        localStorage.setItem(storageKey, assigned);
      }
      test.assigned = assigned;
    }
  },

  getVariant(testId) {
    const test = this.TESTS[testId];
    return test ? (test.assigned || test.variants[0]) : 'control';
  },

  applyVariants() {
    // 1. Hero Headline Test
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      const variant = this.getVariant('hero_headline');
      const text = this.TESTS.hero_headline.titles[variant];
      if (text) heroTitle.textContent = text;
    }

    // 2. Load More CTA Button Test
    const loadBtn = document.getElementById('homepage-load-more-btn');
    if (loadBtn) {
      const variant = this.getVariant('cta_button');
      const label = this.TESTS.cta_button.labels[variant];
      if (label) {
        loadBtn.innerHTML = `<i class="fas fa-sync-alt"></i> ${label}`;
      }
    }
  },

  trackImpression() {
    const headlineVar = this.getVariant('hero_headline');

    if (window.location.protocol.startsWith('http')) {
      try {
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'ab_impression',
            variant: headlineVar
          })
        }).catch(() => {});
      } catch (_) {}
    }
  },

  trackConversion(testId) {
    const variant = this.getVariant(testId);
    if (window.location.protocol.startsWith('http')) {
      try {
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'ab_conversion',
            test: testId,
            variant: variant
          })
        }).catch(() => {});
      } catch (_) {}
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BSH_AB.init();
});
