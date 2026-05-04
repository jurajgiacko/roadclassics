/* Pickups — Enervit občerstvovačky.
   - Reads monument.pickups[] (each item has pct + type)
   - Renders a small Enervit-branded feed station on the canvas at the
     pickup's world position (right side of the road)
   - Auto-collects when player crosses the pct
   - Pushes a floating toast ("+25 ENERVIT GEL") and applies energy/speed
     boost to game state */
(function () {
  /* Real Enervit C2:1PRO product line — the same range that's distributed
     at Road Classics feed stations IRL. */
  const PRODUCT = {
    gel:   { name: 'Carbo Gel C2:1PRO',  short: 'C2:1 GEL',   energy: 25, boost: { mul: 1.05, dur: 10 }, score: 100 },
    bar:   { name: 'Carbo Bar C2:1PRO',  short: 'C2:1 BAR',   energy: 35, boost: null,                     score: 80  },
    drink: { name: 'Isocarb C2:1PRO',    short: 'ISOCARB',    energy: 30, boost: { mul: 1.10, dur: 8 },  score: 90  }
  };

  function makeStations(monument) {
    /* Place stations at fixed virtual world-X derived from pct. The engine
       uses ~80 world units per "pct" so 100% ~= 8000 units. */
    return monument.pickups.map((p, i) => ({
      id: `${monument.id}-${i}`,
      pct: p.pct,
      type: p.type,
      worldX: p.pct * 80,
      lane: 1,            // always right side of the road
      collected: false
    }));
  }

  function showToast(type) {
    const prod = PRODUCT[type] || PRODUCT.gel;
    const el = document.createElement('div');
    el.className = 'pickup-toast';
    el.innerHTML = `+${prod.energy}<small>Enervit · ${prod.name}</small>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  function applyEffect(state, type) {
    const prod = PRODUCT[type] || PRODUCT.gel;
    state.energy = Math.min(100, state.energy + prod.energy);
    if (prod.boost) {
      state.boostMul = prod.boost.mul;
      state.boostUntil = state.elapsed + prod.boost.dur;
    }
    state.score = (state.score || 0) + (prod.score || 50);
    state.pickupsCollected = (state.pickupsCollected || 0) + 1;
  }

  /* Render: side-profile Enervit feed station at world position (sx, sy)
     where sy is the terrain surface. */
  function renderStation(ctx, station, sx, sy) {
    /* Tent dimensions */
    const w = 64;
    const h = 44;
    const x = sx - w / 2;
    const y = sy - h;

    /* Pole + flag — visible from far so player anticipates the station */
    ctx.fillStyle = '#888';
    ctx.fillRect(sx + w / 2 - 1, y - 26, 2, 26);
    ctx.fillStyle = '#e30613';
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, y - 26);
    ctx.lineTo(sx + w / 2 + 16, y - 22);
    ctx.lineTo(sx + w / 2, y - 18);
    ctx.closePath();
    ctx.fill();

    /* Tent canopy — Enervit red */
    ctx.fillStyle = '#e30613';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 14);
    ctx.lineTo(x + w / 2, y - 4);
    ctx.lineTo(x + w + 6, y + 14);
    ctx.closePath();
    ctx.fill();

    /* Canopy fringe lines for that classic tent look */
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 14); ctx.lineTo(x + w + 6, y + 14);
    ctx.stroke();

    /* Tent body */
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y + 14, w, h - 14);

    /* Red stripe with ENERVIT */
    ctx.fillStyle = '#e30613';
    ctx.fillRect(x, y + 14, w, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '700 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ENERVIT', x + w / 2, y + 19);

    /* Table */
    ctx.fillStyle = '#3b2814';
    ctx.fillRect(x + 4, y + h - 4, w - 8, 4);

    /* Product crates — colored by type */
    const palette = { gel: '#ff8c00', bar: '#2a8b3a', drink: '#1f78d1' };
    for (let i = 0; i < 3; i++) {
      const cx = x + 8 + i * 16;
      const cy = y + h - 4 - 14;
      ctx.fillStyle = palette[station.type] || '#888';
      ctx.fillRect(cx, cy, 12, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(cx, cy + 5, 12, 1.5);
    }

    /* Product short tag below */
    const prod = PRODUCT[station.type];
    if (prod) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - 24, sy + 2, 48, 14);
      ctx.fillStyle = '#fff';
      ctx.font = '600 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prod.short, sx, sy + 9);
    }

    /* Collected marker — green check */
    if (station.collected) {
      ctx.fillStyle = '#198754';
      ctx.beginPath();
      ctx.arc(sx + w / 2 - 4, y + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + w / 2 - 6, y + 4);
      ctx.lineTo(sx + w / 2 - 4.5, y + 6);
      ctx.lineTo(sx + w / 2 - 1.5, y + 2);
      ctx.stroke();
    }
  }

  function collectIfPassed(state, stations) {
    for (const st of stations) {
      if (!st.collected && state.progressPct >= st.pct) {
        st.collected = true;
        applyEffect(state, st.type);
        showToast(st.type);
        window.rcTrack && window.rcTrack('pickup_collected', {
          monument: state.monument?.id,
          type: st.type,
          pct: st.pct
        });
      }
    }
  }

  window.rcPickups = { makeStations, renderStation, collectIfPassed, PRODUCT };
})();
