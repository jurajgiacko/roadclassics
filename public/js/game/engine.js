/* Game engine — Pálava MVP fáza 1 (rich skeleton).
   Pridané v iterácii 1b:
     - Multi-vrstvový parallax (sky, far hills, mid hills, vineyards, near trees)
     - Pri-cestné objekty: vinice, stromy, moravské domčeky, kostolné veže,
       dopravné značky s km markerom — všetko spawnuje a scrolluje
     - Peloton (4 NPC cyklisti) v rôznych farbách dresov, relatívna rýchlosť
       voči hráčovi
     - Animácia šliapania (nohy + telo cyklistu)
     - Segment label banner pri vstupe do nového segmentu
     - Tap-to-start overlay ktorý čaká na prvý input
   Stále NIE JE: plná energy/cadence logika (session 2), pickupy (session 3).
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

  /* ---- World state ---- */
  const state = {
    monument: null,
    waiting: true,        // true = pre-start overlay still up
    paused: false,        // tactic modal in progress
    elapsed: 0,
    progressPct: 0,
    distance: 0,          // virtual world units travelled (drives parallax)
    cadence: 0,
    energy: 100,
    speed: 0,             // 0..1.5 multiplier
    pedalPhase: 0,        // 0..2π for leg animation
    activeSegment: null,
    boostMul: 1,          // active short-term multiplier from pickup/tactic
    boostUntil: 0,
    stations: [],         // Enervit feed stations along the route
    styleLog: []          // tactic choices for finish-screen style
  };

  /* ---- World objects (scrolling props) ----
     Each has world-x in "units"; we render based on (worldX - state.distance)*parallax. */
  const props = [];   // {kind, worldX, lane, ...details}
  const peloton = []; // {worldX, lane, color, baseOffset}
  let nextSpawnAt = 0;
  let nextSignKm = 5;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnProp(worldX) {
    const kind = pick(['vine', 'vine', 'vine', 'tree', 'tree', 'house', 'tower']);
    const lane = Math.random() < 0.5 ? -1 : 1; // left or right side of road
    const detail = {
      kind,
      worldX,
      lane,
      hue: rand(0, 1),
      size: rand(0.85, 1.15),
      colorVariant: Math.floor(rand(0, 3))
    };
    if (kind === 'vine') {
      detail.rows = Math.floor(rand(3, 7));
      detail.length = rand(80, 180);
    }
    props.push(detail);
  }

  function spawnSign(worldX, label) {
    props.push({ kind: 'sign', worldX, lane: 1, label });
  }

  function initialSpawn() {
    /* Pre-fill the world ahead of camera. */
    for (let x = 0; x < 4000; x += rand(70, 160)) {
      spawnProp(x);
    }
  }

  function initPeloton() {
    const colors = ['#1f78d1', '#ffd43b', '#7e3af2', '#fb7185', '#10b981'];
    for (let i = 0; i < 4; i++) {
      peloton.push({
        worldX: rand(180, 800),
        lane: rand(-0.6, 0.6),
        color: colors[i % colors.length],
        baseOffset: rand(-0.15, 0.25)
      });
    }
  }

  /* ---- Coord helpers ----
     Road horizon at viewH * 0.62. Cyclist plane at viewH * 0.82.
     Lane offset shifts the prop horizontally on the perspective road. */
  const HORIZON = () => viewH * 0.62;
  const ROAD_Y  = () => viewH * 0.86;

  /* Map a world-X relative to camera to screen-X with parallax.
     parallax 1.0 = ground plane, <1 = farther layers. */
  function toScreenX(worldX, parallax = 1) {
    return viewW * 0.5 + (worldX - state.distance) * parallax;
  }

  /* ---- Render layers ---- */
  function drawSky() {
    const seg = state.activeSegment;
    /* Slight sky tint variation by segment kind for visual variety */
    let topCol = '#1a2238', midCol = '#5b4a63', botCol = '#cfa97a';
    if (seg) {
      if (seg.kind === 'climb')  { topCol = '#2a1f3b'; midCol = '#6a4a55'; }
      if (seg.kind === 'descent'){ topCol = '#1a2840'; midCol = '#536f7a'; botCol = '#dabe97'; }
      if (seg.kind === 'flat')   { topCol = '#1f2a44'; midCol = '#6a5a72'; }
    }
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, topCol);
    g.addColorStop(0.55, midCol);
    g.addColorStop(1, botCol);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    /* Drifting clouds */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const cloudOffset = state.distance * 0.05;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 280 - cloudOffset) % (viewW + 400)) - 100;
      const cy = viewH * 0.18 + Math.sin(i * 1.7) * 30;
      drawCloud(cx, cy, 60 + (i % 3) * 20);
    }
  }

  function drawCloud(cx, cy, w) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.6, w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.3, cy - 4, w * 0.4, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - w * 0.3, cy + 2, w * 0.35, w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHillsFar() {
    ctx.fillStyle = 'rgba(69, 5, 33, 0.55)';
    const baseY = HORIZON() - 6;
    const offset = state.distance * 0.15;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 80);
    for (let x = -100; x <= viewW + 100; x += 30) {
      const py = baseY
                 + Math.sin((x + offset) * 0.012) * 28
                 + Math.cos((x + offset) * 0.03) * 10;
      ctx.lineTo(x, py);
    }
    ctx.lineTo(viewW + 100, baseY + 80);
    ctx.lineTo(0, baseY + 80);
    ctx.closePath();
    ctx.fill();
  }

  function drawHillsMid() {
    ctx.fillStyle = 'rgba(44, 3, 20, 0.85)';
    const baseY = HORIZON() + 24;
    const offset = state.distance * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 200);
    for (let x = -80; x <= viewW + 80; x += 24) {
      const py = baseY
                 + Math.sin((x + offset) * 0.018) * 34
                 + Math.cos((x + offset) * 0.045) * 9;
      ctx.lineTo(x, py);
    }
    ctx.lineTo(viewW + 80, baseY + 200);
    ctx.lineTo(0, baseY + 200);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoad() {
    /* Trapezoid road with horizon-vanishing perspective. */
    const horizon = HORIZON();
    const roadY = ROAD_Y();
    const roadBottom = viewH;
    const farW = viewW * 0.06;
    const nearW = viewW * 0.95;
    const cx = viewW * 0.5;

    /* Verge (grass) */
    ctx.fillStyle = '#3b5d2c';
    ctx.fillRect(0, horizon, viewW, viewH - horizon);

    /* Vineyard band — alternating dark/light green stripes that move */
    const vineOffset = state.distance * 0.7;
    for (let row = 0; row < 14; row++) {
      const y0 = horizon + 2 + row * ((viewH - horizon) / 22);
      const y1 = y0 + ((viewH - horizon) / 22);
      if (y1 > roadY - 12) break;
      const stripeOff = (vineOffset * (1 + row * 0.05)) % 80;
      for (let sx = -stripeOff; sx < viewW; sx += 80) {
        const isDark = ((Math.floor((sx + vineOffset) / 80)) % 2) === 0;
        ctx.fillStyle = isDark ? 'rgba(28, 60, 28, 0.85)' : 'rgba(72, 110, 56, 0.7)';
        ctx.fillRect(sx, y0, 40, y1 - y0);
      }
    }

    /* Dirt shoulder */
    ctx.fillStyle = '#8a6c4a';
    ctx.beginPath();
    ctx.moveTo(cx - farW * 1.4, horizon);
    ctx.lineTo(cx + farW * 1.4, horizon);
    ctx.lineTo(cx + nearW * 0.6, roadBottom);
    ctx.lineTo(cx - nearW * 0.6, roadBottom);
    ctx.closePath();
    ctx.fill();

    /* Asphalt */
    ctx.fillStyle = '#2d2a26';
    ctx.beginPath();
    ctx.moveTo(cx - farW, horizon);
    ctx.lineTo(cx + farW, horizon);
    ctx.lineTo(cx + nearW * 0.5, roadBottom);
    ctx.lineTo(cx - nearW * 0.5, roadBottom);
    ctx.closePath();
    ctx.fill();

    /* Center dashed line, scrolling toward camera (perspective) */
    ctx.fillStyle = 'rgba(228, 203, 157, 0.9)';
    const dashCount = 14;
    const offset = (state.distance * 1.6) % 1;
    for (let i = 0; i < dashCount; i++) {
      const t = ((i / dashCount) + offset) % 1;
      const tt = Math.pow(t, 1.8); // perspective curve
      const y = horizon + (roadBottom - horizon) * tt;
      const halfW = farW + (nearW * 0.5 - farW) * tt;
      const dashH = 4 + 14 * tt;
      ctx.fillRect(cx - 1, y, 2, Math.max(2, dashH * 0.4));
    }

    /* Side line markers (white) */
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - farW * 0.96, horizon);
    ctx.lineTo(cx - nearW * 0.49, roadBottom);
    ctx.moveTo(cx + farW * 0.96, horizon);
    ctx.lineTo(cx + nearW * 0.49, roadBottom);
    ctx.stroke();
  }

  /* Project a world prop to screen using perspective.
     Returns null if behind camera or too far ahead. */
  function projectProp(prop, parallax = 0.95) {
    const horizon = HORIZON();
    const roadBottom = viewH;
    /* "depth" along the road, 0 = horizon (far), 1 = camera (close) */
    const dx = (prop.worldX - state.distance) * parallax;
    if (dx < -120) return null;       // already behind camera
    if (dx > 1800) return null;       // too far ahead
    /* Map dx to depth t in [0..1+]. Closer dx = larger t. */
    const t = Math.max(0.001, 1 - dx / 1800);
    const tt = Math.pow(t, 1.8);
    const y = horizon + (roadBottom - horizon) * tt;
    const lateral = prop.lane * (60 + 380 * tt);
    const x = viewW * 0.5 + lateral;
    const scale = 0.05 + 0.95 * tt;
    return { x, y, scale, t: tt };
  }

  /* ---- Prop renderers ---- */
  function drawTree(p, proj) {
    const h = 60 * proj.scale * (p.size || 1);
    /* trunk */
    ctx.fillStyle = '#3a261a';
    ctx.fillRect(proj.x - 2 * proj.scale, proj.y - h * 0.35, 4 * proj.scale, h * 0.35);
    /* canopy */
    ctx.fillStyle = ['#2f6b2c', '#3a7d36', '#4a8c3e'][p.colorVariant % 3];
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y - h * 0.55, h * 0.35, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHouse(p, proj) {
    const w = 70 * proj.scale * (p.size || 1);
    const h = 50 * proj.scale * (p.size || 1);
    const x = proj.x - w / 2;
    const y = proj.y - h;
    /* walls */
    ctx.fillStyle = '#f4eddd';
    ctx.fillRect(x, y, w, h);
    /* roof — terracotta */
    ctx.fillStyle = ['#a3431f', '#b85530', '#8d3a1e'][p.colorVariant % 3];
    ctx.beginPath();
    ctx.moveTo(x - w * 0.08, y);
    ctx.lineTo(x + w * 0.5, y - h * 0.45);
    ctx.lineTo(x + w * 1.08, y);
    ctx.closePath();
    ctx.fill();
    /* window */
    ctx.fillStyle = '#3b2814';
    ctx.fillRect(x + w * 0.35, y + h * 0.35, w * 0.3, h * 0.35);
    /* door */
    ctx.fillStyle = '#23170c';
    ctx.fillRect(x + w * 0.1, y + h * 0.5, w * 0.18, h * 0.5);
  }

  function drawTower(p, proj) {
    const w = 30 * proj.scale * (p.size || 1);
    const h = 110 * proj.scale * (p.size || 1);
    const x = proj.x - w / 2;
    const y = proj.y - h;
    /* base */
    ctx.fillStyle = '#e4d6b4';
    ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
    /* spire */
    ctx.fillStyle = '#5e2a14';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, y + h * 0.35);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 1.1, y + h * 0.35);
    ctx.closePath();
    ctx.fill();
    /* clock dot */
    ctx.fillStyle = '#3b2814';
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.55, w * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVine(p, proj) {
    /* Compact vineyard cluster — rows of small green dots */
    const w = (p.length || 100) * proj.scale * 0.4;
    const rows = p.rows || 4;
    ctx.fillStyle = 'rgba(28, 60, 28, 0.8)';
    for (let r = 0; r < rows; r++) {
      const ry = proj.y - r * 6 * proj.scale;
      for (let i = 0; i < 6; i++) {
        const dx = (i / 6) * w - w / 2 + r * 2;
        ctx.beginPath();
        ctx.arc(proj.x + dx, ry, 2.5 * proj.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSign(p, proj) {
    const w = 40 * proj.scale;
    const h = 26 * proj.scale;
    const px = proj.x - w / 2;
    const py = proj.y - 32 * proj.scale - h;
    /* pole */
    ctx.fillStyle = '#888';
    ctx.fillRect(proj.x - 1.5 * proj.scale, proj.y - 32 * proj.scale, 3 * proj.scale, 32 * proj.scale);
    /* board */
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#c00';
    ctx.lineWidth = 2 * proj.scale;
    ctx.fillRect(px, py, w, h);
    ctx.strokeRect(px, py, w, h);
    /* text */
    if (proj.scale > 0.45) {
      ctx.fillStyle = '#222';
      ctx.font = `${Math.max(8, 11 * proj.scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label || '', px + w / 2, py + h / 2);
    }
  }

  /* ---- Cyclist sprite (for player AND peloton) ---- */
  function drawCyclistAt(cx, cy, opts = {}) {
    const scale = opts.scale || 1;
    const phase = opts.phase || 0;
    const colorJersey = opts.color || '#e53747';
    const colorAccent = opts.accent || '#fff';
    const isPlayer = opts.isPlayer || false;

    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 28 * scale, 30 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    /* leg pedal animation */
    const legSwing = Math.sin(phase) * 6 * scale;
    const legSwing2 = Math.sin(phase + Math.PI) * 6 * scale;

    /* wheels */
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1.5, 3 * scale);
    ctx.beginPath(); ctx.arc(cx - 22 * scale, cy + 18 * scale, 14 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 22 * scale, cy + 18 * scale, 14 * scale, 0, Math.PI * 2); ctx.stroke();

    /* spokes (suggest motion when moving) */
    if (opts.spinning) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      const spinPhase = phase * 1.3;
      [-22, 22].forEach(wx => {
        ctx.beginPath();
        ctx.moveTo(cx + wx * scale - 12 * scale * Math.cos(spinPhase), cy + 18 * scale - 12 * scale * Math.sin(spinPhase));
        ctx.lineTo(cx + wx * scale + 12 * scale * Math.cos(spinPhase), cy + 18 * scale + 12 * scale * Math.sin(spinPhase));
        ctx.stroke();
      });
    }

    /* frame */
    ctx.strokeStyle = isPlayer ? '#e4cb9d' : '#cccccc';
    ctx.lineWidth = Math.max(1.5, 3 * scale);
    ctx.beginPath();
    ctx.moveTo(cx - 22 * scale, cy + 18 * scale);
    ctx.lineTo(cx + 4 * scale,  cy);
    ctx.lineTo(cx + 22 * scale, cy + 18 * scale);
    ctx.moveTo(cx + 4 * scale, cy);
    ctx.lineTo(cx - 4 * scale, cy - 18 * scale);
    ctx.stroke();

    /* legs */
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1.5, 2.6 * scale);
    ctx.beginPath();
    ctx.moveTo(cx + 4 * scale, cy);
    ctx.lineTo(cx + legSwing, cy + 14 * scale);
    ctx.moveTo(cx + 4 * scale, cy);
    ctx.lineTo(cx + legSwing2, cy + 14 * scale);
    ctx.stroke();

    /* torso (jersey) */
    ctx.fillStyle = colorJersey;
    ctx.fillRect(cx - 6 * scale, cy - 26 * scale, 14 * scale, 18 * scale);
    /* jersey accent stripe */
    ctx.fillStyle = colorAccent;
    ctx.fillRect(cx - 6 * scale, cy - 16 * scale, 14 * scale, 2 * scale);

    /* arms */
    ctx.strokeStyle = colorJersey;
    ctx.lineWidth = Math.max(1.5, 2.2 * scale);
    ctx.beginPath();
    ctx.moveTo(cx + 0 * scale, cy - 20 * scale);
    ctx.lineTo(cx + 14 * scale, cy - 4 * scale);
    ctx.stroke();

    /* helmet */
    ctx.fillStyle = isPlayer ? '#e4cb9d' : '#444';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 30 * scale, 8 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    /* visor */
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx + 4 * scale, cy - 28 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- Peloton render ---- */
  function drawPeloton() {
    /* Peloton sits "ahead" of the player in world-space. As player goes
       faster, they get closer; slower, they pull away. */
    peloton.forEach((c) => {
      /* drift relative to player based on speed */
      const driftRate = c.baseOffset - state.speed * 0.2;
      c.worldX += driftRate;
      const proj = projectProp({ worldX: c.worldX, lane: c.lane }, 1.0);
      if (!proj) return;
      drawCyclistAt(proj.x, proj.y, {
        scale: 0.55 + proj.t * 0.4,
        phase: state.pedalPhase + c.baseOffset * 4,
        color: c.color,
        spinning: state.speed > 0.1
      });
    });
  }

  /* ---- Player ---- */
  function drawPlayer() {
    const cx = viewW * 0.5;
    const cy = ROAD_Y();
    const breath = Math.sin(state.elapsed * 2.4) * 1.2;
    drawCyclistAt(cx, cy + breath, {
      scale: 1.3,
      phase: state.pedalPhase,
      color: '#e53747',
      accent: '#e4cb9d',
      isPlayer: true,
      spinning: state.speed > 0.1
    });

    /* exertion glow when in anaerobic */
    if (state.cadence > 110) {
      ctx.fillStyle = 'rgba(229, 55, 71, 0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 50, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- Props render ---- */
  function drawProps() {
    /* Sort by depth (worldX descending = far first) */
    const visible = [];
    for (const p of props) {
      const proj = projectProp(p, 0.95);
      if (proj) visible.push({ p, proj });
    }
    visible.sort((a, b) => a.proj.t - b.proj.t);
    for (const { p, proj } of visible) {
      switch (p.kind) {
        case 'tree':  drawTree(p, proj); break;
        case 'house': drawHouse(p, proj); break;
        case 'tower': drawTower(p, proj); break;
        case 'vine':  drawVine(p, proj); break;
        case 'sign':  drawSign(p, proj); break;
      }
    }
  }

  function drawStations() {
    if (!state.stations.length || !window.rcPickups) return;
    /* Render in depth order so closer stations occlude farther ones */
    const visible = [];
    for (const st of state.stations) {
      const proj = projectProp({ worldX: st.worldX, lane: st.lane }, 1.0);
      if (proj) visible.push({ st, t: proj.t });
    }
    visible.sort((a, b) => a.t - b.t);
    for (const { st } of visible) {
      window.rcPickups.renderStation(ctx, st, projectProp);
    }
  }

  /* ---- Spawning + cleanup ---- */
  function maintainWorld() {
    /* Drop stuff far behind */
    for (let i = props.length - 1; i >= 0; i--) {
      if (props[i].worldX < state.distance - 300) props.splice(i, 1);
    }
    /* Spawn ahead */
    while (state.distance + 4000 > nextSpawnAt) {
      spawnProp(nextSpawnAt);
      nextSpawnAt += rand(70, 160);
    }
    /* Spawn km signs every "5 km" of virtual distance */
    while (state.distance > nextSignKm * 80 - 800) {
      const realKm = Math.round(nextSignKm * (state.monument?.real?.long_km || 125) / 100);
      spawnSign(nextSignKm * 80, `${realKm} km`);
      nextSignKm += 8;
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

      /* Boost multiplier expiry */
      if (state.boostUntil && state.elapsed > state.boostUntil) {
        state.boostMul = 1;
        state.boostUntil = 0;
      }

      /* Speed: held → ramps up to 1.0; released → decays to 0.
         Gradient applies a multiplier (climbs slow you, descents speed up). */
      const seg = state.activeSegment;
      const gradMul = seg ? Math.max(0.55, 1 - seg.gradient * 0.05) : 1;
      const targetSpeed = (pressing ? 1 : 0) * gradMul * state.boostMul;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);

      /* Distance + progress */
      state.distance += state.speed * 200 * dt;
      state.progressPct = Math.min(100, state.progressPct + state.speed * (100 / 180) * dt);

      /* Cadence approximation — placeholder for session 2 */
      const targetCadence = pressing ? 92 : 0;
      state.cadence += (targetCadence - state.cadence) * Math.min(1, dt * 4);

      /* Pedal phase — speed-driven */
      state.pedalPhase += dt * (4 + state.speed * 8);

      /* Energy drain — minimal placeholder so it doesn't sit at 100 */
      const drain = pressing ? 1.0 : 0.15;
      state.energy = Math.max(0, state.energy - drain * dt);

      maintainWorld();
      checkSegment();

      /* Pickups + tactical decisions */
      if (state.stations.length) {
        window.rcPickups.collectIfPassed(state, state.stations);
      }
      if (window.rcTactics) {
        window.rcTactics.tick(state, () => {
          /* Optional: show a brief flash when choice applied */
        });
      }

      window.rcUI.setTimer(state.elapsed);
      window.rcUI.setProgressPct(state.progressPct);
      window.rcUI.setCadence(state.cadence);
      window.rcUI.setEnergy(state.energy);
    }

    /* Render order: sky → far → mid → road (with vineyards) → props → stations → peloton → player */
    drawSky();
    drawHillsFar();
    drawHillsMid();
    drawRoad();
    drawProps();
    drawStations();
    drawPeloton();
    drawPlayer();

    requestAnimationFrame(frame);
  }

  /* ---- Boot ---- */
  function attachStartHandler() {
    const overlay = document.getElementById('start-overlay');
    const hint    = document.querySelector('.kbd-hint');
    function start() {
      if (!state.waiting) return;
      state.waiting = false;
      overlay && overlay.classList.add('hide');
      setTimeout(() => hint && hint.classList.add('fade'), 2400);
      window.rcTrack && window.rcTrack('game_start', { monument: monumentId });
    }
    /* First key press OR first tap starts the game */
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') start();
    }, { once: false });
    document.getElementById('tap-zone').addEventListener('touchstart', start, { passive: true });
    document.getElementById('tap-zone').addEventListener('mousedown', start);
    overlay && overlay.addEventListener('click', start);
  }

  async function boot() {
    resize();
    initialSpawn();
    initPeloton();
    nextSpawnAt = 4000;
    requestAnimationFrame(frame);
    attachStartHandler();

    try {
      const m = await window.rcMonument.load(monumentId);
      state.monument = m;
      window.rcUI.setMonumentName(m.name);
      const pts = window.rcMonument.buildElevationPath(m);
      window.rcMonument.renderProfileSvg(window.rcUI.els.profileSvg, pts);

      /* Build pickup feed stations + arm tactical decisions */
      if (window.rcPickups) state.stations = window.rcPickups.makeStations(m);
      if (window.rcTactics) window.rcTactics.setup(m);

      /* Title in start overlay */
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
