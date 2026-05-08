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
        <h2 class="title-display">Namíchej Isocarb</h2>
        <p class="lead">Drž tlačítko a lij. <strong>Cílové pásmo</strong> = optimální koncentrace. Přeteče = mokrý dres.</p>
        <div class="bidon-stage">
          <div class="bidon-graphic" id="bidon-graphic">
            <img class="bidon-img" src="/assets/scenes/stations/item-bidon.png" alt="" />
            <div class="bidon-pour" id="bidon-pour" aria-hidden="true"></div>
          </div>
          <div class="bidon-readout"><span id="bidon-val">0.00</span> <small>L</small></div>
        </div>
        <div class="bidon-gauge" id="bidon-gauge">
          <div class="bidon-gauge-target"></div>
          <div class="bidon-gauge-overflow"></div>
          <div class="bidon-gauge-fill" id="bidon-gauge-fill"></div>
          <div class="bidon-gauge-marks">
            <span style="left:25%">0.25</span>
            <span style="left:50%">0.50</span>
            <span style="left:75%">0.75</span>
          </div>
        </div>
        <button type="button" class="btn-pump" id="bidon-btn">Drž a lij</button>
        <div class="prerace-foot" id="bidon-foot">Cíl je 0.55–0.70 L. Nepřetékej.</div>
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
      if (resolved) return;
      if (pouring) {
        level += 0.018;
        if (level > 1.0) level = 1.0;
      }
      const fill   = overlay.querySelector('#bidon-gauge-fill');
      const val    = overlay.querySelector('#bidon-val');
      const gfx    = overlay.querySelector('#bidon-graphic');
      const pour   = overlay.querySelector('#bidon-pour');
      fill.style.width = `${level * 100}%`;
      val.textContent = (level * 0.75).toFixed(2);
      /* Highlight bidon when in target zone */
      gfx.classList.toggle('on-target', level >= TARGET_MIN && level <= TARGET_MAX);
      gfx.classList.toggle('overflow',  level >= 0.92);
      pour.style.opacity = pouring ? 1 : 0;
      if (level >= 1.0 && pouring) resolve();
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
      outcome = `Perfektně ${(level * 0.75).toFixed(2)} L. +20 hydrating bonus.`;
      bonus = 20;
    } else if (level > TARGET_MAX && level < 0.92) {
      outcome = `Přeteklo (${(level * 0.75).toFixed(2)} L). Pomalejší zrychlení. +5.`;
      bonus = 5;
    } else if (level >= 1.0) {
      outcome = `Přeteklo přes okraj — máš mokrý dres. 0 bonus.`;
      bonus = 0;
    } else if (level >= 0.3) {
      outcome = `Trochu málo (${(level * 0.75).toFixed(2)} L). +10.`;
      bonus = 10;
    } else {
      outcome = `Skoro nic v bidonu. 0 bonus.`;
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
    overlay.querySelector('#bidon-gauge-fill').style.width = '0';
    overlay.querySelector('#bidon-val').textContent = '0.00';
    overlay.querySelector('#bidon-foot').textContent = 'Cíl je 0.55–0.70 L. Nepřetékej.';
    overlay.querySelector('#bidon-graphic').classList.remove('on-target', 'overflow');
    overlay.classList.add('show');
    tick();
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
    if (timer) { clearInterval(timer); timer = null; }
  }

  window.rcScenes.register('bidon', { enter, exit });
})();
