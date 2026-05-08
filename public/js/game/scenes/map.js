/* Route map preview scene — shown after intro, before breakfast.
   Renders the actual Pálava GPX polyline as SVG with km markers and
   the 7 landmark zones pinned. Auto-advances or tap to skip. */
(function () {
  let overlay = null;
  let timer = null;

  /* Same 7 zones as landmarks.js — pinned on the map */
  const ZONES = [
    { pct: 0,  label: 'Start · Valtice',      emoji: '🏁' },
    { pct: 18, label: 'Lednice',              emoji: '🍇' },
    { pct: 32, label: 'Mikulov',              emoji: '🏰' },
    { pct: 45, label: 'Děvín 7.8 %',          emoji: '⛰' },
    { pct: 58, label: 'Novomlýnské nádrže',   emoji: '💧' },
    { pct: 75, label: 'Tesarova past',        emoji: '🌲' },
    { pct: 95, label: 'Reistna kolonáda',     emoji: '🏛' }
  ];

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-map';
    overlay.className = 'scene-overlay scene-prerace scene-map';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/landscapes/palava-overview-map.png'); opacity:.18"></div>
      <div class="prerace-shell">
        <div class="step-pill">Plán na dnes · 124 km</div>
        <h2 class="title-display">Trasa Pálava</h2>
        <p class="lead">Reálný GPX ze závodního souboru. 7 zón, 5 taktických rozhodnutí, jedno kafe někde v polovině.</p>
        <div class="map-stage" id="map-stage">
          <svg id="map-svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
            <path id="map-path" stroke="rgba(228,203,157,0.95)" stroke-width="2" fill="none" />
            <path id="map-path-glow" stroke="rgba(229,55,71,0.4)" stroke-width="6" fill="none" />
            <g id="map-pins"></g>
          </svg>
        </div>
        <button type="button" class="btn btn-primary big" id="map-go">Jdu na to →</button>
        <div class="prerace-foot">Pokračuje za 6 sekund</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#map-go').addEventListener('click', advance);
    return overlay;
  }

  function advance() {
    if (timer) { clearTimeout(timer); timer = null; }
    window.rcScenes.go('breakfast');
  }

  /* Project lat/lon to a 600×400 viewBox-relative coordinate system */
  function projectGpx(points) {
    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const W = 560, H = 360, pad = 20;
    const w = maxLon - minLon, h = maxLat - minLat;
    /* preserve aspect ratio */
    const scale = Math.min(W / w, H / h);
    const offX = (W - w * scale) / 2 + pad;
    const offY = (H - h * scale) / 2 + pad;
    return points.map(p => ({
      x: offX + (p.lon - minLon) * scale,
      y: offY + (maxLat - p.lat) * scale, /* flip Y */
      pct: 0,
      distM: p.distM
    }));
  }

  async function loadAndRender() {
    try {
      const res = await fetch('/monuments/palava-long-real.json');
      const data = await res.json();
      const projected = projectGpx(data.points);
      /* compute pct for each point */
      const totalM = data.points[data.points.length - 1].distM || 1;
      projected.forEach((p, i) => p.pct = (data.points[i].distM / totalM) * 100);

      const path = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      overlay.querySelector('#map-path').setAttribute('d', path);
      overlay.querySelector('#map-path-glow').setAttribute('d', path);

      /* Place zone pins */
      const pinsG = overlay.querySelector('#map-pins');
      pinsG.innerHTML = '';
      ZONES.forEach((z, i) => {
        const idx = projected.findIndex(p => p.pct >= z.pct);
        const p = projected[idx >= 0 ? idx : projected.length - 1];
        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x', p.x - 60);
        fo.setAttribute('y', p.y - 22);
        fo.setAttribute('width', 120);
        fo.setAttribute('height', 22);
        const div = document.createElement('div');
        div.className = 'map-pin';
        div.innerHTML = `<span class="pin-dot"></span><span class="pin-label">${z.emoji} ${z.label}</span>`;
        fo.appendChild(div);
        pinsG.appendChild(fo);
        /* Also dot directly on path */
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', p.x);
        dot.setAttribute('cy', p.y);
        dot.setAttribute('r', 4);
        dot.setAttribute('fill', i === 0 ? '#198754' : i === ZONES.length - 1 ? '#e53747' : '#e4cb9d');
        pinsG.appendChild(dot);
      });
    } catch (err) {
      console.error('[map] failed to load real GPX', err);
    }
  }

  async function enter() {
    build();
    overlay.classList.add('show');
    await loadAndRender();
    timer = setTimeout(advance, 6500);
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
    if (timer) { clearTimeout(timer); timer = null; }
  }

  window.rcScenes.register('map', { enter, exit });
})();
