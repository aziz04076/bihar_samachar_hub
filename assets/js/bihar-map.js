/**
 * Bihar Samachar Hub — bihar-map.js
 * High-Performance Interactive Vector Map of Bihar with India Context
 * Features:
 * - 38 Bihar Districts with division color coding
 * - India context layer (neighboring states with borders)
 * - Rich hover tooltips with Hindi/English names, DM (IAS), SP (IPS), and population
 * - 1-Click click-to-redirect to district page
 * - Active district highlight on specific district pages
 */

'use strict';

const BiharMapHub = {
  activeDistrictSlug: null,

  async init(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || typeof L === 'undefined') return null;

    const isDistrictPage = /\/district(\/|\\|\.html|$)/i.test(window.location.pathname);
    const basePath = isDistrictPage ? '../' : '';
    const currentSlug = options.activeSlug || null;
    this.activeDistrictSlug = currentSlug;

    // Destroy existing map if any
    if (container._leaflet_map) {
      container._leaflet_map.remove();
    }

    // Default center for Bihar
    const centerLat = options.centerLat || 25.75;
    const centerLng = options.centerLng || 85.75;
    const initialZoom = options.zoom || (window.innerWidth < 768 ? 7 : 7.8);

    const map = L.map(containerId, {
      center: [centerLat, centerLng],
      zoom: initialZoom,
      minZoom: 5.5,
      maxZoom: 14,
      scrollWheelZoom: false,
      attributionControl: false
    });
    container._leaflet_map = map;

    // Enable scroll zoom on click/focus
    map.on('click', () => map.scrollWheelZoom.enable());
    container.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    // 1. Sleek CartoDB Light Tile Background (Clean base)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Division Colors Palette
    const divisionColors = {
      'Patna': '#F97316',        // Orange
      'Tirhut': '#0284C7',       // Sky Blue
      'Magadh': '#8B5CF6',       // Purple
      'Saran': '#059669',        // Emerald Green
      'Darbhanga': '#DB2777',    // Pink
      'Kosi': '#D97706',         // Amber
      'Purnia': '#0891B2',       // Cyan
      'Bhagalpur': '#4F46E5',    // Indigo
      'Munger': '#0D9488'        // Teal
    };

    // 2. Load India Context (Neighboring States)
    try {
      const indiaRes = await fetch(basePath + 'data/india_context.geojson');
      if (indiaRes.ok) {
        const indiaData = await indiaRes.json();
        L.geoJSON(indiaData, {
          style: {
            fillColor: '#E2E8F0',
            fillOpacity: 0.45,
            color: '#94A3B8',
            weight: 1.2,
            dashArray: '3, 4'
          },
          onEachFeature: (feature, layer) => {
            const stateName = feature.properties.state_name;
            if (stateName) {
              layer.bindTooltip(stateName, {
                permanent: false,
                direction: 'center',
                className: 'state-context-tooltip'
              });
            }
          }
        }).addTo(map);
      }
    } catch (e) {
      console.warn('India context layer load notice:', e);
    }

    // 3. Load Bihar 38 Districts GeoJSON
    let biharLayer = null;
    try {
      const biharRes = await fetch(basePath + 'data/bihar_districts.geojson');
      if (!biharRes.ok) throw new Error('Failed to load bihar_districts.geojson');
      const biharData = await biharRes.json();

      biharLayer = L.geoJSON(biharData, {
        style: (feature) => {
          const props = feature.properties || {};
          const isCurrent = currentSlug && props.slug && props.slug.toLowerCase() === currentSlug.toLowerCase();
          const divColor = divisionColors[props.division_en] || '#DC2626';

          return {
            fillColor: isCurrent ? '#FF3D00' : divColor,
            fillOpacity: isCurrent ? 0.85 : 0.65,
            color: isCurrent ? '#FFD600' : '#FFFFFF',
            weight: isCurrent ? 3.5 : 1.5,
            dashArray: isCurrent ? '' : ''
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const slug = props.slug || '';
          const nameHi = props.name_hi || props.district || 'जिला';
          const nameEn = props.name_en || props.district || '';
          const divHi = props.division_hi || '';
          const dm = props.dm_name || 'विभागीय अधिकारी';
          const sp = props.sp_name || 'पुलिस अधीक्षक';
          const pop = props.population ? Number(props.population).toLocaleString('en-IN') : null;
          const redirectUrl = isDistrictPage
            ? `index.html?id=${slug}`
            : `district/index.html?id=${slug}`;

          // Rich Tooltip
          const tooltipContent = `
            <div class="bsh-map-tooltip">
              <div class="bsh-tooltip-title">
                <strong>${nameHi}</strong> <span>(${nameEn})</span>
              </div>
              <div class="bsh-tooltip-division">प्रमंडल: <strong>${divHi}</strong></div>
              <div class="bsh-tooltip-officials">
                <div><i class="fas fa-user-tie"></i> DM: ${dm}</div>
                <div><i class="fas fa-shield-alt"></i> SP: ${sp}</div>
              </div>
              ${pop ? `<div class="bsh-tooltip-pop"><i class="fas fa-users"></i> जनसंख्या: ${pop}</div>` : ''}
              <div class="bsh-tooltip-hint">क्लिक करके जिला पेज खोलें ➔</div>
            </div>
          `;

          layer.bindTooltip(tooltipContent, {
            sticky: true,
            className: 'bsh-leaflet-custom-tooltip',
            offset: [0, -10]
          });

          // Hover effects
          layer.on({
            mouseover: (e) => {
              const target = e.target;
              const isCurrent = currentSlug && props.slug && props.slug.toLowerCase() === currentSlug.toLowerCase();
              target.setStyle({
                weight: isCurrent ? 4 : 3,
                color: '#FFD600',
                fillOpacity: 0.9
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              biharLayer.resetStyle(e.target);
            },
            click: () => {
              window.location.href = redirectUrl;
            }
          });

          // If this is the active district on district page, add marker & open popup
          if (currentSlug && props.slug && props.slug.toLowerCase() === currentSlug.toLowerCase()) {
            const lat = props.lat || options.centerLat;
            const lng = props.lng || options.centerLng;
            if (lat && lng) {
              const activePinIcon = L.divIcon({
                className: 'active-district-map-pin',
                html: `
                  <div class="pulsing-pin-wrap">
                    <span class="pin-pulse"></span>
                    <div class="pin-head"><i class="fas fa-map-marker-alt"></i></div>
                  </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36]
              });

              L.marker([lat, lng], { icon: activePinIcon }).addTo(map);
            }
          }
        }
      }).addTo(map);

      // Fit bounds appropriately
      if (options.fitBounds && biharLayer) {
        map.fitBounds(biharLayer.getBounds(), { padding: [20, 20] });
      } else if (currentSlug && options.centerLat && options.centerLng) {
        map.setView([options.centerLat, options.centerLng], window.innerWidth < 768 ? 9 : 9.5);
      }
    } catch (err) {
      console.error('Bihar map initialization error:', err);
    }

    return map;
  }
};

window.BiharMapHub = BiharMapHub;
