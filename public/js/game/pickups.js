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

  /* Render: top-down Enervit feed station at screen (sx, sy).
     Looks like a small red tent + flag pole + product crates from above.
     Tag with product short code is placed pointing toward the road. */
  function renderStation(ctx, station, sx, sy) {
    const prod = PRODUCT[station.type];

    /* Shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Tent — red circle with cross-bracing for that classic festival tent look */
    ctx.fillStyle = '#e30613';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Bright top strip */
    ctx.fillStyle = '#ff2a36';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Cross seam (4 directions) */
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 17, sy); ctx.lineTo(sx + 17, sy);
    ctx.moveTo(sx, sy - 13); ctx.lineTo(sx, sy + 13);
    ctx.stroke();

    /* ENERVIT label */
    ctx.fillStyle = '#fff';
    ctx.font = '700 7px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ENERVIT', sx, sy);

    /* Flag pole on top */
    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 0.6, sy - 22, 1.2, 8);
    ctx.fillStyle = '#e30613';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 22);
    ctx.lineTo(sx + 8, sy - 20);
    ctx.lineTo(sx, sy - 18);
    ctx.closePath();
    ctx.fill();

    /* Product crates beside tent (small colored squares) */
    const cratePalette = { gel: '#ff8c00', bar: '#2a8b3a', drink: '#1f78d1' };
    const crateColor = cratePalette[station.type] || '#888';
    ctx.fillStyle = crateColor;
    ctx.fillRect(sx - 22, sy + 4, 5, 5);
    ctx.fillRect(sx + 17, sy + 4, 5, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(sx - 22, sy + 6, 5, 1);
    ctx.fillRect(sx + 17, sy + 6, 5, 1);

    /* Product tag below the tent */
    if (prod) {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(sx - 26, sy + 12, 52, 12);
      ctx.fillStyle = '#fff';
      ctx.font = '700 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prod.short, sx, sy + 18);
    }

    /* Collected check */
    if (station.collected && !station.missed) {
      ctx.fillStyle = '#198754';
      ctx.beginPath(); ctx.arc(sx + 14, sy - 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + 11.5, sy - 14);
      ctx.lineTo(sx + 13,   sy - 12);
      ctx.lineTo(sx + 16,   sy - 16);
      ctx.stroke();
    } else if (station.missed) {
      ctx.fillStyle = '#dc3545';
      ctx.beginPath(); ctx.arc(sx + 14, sy - 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + 11.5, sy - 16); ctx.lineTo(sx + 16.5, sy - 11);
      ctx.moveTo(sx + 16.5, sy - 16); ctx.lineTo(sx + 11.5, sy - 11);
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
