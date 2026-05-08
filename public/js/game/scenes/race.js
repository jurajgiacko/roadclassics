/* Race scene — MapLibre GL JS rendering on the real Pálava GPX route.
   Replaces the previous canvas-based pseudo-3D engine view with an
   actual map view (Dune 2000 style top-down isometric). The engine.js
   continues to drive game state (energy, score, peloton positions);
   this scene reads from rcEngine.getState() per frame and updates
   marker positions on the map. */
(function () {
  let countdown = null;
  let map = null;
  let routePoints = [];           // [{lat, lon, distM, ele}]
  let routeCoords = [];            // [[lon, lat], ...]
  let totalDistM = 0;
  let playerMarker = null;
  let pelotonMarkers = [];
  let stationMarkers = [];
  let mapTickHandle = null;
  let mapInitialized = false;

  /* ---- helpers ---- */

  /* Convert progressPct (0..100) to a [lon, lat] on the GPX path. */
  function pctToCoord(pct) {
    if (!routePoints.length) return [16.755, 48.741];
    const wantM = (pct / 100) * totalDistM;
    /* binary search */
    let lo = 0, hi = routePoints.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (routePoints[mid].distM < wantM) lo = mid + 1; else hi = mid;
    }
    const a = routePoints[Math.max(0, lo - 1)];
    const b = routePoints[lo];
    const t = b.distM === a.distM ? 0 : (wantM - a.distM) / (b.distM - a.distM);
    return [a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t];
  }

  /* Bearing in degrees from a→b for camera heading. */
  function bearingAt(pct) {
    if (!routePoints.length) return 0;
    const [lon, lat] = pctToCoord(pct);
    const [lon2, lat2] = pctToCoord(Math.min(100, pct + 1));
    const φ1 = lat * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /* Build a small DOM marker around a sprite image. We prefer the
     chroma-keyed Data URL from rcSprites so the white background is
     already stripped; fall back to the raw PNG if not yet cached. */
  function spriteSrc(spriteId, fallbackPath) {
    const url = window.rcSprites && window.rcSprites.getDataUrl
              ? window.rcSprites.getDataUrl(spriteId)
              : null;
    return url || fallbackPath;
  }

  function makeBikeMarker(spriteId, isPlayer) {
    const el = document.createElement('div');
    el.className = 'map-bike-marker' + (isPlayer ? ' map-player' : '');
    const img = document.createElement('img');
    img.src = spriteSrc(spriteId, `/assets/scenes/characters/${spriteId}.png`);
    img.alt = '';
    el.appendChild(img);
    return el;
  }

  function makeStationMarker(type) {
    const el = document.createElement('div');
    el.className = 'map-station-marker';
    const img = document.createElement('img');
    const id = `station-${type}`;
    img.src = spriteSrc(id, `/assets/scenes/stations/${id}.png`);
    img.alt = '';
    el.appendChild(img);
    return el;
  }

  /* Preload sprites through rcSprites so chroma-key processing has
     happened before we ask for getDataUrl. */
  async function preloadSprites() {
    if (!window.rcSprites || !window.rcSprites.preload) return;
    if (!window.rcSprites.loadManifest) return;
    /* Manifest is already loaded by scenes-bootstrap, but call it again
       to be safe — it's idempotent (cached). */
    await window.rcSprites.loadManifest('/assets/scenes/manifest.json');
    await window.rcSprites.preload([
      'cyclist-player-topdown',
      'peloton-rider-1', 'peloton-rider-2', 'peloton-rider-3', 'peloton-rider-4',
      'station-gel', 'station-bar', 'station-drink',
      'station-jelly', 'station-chews', 'station-caffeine'
    ]);
  }

  /* ---- Map init (one-time) ---- */
  async function loadGPX() {
    const r = await fetch('/monuments/palava-long-real.json');
    const data = await r.json();
    routePoints = data.points;
    totalDistM = data.points[data.points.length - 1].distM;
    routeCoords = data.points.map(p => [p.lon, p.lat]);
  }

  /* Wait for the MapLibre global with a short polling loop. The library
     loads from unpkg via a normal <script> tag and may not be ready when
     the race scene first enters, especially on slow mobile networks. */
  async function ensureMapLibre(maxWaitMs = 8000) {
    const start = performance.now();
    while (!window.maplibregl) {
      if (performance.now() - start > maxWaitMs) return false;
      await new Promise(r => setTimeout(r, 80));
    }
    return true;
  }

  function showMapLoading(msg) {
    let el = document.getElementById('map-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'map-loading';
      el.className = 'map-loading';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'flex';
  }
  function hideMapLoading() {
    const el = document.getElementById('map-loading');
    if (el) el.style.display = 'none';
  }

  function initMap() {
    if (!window.maplibregl) {
      console.error('[race-map] maplibregl not loaded');
      return null;
    }
    const center = routeCoords[0] || [16.755, 48.741];
    const m = new maplibregl.Map({
      container: 'race-map',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center,
      zoom: 14.5,
      pitch: 55,
      bearing: 0,
      antialias: true,
      attributionControl: { compact: true },
      hash: false
    });

    m.on('load', () => {
      /* Route line — burgundy glow + cream centerline */
      m.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoords }
        }
      });
      m.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e53747',
          'line-width': 14,
          'line-opacity': 0.35,
          'line-blur': 6
        }
      });
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e4cb9d',
          'line-width': 4,
          'line-opacity': 0.95
        }
      });
      /* Faint outline along the road */
      m.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#170410',
          'line-width': 7,
          'line-opacity': 0.4
        }
      }, 'route-line');

      /* Player marker */
      const playerEl = makeBikeMarker('cyclist-player-topdown', true);
      playerMarker = new maplibregl.Marker({ element: playerEl, anchor: 'center', rotationAlignment: 'map' })
        .setLngLat(center)
        .addTo(m);

      /* Peloton markers */
      const sprites = ['peloton-rider-1', 'peloton-rider-2', 'peloton-rider-3', 'peloton-rider-4'];
      pelotonMarkers = [];
      const pelo = window.rcEngine?.getPeloton?.() || [];
      for (let i = 0; i < (pelo.length || 4); i++) {
        const el = makeBikeMarker(sprites[i % sprites.length], false);
        const mk = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map' })
          .setLngLat(center)
          .addTo(m);
        pelotonMarkers.push(mk);
      }

      /* Station markers — placed at their pct along the route */
      stationMarkers = [];
      const monument = window.rcEngine?.getState?.()?.monument;
      const stations = window.rcEngine?.getState?.()?.stations || [];
      stations.forEach((st) => {
        const c = pctToCoord(st.pct);
        const type = (st.type === 'liquid-gel' || st.type === 'caffeine') ? 'gel'
                   : (st.type === 'jelly')                                ? 'jelly'
                   : (st.type === 'chews')                                ? 'chews'
                   : st.type;
        const el = makeStationMarker(type);
        el.dataset.id = st.id;
        const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(c)
          .addTo(m);
        stationMarkers.push({ marker: mk, station: st, el });
      });

      mapInitialized = true;
    });

    return m;
  }

  /* ---- Per-frame map update — driven from race.tick ---- */
  function tick() {
    if (!map || !mapInitialized) {
      mapTickHandle = requestAnimationFrame(tick);
      return;
    }
    const state = window.rcEngine && window.rcEngine.getState();
    if (!state) {
      mapTickHandle = requestAnimationFrame(tick);
      return;
    }
    const pct = state.progressPct || 0;
    const playerPct = pct;
    const pCoord = pctToCoord(playerPct);
    const heading = bearingAt(playerPct);

    if (playerMarker) playerMarker.setLngLat(pCoord);

    /* Camera follows player smoothly with bearing aligned to direction of travel */
    map.jumpTo({ center: pCoord, bearing: heading });

    /* Peloton positions: use rcEngine.getPeloton — relativeAhead is in
       worldY units (~80 per pct). Convert that to pct-delta for path
       sampling. */
    const peloton = (window.rcEngine.getPeloton && window.rcEngine.getPeloton()) || [];
    pelotonMarkers.forEach((mk, i) => {
      const p = peloton[i];
      if (!p) return;
      const dPct = p.relativeAhead / 80; // worldY/80 = pct
      const otherPct = Math.max(0, Math.min(100, playerPct + dPct));
      mk.setLngLat(pctToCoord(otherPct));
      /* Visually fade riders that are far behind the player */
      const el = mk.getElement();
      if (dPct < -3 && !el.classList.contains('map-passed')) {
        el.classList.add('map-passed');
      } else if (dPct >= 0 && el.classList.contains('map-passed')) {
        el.classList.remove('map-passed');
      }
    });

    /* Update station marker collected/missed visuals */
    stationMarkers.forEach(({ station, el }) => {
      if (station.collected) {
        if (!el.classList.contains('map-station-collected')) el.classList.add('map-station-collected');
      }
    });

    mapTickHandle = requestAnimationFrame(tick);
  }

  /* ---- Scene transitions ---- */
  function hideAllPreraceOverlays() {
    document.querySelectorAll('.scene-overlay').forEach(el => el.classList.remove('show'));
  }

  function showCountdown(onDone) {
    countdown = document.createElement('div');
    countdown.className = 'race-countdown';
    countdown.innerHTML = `<div class="num" id="cd-num">3</div>`;
    document.body.appendChild(countdown);
    let n = 3;
    const beat = () => {
      const el = countdown.querySelector('#cd-num');
      if (!el) return;
      el.textContent = n;
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      n -= 1;
      if (n < 0) {
        countdown.querySelector('#cd-num').textContent = 'GO';
        setTimeout(() => {
          countdown && countdown.remove();
          countdown = null;
          onDone();
        }, 600);
      } else {
        setTimeout(beat, 800);
      }
    };
    beat();
  }

  async function enter() {
    hideAllPreraceOverlays();
    document.body.classList.add('race-active');
    showMapLoading('Načítám mapu Pálavy…');

    /* Load GPX once if needed */
    if (!routePoints.length) {
      try { await loadGPX(); }
      catch (err) { console.error('[race] GPX load failed', err); }
    }

    /* Boot the engine (state, peloton init, monument load) if not already */
    if (window.rcEngine && !window.rcEngine.getState().monument) {
      await window.rcEngine.boot();
    }

    /* Pre-load + chroma-key sprites BEFORE the map markers are created,
       otherwise markers fall back to raw PNG with white backgrounds. */
    try { await preloadSprites(); }
    catch (e) { console.warn('[race] sprite preload partial', e); }

    /* Wait for the MapLibre global; falls through to a clear error after 8s */
    const ok = await ensureMapLibre();
    if (!ok) {
      console.error('[race] MapLibre failed to load after 8s — falling back to canvas');
      showMapLoading('Mapa se nenačetla (zkontroluj připojení). Pokračuji přes fallback…');
      /* Drop race-active so canvas is visible again */
      setTimeout(() => {
        document.body.classList.remove('race-active');
        hideMapLoading();
      }, 1200);
      showCountdown(() => window.rcEngine && window.rcEngine.startRace());
      return;
    }

    /* Init MapLibre once */
    if (!map) {
      map = initMap();
      if (map) {
        map.on('load', () => hideMapLoading());
      }
    } else {
      hideMapLoading();
      /* Reuse map; re-add markers if this isn't first time */
      map.flyTo({ center: routeCoords[0], zoom: 14.5, pitch: 55, bearing: 0, duration: 0 });
    }

    /* Start the per-frame map updater */
    if (!mapTickHandle) tick();

    /* Countdown then start engine */
    showCountdown(() => {
      window.rcEngine && window.rcEngine.startRace();
    });
  }

  async function exit() {
    document.body.classList.remove('race-active');
    if (countdown) { countdown.remove(); countdown = null; }
    if (mapTickHandle) { cancelAnimationFrame(mapTickHandle); mapTickHandle = null; }
  }

  window.rcScenes.register('race', { enter, exit });
})();
