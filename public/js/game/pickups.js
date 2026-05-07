/* Pickups — Enervit občerstvovačky.
   - Reads monument.pickups[] (each item has pct + type)
   - Renders a small Enervit-branded feed station on the canvas at the
     pickup's world position (right side of the road)
   - Auto-collects when player crosses the pct
   - Pushes a floating toast ("+25 ENERVIT GEL") and applies energy/speed
     boost to game state */
(function () {
  /* Real Enervit C2:1PRO cycling line — varied across feed stations so the
     player sees the full range, not just Isocarb everywhere. */
  const PRODUCT = {
    gel:        { name: 'Carbo Gel C2:1PRO',           short: 'C2:1 GEL',  energy: 25, boost: { mul: 1.05, dur: 10 }, score: 100 },
    caffeine:   { name: 'Carbo Gel C2:1PRO Caffeine',  short: 'CAFFEINE',  energy: 22, boost: { mul: 1.18, dur: 14 }, score: 130 },
    jelly:      { name: 'Carbo Jelly C2:1PRO Tropical',short: 'JELLY',     energy: 28, boost: { mul: 1.04, dur: 12 }, score: 105 },
    chews:      { name: 'Carbo Chews C2:1PRO',         short: 'CHEWS',     energy: 20, boost: { mul: 1.06, dur: 8  }, score: 95  },
    bar:        { name: 'Carbo Bar C2:1PRO',           short: 'C2:1 BAR',  energy: 35, boost: null,                    score: 80  },
    'liquid-gel':{name: 'Liquid Gel C2:1PRO 60 ml',    short: 'LIQUID',    energy: 30, boost: { mul: 1.08, dur: 12 }, score: 110 },
    drink:      { name: 'Isocarb C2:1PRO',             short: 'ISOCARB',   energy: 30, boost: { mul: 1.10, dur: 8  }, score: 90  }
  };

  function makeStations(monument) {
    /* Each pickup pct → world-Y (forward distance). worldX (lateral lane
       offset) is set by the engine based on side alternation. */
    return monument.pickups.map((p, i) => ({
      id: `${monument.id}-${i}`,
      pct: p.pct,
      type: p.type,
      worldY: p.pct * 80,
      worldX: 0,            // engine fills with side offset
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

  /* Render: illustrated Enervit feed station sprite at (sx, sy).
     Falls back to a tiny procedural tent if sprites aren't loaded yet. */
  const SPRITE_BY_TYPE = {
    gel:         'station-gel',
    caffeine:    'station-caffeine',
    jelly:       'station-jelly',
    chews:       'station-chews',
    bar:         'station-bar',
    'liquid-gel':'station-gel',  /* reuse gel station illustration for liquid-gel */
    drink:       'station-drink'
  };

  function renderStation(ctx, station, sx, sy) {
    const prod = PRODUCT[station.type];
    const spriteId = SPRITE_BY_TYPE[station.type] || 'station-gel';
    const img = window.rcSprites && window.rcSprites.get && window.rcSprites.get(spriteId);

    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 22, 36, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (img && img.width >= 4) {
      const h = 88;
      const w = h * (img.width / img.height);
      ctx.drawImage(img, sx - w / 2, sy - h * 0.65, w, h);
    } else {
      /* fallback minimalist tent */
      ctx.fillStyle = '#e30613';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ENERVIT', sx, sy);
    }

    /* Product short code tag below the tent */
    if (prod) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      const tw = 64, th = 16;
      ctx.fillRect(sx - tw / 2, sy + 26, tw, th);
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prod.short, sx, sy + 26 + th / 2);
    }

    /* Collected / missed marker */
    if (station.collected && !station.missed) {
      ctx.fillStyle = '#198754';
      ctx.beginPath(); ctx.arc(sx + 26, sy - 32, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 22, sy - 32);
      ctx.lineTo(sx + 25, sy - 29);
      ctx.lineTo(sx + 30, sy - 35);
      ctx.stroke();
    } else if (station.missed) {
      ctx.fillStyle = '#dc3545';
      ctx.beginPath(); ctx.arc(sx + 26, sy - 32, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 22, sy - 36); ctx.lineTo(sx + 30, sy - 28);
      ctx.moveTo(sx + 30, sy - 36); ctx.lineTo(sx + 22, sy - 28);
      ctx.stroke();
    }
  }

  function collectIfPassed(state, stations) {
    for (const st of stations) {
      if (st.collected) continue;
      /* Auto-collect when player crosses pct AND is in same-side lane (within reach). */
      if (state.progressPct >= st.pct) {
        /* Lane proximity check: must be within ~half lane of the station's side. */
        const sameSide = (st.worldX > 0 && state.laneX > -10) ||
                         (st.worldX < 0 && state.laneX <  10);
        if (sameSide) {
          st.collected = true;
          applyEffect(state, st.type);
          showToast(st.type);
          window.rcTrack && window.rcTrack('pickup_collected', {
            monument: state.monument?.id,
            type: st.type,
            pct: st.pct
          });
        } else if (state.progressPct >= st.pct + 1) {
          /* missed it — mark collected but no effect, no toast */
          st.collected = true;
          st.missed = true;
        }
      }
    }
  }

  window.rcPickups = { makeStations, renderStation, collectIfPassed, PRODUCT };
})();
