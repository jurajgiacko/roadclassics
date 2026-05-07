/* Bidon scene — fill the water bottle with Isocarb to a target line.
   Hold to fill, release. Sweet spot ≈ 0.5–0.6 L (don't overflow). */
(function () {
  let overlay = null;
  let level = 0;       // 0..1.0 (=full bottle)
  const TARGET_MIN = 0.55;
  const TARGET_MAX = 0.7;
  let timer = null;
  let pouring = false;
  let resolved = false;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-bidon';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/garage-bike-check.png'); opacity:.18"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 3 / 5 · Bidon</div>
        <h2 class="title-display">Namiešaj Isocarb</h2>
        <p class="lead">Drž tlačidlo na liatie. <strong>Cieľ: po značku</strong> v hornej tretine. Pretečie = pomalšia výmena.</p>
        <div class="bidon-stage">
          <div class="bidon-graphic" id="bidon-graphic">
            <img class="bidon-img" src="/assets/scenes/stations/item-bidon.png" alt="" />
            <div class="bidon-fill" id="bidon-fill"></div>
            <div class="bidon-target"></div>
          </div>
          <div class="bidon-readout"><span id="bidon-val">0.0</span> <small>L</small></div>
        </div>
        <button type="button" class="btn-pump" id="bidon-btn">Drž a lej</button>
        <div class="prerace-foot" id="bidon-foot">Cieľ je 0.55–0.70 L. Nepretekaj.</div>
      </div>
    `;
    document.body.appendChild(overlay);
    const btn = overlay.querySelector('#bidon-btn');
    const start = (e) => { e.preventDefault?.(); pouring = true; };
    const end   = (e) => { e.preventDefault?.(); if (pouring) { pouring = false; resolve(); } };
    btn.addEventListener('mousedown',  start);
    btn.addEventListener('mouseup',    end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   end,   { passive: false });
    btn.addEventListener('touchcancel',end,   { passive: false });
    return overlay;
  }

  function tick() {
    timer = setInterval(() => {
      if (!pouring || resolved) return;
      level += 0.018;
      if (level > 1.0) level = 1.0;
      const fill = overlay.querySelector('#bidon-fill');
      const val  = overlay.querySelector('#bidon-val');
      fill.style.height = `${level * 100}%`;
      val.textContent = (level * 0.75).toFixed(2);
      if (level >= 1.0) resolve();
    }, 60);
  }

  function resolve() {
    if (resolved) return;
    resolved = true;
    clearInterval(timer); timer = null;
    const j = window.rcScenes.journey();
    j.bidonLevel = +(level * 0.75).toFixed(2);
    let outcome, bonus;
    if (level >= TARGET_MIN && level <= TARGET_MAX) {
      outcome = `Perfektne ${(level * 0.75).toFixed(2)} L. +20 hydrating bonus.`;
      bonus = 20;
    } else if (level > TARGET_MAX && level < 0.92) {
      outcome = `Pretečené (${(level * 0.75).toFixed(2)} L). Pomalšie zrýchlenie. +5.`;
      bonus = 5;
    } else if (level >= 1.0) {
      outcome = `Pretieklo cez okraj — máš mokrý dres. 0 bonus.`;
      bonus = 0;
    } else if (level >= 0.3) {
      outcome = `Trochu málo (${(level * 0.75).toFixed(2)} L). +10.`;
      bonus = 10;
    } else {
      outcome = `Skoro nič v bidone. 0 bonus.`;
      bonus = 0;
    }
    j.bidonBonus = bonus;
    j.prepBonusEnergy = (j.prepBonusEnergy || 0) + Math.round(bonus / 4);
    overlay.querySelector('#bidon-foot').innerHTML = outcome;
    window.rcTrack && window.rcTrack('prep_choice', { stage: 'bidon', level, bonus });
    setTimeout(() => window.rcScenes.go('packing'), 1500);
  }

  async function enter() {
    build();
    level = 0; pouring = false; resolved = false;
    overlay.querySelector('#bidon-fill').style.height = '0';
    overlay.querySelector('#bidon-val').textContent = '0.00';
    overlay.querySelector('#bidon-foot').textContent = 'Cieľ je 0.55–0.70 L. Nepretekaj.';
    overlay.classList.add('show');
    tick();
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
    if (timer) { clearInterval(timer); timer = null; }
  }

  window.rcScenes.register('bidon', { enter, exit });
})();
