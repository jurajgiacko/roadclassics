/* Game engine — Pálava MVP (iterácia 1c: side-scroll Elasto Mania štýl).
   Cyklista beží zľava doprava po krivke terénu odvodenej priamo
   z monument.segments. Žiadna perspektíva, žiadne lane offsety —
   všetko sa rieši v 2D world-space (worldX, worldY).

   Zachované moduly:
     - input.js, ui.js, monument.js — bez zmeny
     - pickups.js — render staníc prepísaný pre bočný pohľad (drobnosť dolu)
     - tactics.js — bez zmeny
*/
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const params = new URLSearchParams(location.search);
  const monumentId = params.get('monument') || 'palava';

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let viewW = 0, viewH = 0;

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    viewW = rect.width;
    viewH = rect.height;
    canvas.width  = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  /* ---- Camera + world units ----
     1 worldX unit ≈ 1 logical px. Distance 8000 = 100% trate.
     Camera sa drží tak, aby cyklista bol na 30 % viewW. */
  const CYCLIST_FRAC_X = 0.32;
  const cyclistScreenX = () => viewW * CYCLIST_FRAC_X;

  /* World → screen */
  function worldToScreenX(wx) { return cyclistScreenX() + (wx - state.distance); }

  /* ---- World state ---- */
  const state = {
    monument: null,
    waiting: true,
    paused: false,
    elapsed: 0,
    progressPct: 0,
    distance: 0,
    cadence: 0,
    energy: 100,
    speed: 0,
    pedalPhase: 0,
    activeSegment: null,
    boostMul: 1,
    boostUntil: 0,
    stations: [],
    styleLog: []
  };

  /* ---- Terrain function ----
     terrainY(worldX) returns screen-Y where ground meets sky.
     Built from monument.segments + a smooth perlin-like wobble. */

  // Cumulative elevation along worldX, in screen-pixels.
  // 1 pct of trate = 80 worldX units. We sum gradient * length per segment.
  // Visual amplification factor so 1% gradient → ~5px rise per 80 units.
  const ELEV_AMP = 6;
  const BASELINE_FRAC = 0.72; // baseline ground line (no elevation)

  function elevationAt(wx) {
    if (!state.monument) return 0;
    const pct = wx / 80;
    let e = 0;
    for (const seg of state.monument.segments) {
      if (pct <= seg.from_pct) break;
      const segPct = Math.min(pct, seg.to_pct) - seg.from_pct;
      // gradient = % grade. Each 1 pct of segment * gradient → small rise.
      e += segPct * seg.gradient * ELEV_AMP;
      if (pct < seg.to_pct) break;
    }
    /* small organic wobble so it doesn't feel like piecewise-linear */
    const wob = Math.sin(wx * 0.012) * 4 + Math.cos(wx * 0.04) * 2;
    return e + wob;
  }

  function terrainY(wx) {
    return viewH * BASELINE_FRAC - elevationAt(wx);
  }

  function terrainSlope(wx) {
    /* radians of terrain at worldX, used to tilt cyclist sprite */
    const dx = 18;
    const a = terrainY(wx - dx);
    const b = terrainY(wx + dx);
    return Math.atan2(b - a, dx * 2);
  }

  /* ---- World props (trees, houses, towers, vines) ----
     Each has worldX. Y is computed as terrainY(worldX) at draw time. */
  const props = [];   // {kind, worldX, ...}
  const peloton = []; // {relativeAhead, color}
  let nextSpawnAt = 0;
  let nextSignWx = 600;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnProp(worldX) {
    const kind = pick(['vine','vine','vine','vine','tree','tree','tree','house','house','tower']);
    const detail = {
      kind,
      worldX,
      hue: rand(0, 1),
      size: rand(0.85, 1.15),
      colorVariant: Math.floor(rand(0, 3))
    };
    if (kind === 'vine') detail.bunches = Math.floor(rand(3, 6));
    props.push(detail);
  }

  function initialSpawn() {
    for (let x = 200; x < 4500; x += rand(60, 130)) spawnProp(x);
  }

  function initPeloton() {
    const colors = ['#1f78d1','#ffd43b','#7e3af2','#fb7185','#10b981'];
    for (let i = 0; i < 4; i++) {
      peloton.push({
        relativeAhead: 220 + i * 70 + rand(-20, 20),
        color: colors[i % colors.length],
        bobPhase: rand(0, Math.PI * 2)
      });
    }
  }

  /* ---- Render: SKY ---- */
  function drawSky() {
    /* segment-tinted gradient */
    const seg = state.activeSegment;
    let topCol = '#1c2c4a', midCol = '#cb7d62', botCol = '#f3c79b';
    if (seg) {
      if (seg.kind === 'climb')   { topCol = '#2a1f3b'; midCol = '#a85a4f'; botCol = '#e7b58a'; }
      if (seg.kind === 'descent') { topCol = '#1a2840'; midCol = '#7e7c8c'; botCol = '#dabe97'; }
      if (seg.kind === 'flat')    { topCol = '#1c2c4a'; midCol = '#c9836a'; botCol = '#f4cda3'; }
    }
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, topCol);
    g.addColorStop(0.55, midCol);
    g.addColorStop(0.95, botCol);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    /* Sun disc — lower right */
    const sunY = viewH * 0.28;
    const sunX = viewW * 0.78;
    const sunR = Math.min(viewW, viewH) * 0.07;
    const sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 1.6);
    sg.addColorStop(0, 'rgba(255, 220, 170, 0.95)');
    sg.addColorStop(0.5, 'rgba(255, 180, 130, 0.5)');
    sg.addColorStop(1, 'rgba(255, 180, 130, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - sunR * 1.6, sunY - sunR * 1.6, sunR * 3.2, sunR * 3.2);
    ctx.fillStyle = 'rgba(255, 230, 190, 0.95)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    /* Drifting clouds (slow parallax) */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const cloudOff = state.distance * 0.04;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 280 - cloudOff) % (viewW + 400) + viewW + 400) % (viewW + 400) - 100;
      const cy = viewH * 0.14 + Math.sin(i * 1.7) * 22;
      drawCloud(cx, cy, 60 + (i % 3) * 22);
    }
  }

  function drawCloud(cx, cy, w) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.6, w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.3, cy - 4, w * 0.4, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - w * 0.3, cy + 2, w * 0.35, w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- Render: HILLS (background silhouettes) ---- */
  function drawFarHills() {
    ctx.fillStyle = 'rgba(69, 5, 33, 0.55)';
    const baseY = viewH * 0.55;
    const off = state.distance * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -50; x <= viewW + 50; x += 26) {
      const y = baseY
        + Math.sin((x + off) * 0.011) * 32
        + Math.cos((x + off) * 0.034) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(viewW + 50, viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawMidHills() {
    ctx.fillStyle = 'rgba(44, 3, 20, 0.78)';
    const baseY = viewH * 0.66;
    const off = state.distance * 0.32;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -30; x <= viewW + 30; x += 22) {
      const y = baseY
        + Math.sin((x + off) * 0.018) * 36
        + Math.cos((x + off) * 0.05) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(viewW + 30, viewH);
    ctx.closePath();
    ctx.fill();
  }

  /* ---- Render: TERRAIN (the playable ground) ---- */
  function drawTerrain() {
    const samples = 80;
    const path = [];
    for (let i = 0; i <= samples; i++) {
      const sx = (i / samples) * viewW;
      const wx = state.distance + (sx - cyclistScreenX());
      path.push({ sx, sy: terrainY(wx), wx });
    }

    /* Grass polygon */
    ctx.fillStyle = '#3a5d2a';
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (const p of path) ctx.lineTo(p.sx, p.sy);
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    /* Darker grass band just below surface for depth */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (const p of path) ctx.lineTo(p.sx, p.sy + 24);
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    /* Asphalt strip following the surface */
    ctx.strokeStyle = '#1f1c18';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].sx, path[0].sy + 4);
    for (const p of path) ctx.lineTo(p.sx, p.sy + 4);
    ctx.stroke();

    /* Yellow dashed center stripe */
    ctx.strokeStyle = 'rgba(228, 203, 157, 0.85)';
    ctx.lineWidth = 1.5;
    const dashLen = 14, gapLen = 16;
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = -((state.distance) % (dashLen + gapLen));
    ctx.beginPath();
    ctx.moveTo(path[0].sx, path[0].sy + 4);
    for (const p of path) ctx.lineTo(p.sx, p.sy + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Vineyard texture — short vertical green tufts on the grass below road */
    ctx.fillStyle = 'rgba(20, 50, 18, 0.55)';
    const tuftStep = 26;
    const tuftOffset = Math.floor(state.distance / tuftStep) * tuftStep;
    for (let wx = state.distance - 200; wx < state.distance + viewW + 200; wx += tuftStep) {
      const sx = worldToScreenX(wx);
      if (sx < -10 || sx > viewW + 10) continue;
      const sy = terrainY(wx) + 16;
      ctx.fillRect(sx - 1, sy + 4, 2, 8);
      ctx.fillRect(sx + 6, sy + 8, 2, 6);
    }
  }

  /* ---- Render: PROPS on terrain ---- */
  function drawTree(p) {
    const sx = worldToScreenX(p.worldX);
    if (sx < -50 || sx > viewW + 50) return;
    const sy = terrainY(p.worldX);
    const h = 60 * p.size;
    /* trunk */
    ctx.fillStyle = '#2e1f14';
    ctx.fillRect(sx - 2, sy - h * 0.45, 4, h * 0.45);
    /* canopy */
    ctx.fillStyle = ['#234d20', '#2d6128', '#1b4519'][p.colorVariant % 3];
    ctx.beginPath();
    ctx.ellipse(sx, sy - h * 0.65, h * 0.36, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHouse(p) {
    const sx = worldToScreenX(p.worldX);
    if (sx < -80 || sx > viewW + 80) return;
    const sy = terrainY(p.worldX);
    const w = 64 * p.size;
    const h = 42 * p.size;
    const x = sx - w / 2;
    const y = sy - h;
    /* walls */
    ctx.fillStyle = '#f3eadb';
    ctx.fillRect(x, y, w, h);
    /* roof */
    ctx.fillStyle = ['#a3431f', '#b85530', '#8d3a1e'][p.colorVariant % 3];
    ctx.beginPath();
    ctx.moveTo(x - w * 0.08, y);
    ctx.lineTo(x + w * 0.5, y - h * 0.5);
    ctx.lineTo(x + w * 1.08, y);
    ctx.closePath();
    ctx.fill();
    /* door + window */
    ctx.fillStyle = '#2b1c10';
    ctx.fillRect(x + w * 0.12, y + h * 0.45, w * 0.18, h * 0.55);
    ctx.fillStyle = '#36281a';
    ctx.fillRect(x + w * 0.5, y + h * 0.32, w * 0.28, h * 0.32);
    /* window panes */
    ctx.strokeStyle = '#f3eadb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.64, y + h * 0.32);
    ctx.lineTo(x + w * 0.64, y + h * 0.64);
    ctx.stroke();
  }

  function drawTower(p) {
    const sx = worldToScreenX(p.worldX);
    if (sx < -60 || sx > viewW + 60) return;
    const sy = terrainY(p.worldX);
    const w = 22 * p.size;
    const h = 92 * p.size;
    const x = sx - w / 2;
    const y = sy - h;
    /* base */
    ctx.fillStyle = '#dccdb0';
    ctx.fillRect(x, y + h * 0.32, w, h * 0.68);
    /* spire */
    ctx.fillStyle = '#5e2a14';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.15, y + h * 0.32);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 1.15, y + h * 0.32);
    ctx.closePath();
    ctx.fill();
    /* tiny window */
    ctx.fillStyle = '#2b1c10';
    ctx.fillRect(x + w * 0.4, y + h * 0.5, w * 0.2, h * 0.16);
  }

  function drawVine(p) {
    const sx = worldToScreenX(p.worldX);
    if (sx < -40 || sx > viewW + 40) return;
    const sy = terrainY(p.worldX);
    /* a small bush + grape clusters */
    const bunches = p.bunches || 4;
    ctx.fillStyle = '#1d4419';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 10, 14 * p.size, 8 * p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    /* vertical poles + horizontal wire */
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 10 * p.size, sy);
    ctx.lineTo(sx - 10 * p.size, sy - 16);
    ctx.moveTo(sx + 10 * p.size, sy);
    ctx.lineTo(sx + 10 * p.size, sy - 16);
    ctx.moveTo(sx - 10 * p.size, sy - 14);
    ctx.lineTo(sx + 10 * p.size, sy - 14);
    ctx.stroke();
    /* grape dots */
    ctx.fillStyle = '#6b3aa6';
    for (let i = 0; i < bunches; i++) {
      const bx = sx - 8 * p.size + (i / bunches) * 16 * p.size;
      ctx.beginPath();
      ctx.arc(bx, sy - 8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSign(p) {
    const sx = worldToScreenX(p.worldX);
    if (sx < -40 || sx > viewW + 40) return;
    const sy = terrainY(p.worldX);
    const w = 36;
    const h = 22;
    /* pole */
    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 1, sy - 28, 2, 28);
    /* board */
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#c00';
    ctx.lineWidth = 2;
    ctx.fillRect(sx - w / 2, sy - 28 - h, w, h);
    ctx.strokeRect(sx - w / 2, sy - 28 - h, w, h);
    ctx.fillStyle = '#222';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label || '', sx, sy - 28 - h / 2);
  }

  function drawProps() {
    /* draw far→near by worldX so close props occlude far ones */
    const sorted = [...props].sort((a, b) => a.worldX - b.worldX);
    for (const p of sorted) {
      switch (p.kind) {
        case 'tree': drawTree(p); break;
        case 'house': drawHouse(p); break;
        case 'tower': drawTower(p); break;
        case 'vine': drawVine(p); break;
        case 'sign': drawSign(p); break;
      }
    }
  }

  /* ---- Cyclist sprite (side profile, leans with terrain) ---- */
  function drawCyclistAt(sx, sy, opts = {}) {
    const scale = opts.scale || 1;
    const slope = opts.slope || 0;
    const phase = opts.phase || 0;
    const colorJersey = opts.color || '#e53747';
    const colorAccent = opts.accent || '#fff';
    const isPlayer = opts.isPlayer || false;

    ctx.save();
    /* anchor at saddle/pedal axis on ground */
    ctx.translate(sx, sy);
    ctx.rotate(slope);
    ctx.scale(scale, scale);

    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    /* wheels */
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(-22, -10, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(22, -10, 11, 0, Math.PI * 2); ctx.stroke();

    /* hub dots */
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-22, -10, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -10, 1.5, 0, Math.PI * 2); ctx.fill();

    /* spinning spoke hint */
    if (opts.spinning) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      const sp = phase * 1.4;
      [-22, 22].forEach(wx => {
        ctx.beginPath();
        ctx.moveTo(wx - 9 * Math.cos(sp), -10 - 9 * Math.sin(sp));
        ctx.lineTo(wx + 9 * Math.cos(sp), -10 + 9 * Math.sin(sp));
        ctx.stroke();
      });
    }

    /* frame triangle */
    ctx.strokeStyle = isPlayer ? '#e4cb9d' : '#cccccc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-22, -10);     // rear hub
    ctx.lineTo(0, -22);       // bottom of seat tube (~bottom bracket)
    ctx.lineTo(22, -10);      // front hub
    ctx.moveTo(0, -22);
    ctx.lineTo(-2, -36);      // seat post
    ctx.moveTo(0, -22);
    ctx.lineTo(14, -32);      // top tube to head tube
    ctx.lineTo(22, -10);
    ctx.stroke();

    /* handlebars */
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.lineTo(20, -36);
    ctx.stroke();

    /* legs (pedaling) — anchored at bottom bracket (0, -22) */
    const legLen = 14;
    const knee1 = { x: Math.cos(phase) * 6, y: -22 + Math.sin(phase) * 4 };
    const knee2 = { x: Math.cos(phase + Math.PI) * 6, y: -22 + Math.sin(phase + Math.PI) * 4 };
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-2, -36); ctx.lineTo(knee1.x, knee1.y); ctx.lineTo(knee1.x + 4, -22 + 8);
    ctx.moveTo(-2, -36); ctx.lineTo(knee2.x, knee2.y); ctx.lineTo(knee2.x + 4, -22 + 8);
    ctx.stroke();

    /* torso (jersey, leaning forward) */
    ctx.fillStyle = colorJersey;
    ctx.beginPath();
    ctx.moveTo(-2, -36);
    ctx.lineTo(2, -42);
    ctx.lineTo(14, -36);
    ctx.lineTo(8, -28);
    ctx.closePath();
    ctx.fill();
    /* jersey accent */
    ctx.fillStyle = colorAccent;
    ctx.fillRect(-1, -34, 12, 1.5);

    /* arms reaching to bars */
    ctx.strokeStyle = colorJersey;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -36); ctx.lineTo(20, -36);
    ctx.stroke();

    /* head + helmet */
    ctx.fillStyle = isPlayer ? '#e4cb9d' : '#444';
    ctx.beginPath();
    ctx.ellipse(8, -44, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    /* aero tail of helmet */
    ctx.beginPath();
    ctx.moveTo(8, -44); ctx.lineTo(0, -42); ctx.lineTo(4, -47); ctx.closePath();
    ctx.fill();
    /* visor / face */
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(11, -44, 3, 2);

    ctx.restore();
  }

  /* ---- Peloton (sticky, always ahead of player) ---- */
  function drawPeloton(dt) {
    peloton.forEach(c => {
      /* drift: if player slow → peloton pulls away; player fast → catches up */
      const target = state.speed * 1.05;
      const drift = (1 - target) * 12 * dt;
      c.relativeAhead = Math.max(60, Math.min(800, c.relativeAhead + drift));
      c.bobPhase += dt * (4 + state.speed * 6);

      const wx = state.distance + c.relativeAhead;
      const sx = worldToScreenX(wx);
      if (sx < -60 || sx > viewW + 60) return;
      const sy = terrainY(wx);
      const slope = terrainSlope(wx);
      drawCyclistAt(sx, sy, {
        scale: 0.85,
        slope,
        phase: c.bobPhase,
        color: c.color,
        spinning: state.speed > 0.05
      });
    });
  }

  function drawPlayer() {
    const sx = cyclistScreenX();
    const sy = terrainY(state.distance);
    const slope = terrainSlope(state.distance);
    /* breath wobble */
    const breath = Math.sin(state.elapsed * 2.4) * 0.6;
    drawCyclistAt(sx, sy + breath, {
      scale: 1.0,
      slope,
      phase: state.pedalPhase,
      color: '#e53747',
      accent: '#e4cb9d',
      isPlayer: true,
      spinning: state.speed > 0.05
    });
    /* anaerobic glow */
    if (state.cadence > 110) {
      ctx.fillStyle = 'rgba(229, 55, 71, 0.18)';
      ctx.beginPath();
      ctx.arc(sx, sy - 30, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- Maintain world (spawn + cleanup) ---- */
  function maintainWorld() {
    for (let i = props.length - 1; i >= 0; i--) {
      if (props[i].worldX < state.distance - viewW * 0.5) props.splice(i, 1);
    }
    while (state.distance + viewW * 1.5 > nextSpawnAt) {
      spawnProp(nextSpawnAt);
      nextSpawnAt += rand(60, 130);
    }
    while (state.distance > nextSignWx - viewW) {
      const realKm = Math.round(nextSignWx / 80 * (state.monument?.real?.long_km || 125) / 100);
      props.push({ kind: 'sign', worldX: nextSignWx, label: `${realKm} km` });
      nextSignWx += 8 * 80; // every "8% of trate" ≈ every ~10 km
    }
  }

  /* ---- Segment label trigger ---- */
  function checkSegment() {
    if (!state.monument) return;
    const seg = window.rcMonument.segmentAtPct(state.monument, state.progressPct);
    if (seg && seg !== state.activeSegment) {
      state.activeSegment = seg;
      showSegmentBanner(seg);
    }
  }

  function showSegmentBanner(seg) {
    const el = document.getElementById('segment-banner');
    if (!el) return;
    const sign = seg.gradient > 0.5 ? 'up' : (seg.gradient < -0.5 ? 'down' : '');
    el.className = 'segment-banner show ' + sign;
    const gText = seg.gradient > 0.5 ? `↑ ${seg.gradient.toFixed(1)}%`
                : seg.gradient < -0.5 ? `↓ ${Math.abs(seg.gradient).toFixed(1)}%`
                : `— ${seg.gradient.toFixed(1)}%`;
    el.innerHTML = `${seg.label}<span class="gradient">${gText}</span>`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('show'); }, 2400);
  }

  /* ---- Frame ---- */
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!state.waiting && !state.paused) {
      state.elapsed += dt;
      const pressing = window.rcInput && window.rcInput.isPressing();

      if (state.boostUntil && state.elapsed > state.boostUntil) {
        state.boostMul = 1; state.boostUntil = 0;
      }

      const seg = state.activeSegment;
      const gradMul = seg ? Math.max(0.55, 1 - seg.gradient * 0.05) : 1;
      const targetSpeed = (pressing ? 1 : 0) * gradMul * state.boostMul;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);

      state.distance += state.speed * 200 * dt;
      state.progressPct = Math.min(100, state.progressPct + state.speed * (100 / 180) * dt);

      const targetCadence = pressing ? 92 : 0;
      state.cadence += (targetCadence - state.cadence) * Math.min(1, dt * 4);
      state.pedalPhase += dt * (4 + state.speed * 8);

      const drain = pressing ? 1.0 : 0.15;
      state.energy = Math.max(0, state.energy - drain * dt);

      maintainWorld();
      checkSegment();

      if (state.stations.length) window.rcPickups.collectIfPassed(state, state.stations);
      if (window.rcTactics) window.rcTactics.tick(state, () => {});

      window.rcUI.setTimer(state.elapsed);
      window.rcUI.setProgressPct(state.progressPct);
      window.rcUI.setCadence(state.cadence);
      window.rcUI.setEnergy(state.energy);
    }

    drawSky();
    drawFarHills();
    drawMidHills();
    drawTerrain();
    drawProps();
    drawStations();
    drawPeloton(state.waiting ? 0 : (1 / 60));
    drawPlayer();

    requestAnimationFrame(frame);
  }

  function drawStations() {
    if (!state.stations.length || !window.rcPickups) return;
    /* Draw far → near by worldX (so closer stations occlude). */
    const sorted = [...state.stations].sort((a, b) => a.worldX - b.worldX);
    for (const st of sorted) {
      const sx = worldToScreenX(st.worldX);
      if (sx < -120 || sx > viewW + 120) continue;
      const sy = terrainY(st.worldX);
      window.rcPickups.renderStation(ctx, st, sx, sy);
    }
  }

  /* ---- Boot ---- */
  function attachStartHandler() {
    const overlay = document.getElementById('start-overlay');
    const hint = document.querySelector('.kbd-hint');
    function start() {
      if (!state.waiting) return;
      state.waiting = false;
      overlay && overlay.classList.add('hide');
      setTimeout(() => hint && hint.classList.add('fade'), 2400);
      window.rcTrack && window.rcTrack('game_start', { monument: monumentId });
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') start();
    });
    const tap = document.getElementById('tap-zone');
    tap.addEventListener('touchstart', start, { passive: true });
    tap.addEventListener('mousedown', start);
    overlay && overlay.addEventListener('click', start);
  }

  async function boot() {
    resize();
    initialSpawn();
    initPeloton();
    nextSpawnAt = 4500;
    requestAnimationFrame(frame);
    attachStartHandler();

    try {
      const m = await window.rcMonument.load(monumentId);
      state.monument = m;
      window.rcUI.setMonumentName(m.name);
      const pts = window.rcMonument.buildElevationPath(m);
      window.rcMonument.renderProfileSvg(window.rcUI.els.profileSvg, pts);
      if (window.rcPickups) state.stations = window.rcPickups.makeStations(m);
      if (window.rcTactics)  window.rcTactics.setup(m);
      const overlay = document.getElementById('start-overlay');
      if (overlay) {
        const h = overlay.querySelector('h2');
        if (h) h.textContent = m.name;
      }
    } catch (err) {
      console.error('Monument load failed:', err);
      window.rcUI.setMonumentName('Chyba načítania');
    }
  }

  boot();
})();
