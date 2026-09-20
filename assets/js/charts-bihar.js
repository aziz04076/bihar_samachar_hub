/**
 * Bihar Samachar Hub — charts-bihar.js
 * Interactive Data Visualizations & Infographics using Chart.js
 */

'use strict';

const BiharCharts = {
  charts: {},

  initAll() {
    if (typeof Chart === 'undefined') {
      return;
    }
    this.renderPopulationChart();
    this.renderRainfallChart();
    this.renderBudgetChart();
    this.renderLiteracyChart();
  },

  // 1. Top 10 Districts by Population (in Lakhs)
  renderPopulationChart() {
    const ctx = document.getElementById('chart-bihar-population');
    if (!ctx) return;
    if (this.charts.pop) this.charts.pop.destroy();

    this.charts.pop = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['पटना', 'पूर्वी चंपारण', 'मुजफ्फरपुर', 'मधुबनी', 'गया', 'समस्तीपुर', 'सारण', 'दरभंगा', 'पश्चिम चंपारण', 'वैशाली'],
        datasets: [{
          label: 'जनसंख्या (लाख में - 2011/2026)',
          data: [58.3, 50.9, 48.0, 44.8, 43.9, 42.6, 39.5, 39.3, 39.3, 34.9],
          backgroundColor: 'rgba(220, 38, 38, 0.85)',
          borderColor: '#DC2626',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Mukta, sans-serif', weight: 'bold' } } },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.parsed.y + ' लाख नागरिक' } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'जनसंख्या (लाख)' } },
          x: { ticks: { font: { family: 'Mukta, sans-serif' } } }
        }
      }
    });
  },

  // 2. Monsoon Rainfall & Flood Monitoring (mm)
  renderRainfallChart() {
    const ctx = document.getElementById('chart-bihar-rainfall');
    if (!ctx) return;
    if (this.charts.rain) this.charts.rain.destroy();

    this.charts.rain = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['किशनगंज', 'पश्चिम चंपारण', 'अररिया', 'सुपौल', 'पूर्णिया', 'कटिहार', 'दरभंगा', 'मुजफ्फरपुर', 'पटना', 'गया'],
        datasets: [
          {
            label: 'वास्तविक वर्षा (mm)',
            data: [1340, 1220, 1180, 1110, 1090, 1040, 960, 920, 890, 830],
            borderColor: '#0284C7',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 5
          },
          {
            label: 'सामान्य मानक वर्षा (mm)',
            data: [1200, 1150, 1100, 1050, 1000, 980, 920, 900, 850, 800],
            borderColor: '#94A3B8',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Mukta, sans-serif' } } },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + ' मिमी' } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'वर्षा (मिमी)' } }
        }
      }
    });
  },

  // 3. Bihar State Budget Sector Allocation (%)
  renderBudgetChart() {
    const ctx = document.getElementById('chart-bihar-budget');
    if (!ctx) return;
    if (this.charts.budget) this.charts.budget.destroy();

    this.charts.budget = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['शिक्षा (Education)', 'स्वास्थ्य (Health)', 'सड़क व अवसंरचना', 'ग्रामीण विकास व पंचायती राज', 'कृषि व सिंचाई', 'सामाजिक कल्याण व अन्य'],
        datasets: [{
          data: [22.5, 7.8, 16.4, 18.2, 8.5, 26.6],
          backgroundColor: [
            '#DC2626',
            '#10B981',
            '#F59E0B',
            '#0284C7',
            '#8B5CF6',
            '#64748B'
          ],
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'Mukta, sans-serif', size: 12 } } },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + ctx.parsed + '% बजट' } }
        }
      }
    });
  },

  // 4. Literacy Rate Growth in Bihar (%)
  renderLiteracyChart() {
    const ctx = document.getElementById('chart-bihar-literacy');
    if (!ctx) return;
    if (this.charts.lit) this.charts.lit.destroy();

    this.charts.lit = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['1991', '2001', '2011', '2021', '2026'],
        datasets: [
          {
            label: 'कुल साक्षरता दर (%)',
            data: [37.5, 47.0, 61.8, 70.9, 76.5],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointRadius: 6
          },
          {
            label: 'महिला साक्षरता (%)',
            data: [22.9, 33.1, 51.5, 62.4, 70.0],
            borderColor: '#EC4899',
            backgroundColor: 'transparent',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Mukta, sans-serif' } } },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '%' } }
        },
        scales: {
          y: { beginAtZero: false, min: 20, max: 100, title: { display: true, text: 'साक्षरता दर (%)' } }
        }
      }
    });
  }
};

window.BiharCharts = BiharCharts;
document.addEventListener('DOMContentLoaded', () => {
  if (window.Chart) {
    BiharCharts.initAll();
  } else {
    window.addEventListener('load', () => {
      if (window.Chart) BiharCharts.initAll();
    });
  }
});
