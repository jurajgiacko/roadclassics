/* Game engine — Pálava MVP (iterácia 2: top-down pseudo-isometric arcade).
   Pohľad zhora/zo zadu (3/4 isometric). Cesta scrolluje smerom k hráčovi
   (od hora dole), hráč je fixovaný na ~72 % výšky obrazovky. Lateral
   pohyb cez tilt (mobile) / arrow keys (desktop) / tap-zóny ako fallback.

   Zachované moduly:
     - input.js — laneInput() (-1..+1) + isPressing() (boost)
     - ui.js — HUD updates
     - monument.js — segments + elevation profile (gradient ovplyvňuje speed/drain)
     - pickups.js — render station prepísaný pre top-down stranu cesty
     - tactics.js — bez zmeny
     - finish.js — bez zmeny (otvorí sa pri progress 100 %)
*/
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const monumentId = params.get('monument') || 'palava';

  let dpr = 1, viewW = 0, viewH = 0;
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

  /* ---- Camera ---- */
  const PLAYER_FRAC_Y = 0.72;
  const playerScreenY = () => viewH * PLAYER_FRAC_Y;
  const centerX = () => viewW * 0.5;

  /* ---- Road geometry ---- */
  /* Road width is roughly 38% of viewport on phone, capped on widescreen. */
  function roadHalfWidth() { return Math.min(viewW * 0.19, 220); }
  /* World units: 1 worldY ≈ 1 logical pixel of forward travel.
     Distance 8000 = 100 % of trate (same scale as before). */
  function laneToWorldX(laneFrac) {
    return laneFrac * (roadHalfWidth() - 28); // keep cyclist inside lanes
  }
  function worldYToScreenY(wy) { return playerScreenY() - (wy - state.distance); }
  function worldXToScreenX(wx) { return centerX() + wx; }

  /* ---- World state ---- */
  const state = {
    monument: null,
    waiting: true, paused: false, finished: false,
    elapsed: 0,
    distance: 0,
    progressPct: 0,
    laneX: 0,            // smooth lateral position in world-units (-roadHalf .. +roadHalf)
    speed: 0,
    pedalPhase: 0,
    cadence: 0,
    energy: 100,
    activeSegment: null,
    boostMul: 1,
    boostUntil: 0,
    stations: [],
    styleLog: [],
    score: 0,
    pickupsCollected: 0
  };

  /* ---- Palette (carry forward from wine illustration style) ---- */
  const PAL = {
    skyTop:    '#170410',
    skyBot:    '#3a0c1f',
    grass:     '#2a0716',
    grassDark: '#1c0510',
    asphalt:   '#0e0309',
    asphaltMid:'#1a0410',
    laneLine:  'rgba(228,203,157,0.85)',
    edgeLine:  'rgba(228,203,157,0.55)',
    cream:     '#f0d4a0',
    creamSoft: '#e4cb9d',
    wineBright:'#a52447',
    winePink:  '#c44470',
    leafDark:  '#3a0c1d',
    leafMid:   '#5a1530',
    leafLight: '#8a2a4d',
    woodPole:  '#5a3526',
    roofTile:  '#7a1a30',
    barrelOak: '#4a2010'
  };

  /* ---- Elevation (gradient affects speed + drain, no longer drives Y render) ---- */
  function elevationGradientAt(wy) {
    if (!state.monument) return 0;
    const pct = wy / 80;
    const seg = state.monument.segments.find(s => pct >= s.from_pct && pct < s.to_pct);
    return seg ? seg.gradient : 0;
  }

  /* ---- Props (along the side of the road, sorted by worldY) ---- */
  const props = [];
  let nextSpawnAt = 0;
  let nextSignWy = 600;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnProp(worldY) {
    const kind = pick([
      'tree','tree','tree',
      'vinerow','vinerow','vinerow',
      'house',
      'tower',
      'barrel',
      'rsign'
    ]);
    const side = Math.random() < 0.5 ? -1 : 1;
    /* Lateral offset: just outside the road, with some variance */
    const offset = side * (roadHalfWidth() + 30 + rand(0, 100));
    const detail = {
      kind,
      worldY,
      worldX: offset,
      size: rand(0.85, 1.15),
      colorVariant: Math.floor(rand(0, 3))
    };
    if (kind === 'vinerow') {
      detail.rowLen  = rand(40, 80);
      detail.rowsCnt = Math.floor(rand(2, 4));
    }
    props.push(detail);
  }

  function initialSpawn() {
    for (let y = 200; y < 4500; y += rand(40, 90)) spawnProp(y);
    nextSpawnAt = 4500;
  }

  /* ---- Peloton (other riders in same race, in different lanes ahead) ---- */
  const peloton = [];
  function initPeloton() {
    const colors = ['#a52447', '#7c1a32', '#c44470', '#5a1530', '#e4cb9d'];
    for (let i = 0; i < 5; i++) {
      peloton.push({
        relativeAhead: 60 + i * 40 + rand(-15, 15),
        laneX:         rand(-0.7, 0.7),
        color:         colors[i % colors.length],
        bobPhase:      rand(0, Math.PI * 2)
      });
    }
  }

  /* ---- BACKGROUND (full-bleed landscape illustration with cross-fade) ----
     Matches the @road__classics × @themartinpaseka diorama style. The
     current zone's landscape PNG covers the entire canvas; when zones
     change, we crossfade between previous and current art over ~1.2 s. */
  let bgFromArt = 'valtice-morning';
  let bgToArt   = 'valtice-morning';
  let bgFadeT   = 1;            // 0 = fully showing fromArt, 1 = fully showing toArt
  let bgLastZoneArt = 'valtice-morning';

  function drawBackground() {
    /* Step 1: keep crossfade target aligned with the current landmark zone */
    const desired = (window.rcLandmarks && window.rcLandmarks.activeArt)
                  ? window.rcLandmarks.activeArt(state.progressPct || 0)
                  : 'valtice-morning';
    if (desired !== bgLastZoneArt) {
      bgFromArt = bgLastZoneArt;
      bgToArt   = desired;
      bgFadeT   = 0;
      bgLastZoneArt = desired;
    }
    bgFadeT = Math.min(1, bgFadeT + 0.012);

    /* Step 2: draw the previous + current art as cover-fit layers */
    if (window.rcSprites && window.rcSprites.drawCover) {
      if (bgFadeT < 1 && bgFromArt) {
        ctx.save();
        ctx.globalAlpha = 1 - bgFadeT;
        window.rcSprites.drawCover(ctx, bgFromArt, 0, 0, viewW, viewH);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = bgFadeT;
      window.rcSprites.drawCover(ctx, bgToArt, 0, 0, viewW, viewH);
      ctx.restore();
    } else {
      /* Fallback if sprites haven't loaded */
      ctx.fillStyle = PAL.skyBot;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    /* Step 3: subtle dark wash for legibility */
    const wash = ctx.createLinearGradient(0, 0, 0, viewH);
    wash.addColorStop(0,   'rgba(8,2,8,0.35)');
    wash.addColorStop(0.5, 'rgba(8,2,8,0.18)');
    wash.addColorStop(1,   'rgba(8,2,8,0.55)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  /* ---- ROAD (semi-transparent overlay so landscape shows through) ---- */
  function drawRoad() {
    const halfW = roadHalfWidth();
    const cx = centerX();

    /* Asphalt strip — translucent so the landscape behind shows softly */
    ctx.fillStyle = 'rgba(14, 3, 9, 0.62)';
    ctx.fillRect(cx - halfW, 0, halfW * 2, viewH);

    /* Subtle inner highlight */
    ctx.fillStyle = 'rgba(26, 4, 16, 0.45)';
    ctx.fillRect(cx - halfW + 4, 0, halfW * 2 - 8, viewH);

    /* Edge lines (cream, brighter so they stand out on landscape) */
    ctx.strokeStyle = 'rgba(240, 212, 160, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 1, 0); ctx.lineTo(cx - halfW + 1, viewH);
    ctx.moveTo(cx + halfW - 1, 0); ctx.lineTo(cx + halfW - 1, viewH);
    ctx.stroke();

    /* Lane divider dashes scrolling toward the player */
    ctx.strokeStyle = 'rgba(240, 212, 160, 0.85)';
    ctx.lineWidth = 2.5;
    const dashLen = 24, gapLen = 22;
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = -((state.distance) % (dashLen + gapLen));
    const laneSpacing = (halfW * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(cx - halfW + laneSpacing, 0); ctx.lineTo(cx - halfW + laneSpacing, viewH);
    ctx.moveTo(cx - halfW + 2 * laneSpacing, 0); ctx.lineTo(cx - halfW + 2 * laneSpacing, viewH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---- PROPS (drawn from far → near, i.e., higher screen Y last) ---- */
  function drawTree(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -50 || sx > viewW + 50 || sy < -40 || sy > viewH + 40) return;
    const r = 14 * p.size;
    /* canopy 3-layer round cluster (top-down view) */
    ctx.fillStyle = PAL.leafDark;
    ctx.beginPath(); ctx.arc(sx,         sy + 2, r,          0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.arc(sx + r * 0.2, sy - 1, r * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.leafLight;
    ctx.beginPath(); ctx.arc(sx + r * 0.4, sy - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
    /* tiny shadow underneath for depth */
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.5, r * 0.6, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawHouse(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -60 || sx > viewW + 60 || sy < -50 || sy > viewH + 50) return;
    const w = 36 * p.size;
    const h = 24 * p.size;
    /* Pseudo-isometric: roof + visible front wall (tiny strip below roof) */
    ctx.fillStyle = PAL.roofTile;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy);
    ctx.lineTo(sx,         sy - h * 0.6);
    ctx.lineTo(sx + w / 2, sy);
    ctx.lineTo(sx,         sy + h * 0.6);
    ctx.closePath();
    ctx.fill();
    /* Front wall sliver */
    ctx.fillStyle = PAL.cream;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy);
    ctx.lineTo(sx + w / 2, sy);
    ctx.lineTo(sx,         sy + h * 0.55);
    ctx.closePath();
    ctx.fill();
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + h * 0.7, w * 0.5, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTower(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -60 || sx > viewW + 60 || sy < -60 || sy > viewH + 60) return;
    const r = 10 * p.size;
    /* Base + tall onion dome — drawn small from above */
    ctx.fillStyle = PAL.cream;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.roofTile;
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.barrelOak;
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.18, 0, Math.PI * 2); ctx.fill();
    /* spike shadow ring */
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, r * 1.05, 0, Math.PI * 2); ctx.stroke();
  }

  function drawVineRow(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -60 || sx > viewW + 60 || sy < -50 || sy > viewH + 50) return;
    const len  = p.rowLen || 60;
    const rows = p.rowsCnt || 3;
    const dirSign = p.worldX < 0 ? 1 : -1; // rows extend away from road
    /* Each row = small green ellipse with a wood T-stake at one end */
    for (let i = 0; i < rows; i++) {
      const dy = i * 6 * p.size - rows * 3;
      const x0 = sx;
      const x1 = sx + dirSign * len * p.size;
      /* foliage row */
      ctx.fillStyle = PAL.leafDark;
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, sy + dy, Math.abs(x1 - x0) / 2, 4 * p.size, 0, 0, Math.PI * 2);
      ctx.fill();
      /* mid highlight */
      ctx.fillStyle = PAL.leafMid;
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, sy + dy - 1, Math.abs(x1 - x0) / 2 * 0.6, 2.5 * p.size, 0, 0, Math.PI * 2);
      ctx.fill();
      /* T-stake at outer end with cream tip */
      ctx.fillStyle = PAL.woodPole;
      ctx.fillRect(x1 - 1, sy + dy - 4, 2, 8);
      ctx.fillStyle = PAL.cream;
      ctx.fillRect(x1 - 2.5, sy + dy - 4, 5, 1.5);
    }
  }

  function drawBarrel(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -40 || sx > viewW + 40 || sy < -40 || sy > viewH + 40) return;
    const r = 9 * p.size;
    /* Top circle (oak) with band */
    ctx.fillStyle = PAL.barrelOak;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.skyTop;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(240, 212, 160, 0.18)';
    ctx.fillRect(sx - 1, sy - r + 2, 2, 2 * r - 4);
  }

  function drawRSign(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -40 || sx > viewW + 40 || sy < -40 || sy > viewH + 40) return;
    const w = 22;
    /* Plate with R */
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(sx - w / 2, sy - w / 2, w, w);
    ctx.strokeStyle = PAL.skyTop;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(sx, sy, w * 0.32, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PAL.skyTop;
    ctx.font = '900 13px Fraunces, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', sx, sy + 1);
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy + w * 0.55, w * 0.4, w * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawKmSign(p) {
    const sx = worldXToScreenX(p.worldX);
    const sy = worldYToScreenY(p.worldY);
    if (sx < -50 || sx > viewW + 50 || sy < -40 || sy > viewH + 40) return;
    /* Compact cream plate with wine border + km number */
    const w = 28, h = 16;
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    ctx.strokeStyle = PAL.wineBright;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
    ctx.fillStyle = PAL.skyTop;
    ctx.font = '700 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label || '', sx, sy);
  }

  function drawProps() {
    /* Sort by worldY ascending — far first (top of screen), near last (bottom) */
    const sorted = [...props].sort((a, b) => a.worldY - b.worldY);
    for (const p of sorted) {
      switch (p.kind) {
        case 'tree':    drawTree(p); break;
        case 'house':   drawHouse(p); break;
        case 'tower':   drawTower(p); break;
        case 'vinerow': drawVineRow(p); break;
        case 'barrel':  drawBarrel(p); break;
        case 'rsign':   drawRSign(p); break;
        case 'kmsign':  drawKmSign(p); break;
      }
    }
  }

  /* ---- CYCLIST SPRITE — illustrated PNG via rcSprites with procedural fallback ---- */
  function drawCyclistSprite(sx, sy, opts = {}) {
    const sprId = opts.spriteId || 'cyclist-player-topdown';
    const tilt  = opts.tilt || 0;
    const baseHeight = opts.height || 84;
    if (!window.rcSprites || !window.rcSprites.get) {
      drawCyclistTopDown(sx, sy, opts);
      return;
    }
    const img = window.rcSprites.get(sprId);
    if (!img || !img.width || img.width < 4) {
      /* sprite not yet loaded — fall back to procedural */
      drawCyclistTopDown(sx, sy, opts);
      return;
    }
    ctx.save();
    ctx.translate(sx, sy);
    if (tilt) ctx.rotate(tilt * 0.18);
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, baseHeight * 0.42, baseHeight * 0.32, baseHeight * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    const w = baseHeight * (img.width / img.height);
    ctx.drawImage(img, -w / 2, -baseHeight / 2, w, baseHeight);
    /* boost halo if anaerobic */
    if (opts.anaerobic) {
      ctx.fillStyle = 'rgba(229, 55, 71, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, baseHeight * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- CYCLIST SPRITE (procedural fallback for when assets aren't loaded) ---- */
  function drawCyclistTopDown(sx, sy, opts = {}) {
    const scale = opts.scale || 1;
    const phase = opts.phase || 0;
    const colorJersey = opts.color || '#e53747';
    const colorAccent = opts.accent || '#fff';
    const isPlayer = opts.isPlayer || false;
    const tilt = opts.tilt || 0; // -1..+1 lean for steering

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.rotate(tilt * 0.18); // small lean when steering

    /* Shadow underneath */
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Rear wheel — viewed from above, narrow ellipse */
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, 14, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
    /* Wheel highlight */
    ctx.fillStyle = 'rgba(220,220,220,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 14, 1.4, 5, 0, 0, Math.PI * 2); ctx.fill();

    /* Front wheel */
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -16, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,220,220,0.4)';
    ctx.beginPath(); ctx.ellipse(0, -16, 1.4, 5, 0, 0, Math.PI * 2); ctx.fill();

    /* Frame — vertical line connecting wheels */
    ctx.strokeStyle = isPlayer ? '#e4cb9d' : '#bbbbbb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 8);
    ctx.stroke();

    /* Pedaling chainring — small dot at center */
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();

    /* Cranks — animated rotation seen from above */
    const crankR = 4;
    const cax = Math.cos(phase) * crankR;
    const cay = Math.sin(phase) * crankR;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-cax, cay); ctx.lineTo(cax, -cay);
    ctx.stroke();

    /* Body silhouette — torso + jersey */
    ctx.fillStyle = colorJersey;
    ctx.beginPath();
    ctx.ellipse(0, -2, 6.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Accent stripe across shoulders */
    ctx.fillStyle = colorAccent;
    ctx.fillRect(-6.5, -7, 13, 1.6);
    /* Sponsor patch (small dot) */
    ctx.fillStyle = colorAccent;
    ctx.beginPath();
    ctx.arc(0, 2, 1.4, 0, Math.PI * 2);
    ctx.fill();

    /* Arms reaching forward to bars */
    ctx.strokeStyle = colorJersey;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.5, -8); ctx.lineTo(-2.5, -14);
    ctx.moveTo( 3.5, -8); ctx.lineTo( 2.5, -14);
    ctx.stroke();

    /* Bars (wide horizontal line near front wheel) */
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, -14); ctx.lineTo(7, -14);
    ctx.stroke();

    /* Helmet (top of head, aero teardrop pointing forward) */
    ctx.fillStyle = isPlayer ? '#fafafa' : '#444';
    ctx.beginPath();
    ctx.ellipse(0, -10, 3.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Helmet stripe */
    ctx.fillStyle = colorJersey;
    ctx.fillRect(-2.6, -11, 5.2, 1);
    /* Helmet vent slits (forward) */
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 1.4, -13);
      ctx.lineTo(i * 1.4, -10.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---- PELOTON (sprite-based) ---- */
  const PELOTON_SPRITES = ['peloton-rider-1', 'peloton-rider-2', 'peloton-rider-3', 'peloton-rider-4'];
  function drawPeloton(dt) {
    peloton.forEach((c, i) => {
      const target = state.speed * 1.05;
      const drift = (1 - target) * 14 * dt;
      c.relativeAhead = Math.max(-40, Math.min(900, c.relativeAhead + drift));
      c.bobPhase += dt * (4 + state.speed * 6);

      const wy = state.distance + c.relativeAhead;
      const wx = laneToWorldX(c.laneX);
      const sx = worldXToScreenX(wx);
      const sy = worldYToScreenY(wy);
      if (sy < -50 || sy > viewH + 50) return;
      const h = Math.max(56, Math.min(100, viewH * 0.11));
      drawCyclistSprite(sx, sy, {
        spriteId: PELOTON_SPRITES[i % PELOTON_SPRITES.length],
        height: h,
        phase: c.bobPhase,
        color: c.color
      });
    });
  }

  /* ---- PLAYER (sprite-based) ---- */
  function drawPlayer() {
    const sx = worldXToScreenX(state.laneX);
    const sy = playerScreenY();
    const tilt = (window.rcInput && window.rcInput.laneInput()) || 0;
    const h = Math.max(80, Math.min(140, viewH * 0.16));
    drawCyclistSprite(sx, sy, {
      spriteId: 'cyclist-player-topdown',
      height: h,
      tilt,
      isPlayer: true,
      anaerobic: state.boostMul > 1.05 || state.cadence > 110
    });
  }

  /* ---- STATIONS — handled in pickups.js, given a screen position ---- */
  function drawStations() {
    if (!state.stations.length || !window.rcPickups) return;
    /* Stations are at world Y = pct * 80, alternate sides of road */
    const sorted = [...state.stations].sort((a, b) => a.worldY - b.worldY);
    for (const st of sorted) {
      const sx = worldXToScreenX(st.worldX);
      const sy = worldYToScreenY(st.worldY);
      if (sy < -50 || sy > viewH + 50) continue;
      window.rcPickups.renderStation(ctx, st, sx, sy);
    }
  }

  /* ---- WORLD MAINTENANCE ---- */
  function maintainWorld() {
    /* Despawn behind player */
    for (let i = props.length - 1; i >= 0; i--) {
      if (props[i].worldY < state.distance - 200) props.splice(i, 1);
    }
    /* Spawn ahead */
    while (state.distance + viewH * 1.5 > nextSpawnAt) {
      spawnProp(nextSpawnAt);
      nextSpawnAt += rand(40, 90);
    }
    /* Km milestones */
    while (state.distance > nextSignWy - viewH) {
      const realKm = Math.round(nextSignWy / 80 * (state.monument?.real?.long_km || 125) / 100);
      props.push({
        kind: 'kmsign',
        worldY: nextSignWy,
        worldX: -(roadHalfWidth() + 28), /* sit on left shoulder */
        size: 1,
        label: `${realKm} km`
      });
      nextSignWy += 8 * 80;
    }
  }

  /* ---- SEGMENT TRIGGER ---- */
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

  /* ---- FRAME ---- */
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!state.waiting && !state.paused && !state.finished) {
      state.elapsed += dt;
      const pressing = window.rcInput && window.rcInput.isPressing();
      const laneIn   = (window.rcInput && window.rcInput.laneInput()) || 0;

      /* Lateral movement: laneIn is target lane fraction (-1..+1), smooth lerp */
      const targetWX = laneToWorldX(Math.max(-1, Math.min(1, laneIn)));
      state.laneX += (targetWX - state.laneX) * Math.min(1, dt * 6);

      /* Boost expiry */
      if (state.boostUntil && state.elapsed > state.boostUntil) {
        state.boostMul = 1; state.boostUntil = 0;
      }

      /* Auto baseline cadence + boost when pressing */
      const grad = elevationGradientAt(state.distance);
      const gradMul = Math.max(0.55, 1 - grad * 0.05);
      const baseSpeed = 0.7;            // automatic pedaling
      const boost = pressing ? 1.4 : 1;  // boost while held
      const targetSpeed = baseSpeed * gradMul * state.boostMul * boost;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);

      /* Forward distance + progress */
      /* Race duration target ~90s at speed=1.0; baseline 0.7 ⇒ ~130s,
         frequent boosts pull it down to ~95-100 s actual playtime. */
      state.distance += state.speed * 320 * dt;
      state.progressPct = Math.min(100, state.progressPct + state.speed * (100 / 90) * dt);

      /* Cadence + pedal animation */
      const targetCadence = pressing ? 110 : 90;
      state.cadence += (targetCadence - state.cadence) * Math.min(1, dt * 4);
      state.pedalPhase += dt * (5 + state.speed * 9);

      /* Energy drain — boost costs more */
      const drain = pressing ? 1.4 : 0.5;
      state.energy = Math.max(0, state.energy - drain * dt);
      /* If energy hits 0, force speed cap and visual */
      if (state.energy <= 0) {
        state.boostMul = 1;
        /* don't kill speed entirely — just no boost */
      }

      maintainWorld();
      checkSegment();
      if (window.rcLandmarks) window.rcLandmarks.tick(state);
      if (state.stations.length) window.rcPickups.collectIfPassed(state, state.stations);
      if (window.rcTactics) window.rcTactics.tick(state, () => {});

      /* HUD live */
      const SPEED_KMH_SCALE = 38;
      const totalKm = state.monument?.real?.long_km || 125;
      const kmh = state.speed * SPEED_KMH_SCALE;
      const km  = state.progressPct * totalKm / 100;

      window.rcUI.setTimer(state.elapsed);
      window.rcUI.setProgressPct(state.progressPct);
      window.rcUI.setCadence(state.cadence);
      window.rcUI.setEnergy(state.energy);
      window.rcUI.setSpeed(kmh);
      window.rcUI.setDistance(km, totalKm);
      window.rcUI.setScore(state.score);

      if (state.progressPct >= 100 && !state.finished && window.rcFinish) {
        window.rcFinish.open(state);
      }
    }

    /* Render order: background → road → props (left/right) → stations → peloton → player */
    drawBackground();
    drawRoad();
    drawProps();
    drawStations();
    drawPeloton(state.waiting ? 0 : Math.min(0.05, dt));
    drawPlayer();

    requestAnimationFrame(frame);
  }

  /* ---- PUBLIC API for scene-machine driven flow ----
     Race scene calls rcEngine.boot() (idempotent setup) and rcEngine.startRace()
     once the player has progressed through pre-race stages. */
  let bootDone = false;
  let started  = false;

  async function boot(opts = {}) {
    if (bootDone) return;
    bootDone = true;
    resize();
    initialSpawn();
    initPeloton();
    requestAnimationFrame(frame);

    /* Preload race-specific sprites in the background. Renders use
       fallbacks until images arrive. */
    if (window.rcSprites && window.rcSprites.preload) {
      window.rcSprites.preload([
        'cyclist-player-topdown',
        'peloton-rider-1', 'peloton-rider-2', 'peloton-rider-3', 'peloton-rider-4',
        'station-gel', 'station-bar', 'station-drink',
        'valtice-morning', 'lednice-vineyards', 'mikulov-overlook',
        'devin-climb', 'novomlynske-reservoirs', 'tesarova-past-pass', 'reistna-kolonada'
      ]);
    }
    if (window.rcLandmarks) window.rcLandmarks.reset();

    try {
      const m = await window.rcMonument.load(opts.monumentId || monumentId);
      state.monument = m;
      window.rcUI.setMonumentName(m.name);
      const pts = window.rcMonument.buildElevationPath(m);
      window.rcMonument.renderProfileSvg(window.rcUI.els.profileSvg, pts);

      if (window.rcPickups) {
        state.stations = window.rcPickups.makeStations(m).map((st, i) => ({
          ...st,
          worldY: st.pct * 80,
          worldX: ((i % 2 === 0) ? 1 : -1) * (roadHalfWidth() + 30)
        }));
      }
      if (window.rcTactics) window.rcTactics.setup(m);
      if (window.rcFinish)  window.rcFinish.attach(state);
      window.rcUI.setDistance(0, m.real?.long_km || 125);
    } catch (err) {
      console.error('Monument load failed:', err);
      window.rcUI.setMonumentName('Chyba načítania');
    }
  }

  function startRace() {
    if (started || !state.waiting) return;
    started = true;
    state.waiting = false;
    /* Apply pre-race bonuses from journey if available */
    const j = window.rcScenes && window.rcScenes.journey && window.rcScenes.journey();
    if (j) {
      state.energy = Math.min(100, state.energy + (j.prepBonusEnergy || 0));
      if (j.tireBonus)    state.boostMul *= (1 + j.tireBonus / 100);
      if (j.packingBonus) state.score += j.packingBonus;
    }
    setTimeout(() => {
      const hint = document.querySelector('.kbd-hint');
      hint && hint.classList.add('fade');
    }, 2400);
    /* Request tilt permission on first user gesture (the click that started this race scene) */
    if (window.rcInput && window.rcInput.requestTiltPermission) {
      window.rcInput.requestTiltPermission().then((granted) => {
        if (granted && window.rcInput.recalibrateTilt) {
          setTimeout(() => window.rcInput.recalibrateTilt(), 350);
        }
      });
    }
    window.rcTrack && window.rcTrack('game_start', { monument: monumentId });
  }

  function getState() { return state; }

  window.rcEngine = { boot, startRace, getState, monumentId };

  /* Auto-boot for backwards compatibility: if no scene machine drives the
     game (e.g. someone opens game.html directly without scenes), still
     work as before — the start-overlay's click triggers startRace via
     a small fallback wiring. */
  if (!window.rcScenes) {
    boot();
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        startRace();
        overlay.classList.add('hide');
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') startRace();
    });
  }
})();
