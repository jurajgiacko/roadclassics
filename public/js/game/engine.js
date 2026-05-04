/* Game engine skeleton — Pálava MVP fáza 1.
   Tu zatiaľ NIE JE plná gameplay logika (cadence/energy/pickupy/tactics).
   Co tu už JE:
     - canvas + DPR-safe resize
     - requestAnimationFrame loop s delta time
     - parallax pozadie (placeholder vrstvy)
     - statický cyklista
     - HUD update z monument profilu (timer + position marker)
   Pripravené pre session 2: doplniť player.js, pickups.js, tactics.js.
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

  /* ---- World state (skeleton) ---- */
  const state = {
    monument: null,
    started: false,
    elapsed: 0,
    progressPct: 0,
    parallax: 0,
    /* placeholders pre session 2 */
    cadence: 0,
    energy: 100,
    speed: 0
  };

  /* ---- Render layers ---- */
  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#1a2238');
    g.addColorStop(0.55, '#5b4a63');
    g.addColorStop(1, '#cfa97a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function drawHillsFar(offset) {
    ctx.fillStyle = 'rgba(69, 5, 33, 0.55)';
    const baseY = viewH * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -100; x <= viewW + 100; x += 40) {
      const px = x;
      const py = baseY + Math.sin((x + offset * 0.15) * 0.012) * 22;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawHillsMid(offset) {
    ctx.fillStyle = 'rgba(44, 3, 20, 0.85)';
    const baseY = viewH * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -100; x <= viewW + 100; x += 30) {
      const py = baseY + Math.sin((x + offset * 0.4) * 0.018) * 28
                       + Math.cos((x + offset * 0.2) * 0.04) * 8;
      ctx.lineTo(x, py);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoad(offset) {
    /* dirt + center line */
    ctx.fillStyle = '#3b2a20';
    ctx.fillRect(0, viewH * 0.78, viewW, viewH * 0.22);

    ctx.fillStyle = '#1f160f';
    ctx.fillRect(0, viewH * 0.78, viewW, 4);

    /* dashed center line, scrolling */
    ctx.fillStyle = 'rgba(228, 203, 157, 0.7)';
    const dashW = 28, gap = 22, total = dashW + gap;
    const start = -((offset * 1.5) % total);
    for (let x = start; x < viewW; x += total) {
      ctx.fillRect(x, viewH * 0.88 - 2, dashW, 4);
    }
  }

  function drawCyclist() {
    /* placeholder cyclist — coloured rects, replaced in session 2 by sprite */
    const cx = viewW * 0.28;
    const cy = viewH * 0.82;

    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* wheels */
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx - 22, cy + 18, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 22, cy + 18, 14, 0, Math.PI * 2); ctx.stroke();

    /* frame */
    ctx.strokeStyle = '#e4cb9d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 18);
    ctx.lineTo(cx + 4,  cy);
    ctx.lineTo(cx + 22, cy + 18);
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx - 4, cy - 18);
    ctx.stroke();

    /* rider */
    ctx.fillStyle = '#e53747';
    ctx.fillRect(cx - 6, cy - 26, 14, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx, cy - 30, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    drawSky();
    drawHillsFar(state.parallax);
    drawHillsMid(state.parallax);
    drawRoad(state.parallax);
    drawCyclist();
  }

  /* ---- Main loop ---- */
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (state.started) {
      state.elapsed += dt;

      /* Skeleton: progress driven directly by hold-input. Replaced in session 2. */
      const pressing = window.rcInput && window.rcInput.isPressing();
      const targetSpeed = pressing ? 1 : 0;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);
      state.parallax += state.speed * 200 * dt;
      state.progressPct = Math.min(100, state.progressPct + state.speed * (100 / 180) * dt);

      /* Cadence placeholder so HUD reacts visibly */
      const targetCadence = pressing ? 92 : 0;
      state.cadence += (targetCadence - state.cadence) * Math.min(1, dt * 4);

      window.rcUI.setTimer(state.elapsed);
      window.rcUI.setProgressPct(state.progressPct);
      window.rcUI.setCadence(state.cadence);
      window.rcUI.setEnergy(state.energy);
    }

    render();
    requestAnimationFrame(frame);
  }

  /* ---- Boot ---- */
  async function boot() {
    resize();
    requestAnimationFrame(frame);

    try {
      const m = await window.rcMonument.load(monumentId);
      state.monument = m;
      window.rcUI.setMonumentName(m.name);
      const pts = window.rcMonument.buildElevationPath(m);
      window.rcMonument.renderProfileSvg(window.rcUI.els.profileSvg, pts);
      state.started = true;

      window.rcTrack && window.rcTrack('game_start', { monument: m.id });
    } catch (err) {
      console.error('Monument load failed:', err);
      window.rcUI.setMonumentName('Chyba načítania');
    }
  }

  boot();
})();
