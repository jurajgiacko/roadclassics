/* Pickups — Enervit občerstvovačky.
   - Reads monument.pickups[] (each item has pct + type)
   - Renders a small Enervit-branded feed station on the canvas at the
     pickup's world position (right side of the road)
   - Auto-collects when player crosses the pct
   - Pushes a floating toast ("+25 ENERVIT GEL") and applies energy/speed
     boost to game state */
(function () {
  const PRODUCT = {
    gel:   { name: 'Liquid Gel',     short: 'GEL',   energy: 25, boost: { mul: 1.05, dur: 10 } },
    bar:   { name: 'Power Sport Bar', short: 'BAR',   energy: 35, boost: null },
    drink: { name: 'Sport Drink',    short: 'DRINK', energy: 25, boost: { mul: 1.10, dur: 5 } }
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
  }

  /* Render: tent + banner + small product crate on the roadside.
     `projectProp` is the engine's perspective projector (passed in to keep
     this module decoupled). */
  function renderStation(ctx, station, project) {
    const proj = project({ worldX: station.worldX, lane: station.lane }, 1.0);
    if (!proj) return;
    const s = proj.scale;
    const x = proj.x;
    const y = proj.y;

    /* Tent base */
    const w = 90 * s;
    const h = 56 * s;
    const tx = x - w / 2;
    const ty = y - h - 6 * s;

    /* Tent canopy — Enervit red */
    ctx.fillStyle = '#e30613';
    ctx.beginPath();
    ctx.moveTo(tx - 8 * s, ty + 16 * s);
    ctx.lineTo(tx + w / 2,  ty - 6 * s);
    ctx.lineTo(tx + w + 8 * s, ty + 16 * s);
    ctx.closePath();
    ctx.fill();

    /* Tent body */
    ctx.fillStyle = '#fff';
    ctx.fillRect(tx, ty + 16 * s, w, h - 16 * s);

    /* Red stripe at top of body */
    ctx.fillStyle = '#e30613';
    ctx.fillRect(tx, ty + 16 * s, w, 8 * s);

    /* ENERVIT label (only readable when close enough) */
    if (s > 0.55) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(11 * s)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ENERVIT', tx + w / 2, ty + 20 * s);
    }

    /* Table */
    ctx.fillStyle = '#3b2814';
    ctx.fillRect(tx + 6 * s, ty + h - 4 * s, w - 12 * s, 6 * s);

    /* Product crates — colored by type */
    const palette = { gel: '#ff8c00', bar: '#2a8b3a', drink: '#1f78d1' };
    const cw = 14 * s;
    const ch = 18 * s;
    for (let i = 0; i < 3; i++) {
      const cx = tx + 14 * s + i * (cw + 6 * s);
      const cy = ty + h - 4 * s - ch;
      ctx.fillStyle = palette[station.type] || '#888';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx, cy + ch * 0.35, cw, 2 * s);
    }

    /* Type tag below station */
    if (s > 0.5) {
      const prod = PRODUCT[station.type];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tagW = 60 * s;
      const tagH = 16 * s;
      ctx.fillRect(x - tagW / 2, y + 4 * s, tagW, tagH);
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(10 * s)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prod ? prod.short : '', x, y + 4 * s + tagH / 2);
    }

    /* Glowing collected marker (consumed) */
    if (station.collected) {
      ctx.fillStyle = 'rgba(25, 135, 84, 0.85)';
      ctx.beginPath();
      ctx.arc(x, ty - 4 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
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
