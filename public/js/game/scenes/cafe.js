/* Mid-race café stop scene — fired at ~50% race progress.
   Local Moravian café terrace pop-in, three illustrated choices for
   what to grab. Each adds a different time / energy / score effect. */
(function () {
  let overlay = null;
  let armed = false;
  let timer = null;

  const OPTIONS = [
    {
      id:    'espresso',
      label: 'Espresso',
      sub:   '+5 energie · krátký kofein boost',
      img:   '/assets/scenes/stations/drink-espresso.png',
      energy: 5, boost: 1.10, dur: 12, time: 0,  score: 60
    },
    {
      id:    'cappuccino',
      label: 'Cappuccino',
      sub:   '+12 energie · střední boost · -3s čas',
      img:   '/assets/scenes/stations/drink-cappuccino.png',
      energy: 12, boost: 1.08, dur: 18, time: 3, score: 80
    },
    {
      id:    'kolac',
      label: 'Koláček + káva',
      sub:   '+25 energie · hodně kalorií · -8s čas',
      img:   '/assets/scenes/stations/pastry-kolac.png',
      energy: 25, boost: 1.0,  dur: 0,  time: 8, score: 110
    },
    {
      id:    'skip',
      label: 'Přeskočit — držím tempo',
      sub:   'Žádný stop, žádný bonus',
      img:   null,
      energy: 0, boost: 1.0, dur: 0, time: 0, score: 0
    }
  ];

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-cafe';
    overlay.className = 'scene-overlay scene-cafe';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/stations/cafe-pavlov.png')"></div>
      <div class="prerace-shell">
        <div class="step-pill">~50 % trasy · Pavlov</div>
        <h2 class="title-display">U vinice je kavárna</h2>
        <p class="lead">Cyklisté sedí, někdo se zakousne do koláčku. Stavíš se?</p>
        <div class="food-cards" id="cafe-cards">
          ${OPTIONS.map(o => `
            <button type="button" class="food-card${o.id === 'skip' ? ' food-skip' : ''}" data-id="${o.id}">
              ${o.img ? `<div class="food-card-img" style="background-image:url('${o.img}')"></div>` : `<div class="food-card-img food-card-skip" aria-hidden="true">⌁</div>`}
              <div class="food-card-label">${o.label}</div>
              <div class="food-card-sub">${o.sub}</div>
            </button>
          `).join('')}
        </div>
        <div class="prerace-foot">5s na výběr · default Přeskočit</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.food-card').forEach(btn => {
      btn.addEventListener('click', () => choose(btn.dataset.id));
    });
    return overlay;
  }

  function choose(id) {
    const opt = OPTIONS.find(o => o.id === id);
    if (!opt || !window.rcEngine) return;
    const state = window.rcEngine.getState();
    if (timer) { clearTimeout(timer); timer = null; }
    /* Apply effects */
    state.energy = Math.max(0, Math.min(100, state.energy + opt.energy));
    if (opt.boost > 1 && opt.dur > 0) {
      state.boostMul = Math.max(state.boostMul || 1, opt.boost);
      state.boostUntil = state.elapsed + opt.dur;
    }
    /* Time penalty: nudge elapsed forward (player loses N seconds) */
    if (opt.time > 0) state.elapsed += opt.time;
    /* Score */
    state.score = (state.score || 0) + opt.score;
    /* Resume race */
    state.paused = false;
    overlay && overlay.classList.remove('show');
    window.rcTrack && window.rcTrack('cafe_choice', { id, energy: opt.energy, time: opt.time });
  }

  function tick(state) {
    if (armed || !state || state.progressPct < 50 || state.paused || state.finished) return;
    armed = true;
    /* Pause race + open overlay */
    state.paused = true;
    build();
    overlay.classList.add('show');
    /* 5-second auto-default to "skip" */
    timer = setTimeout(() => choose('skip'), 5000);
  }

  function reset() {
    armed = false;
    if (timer) { clearTimeout(timer); timer = null; }
    overlay && overlay.classList.remove('show');
  }

  window.rcCafe = { tick, reset };
})();
