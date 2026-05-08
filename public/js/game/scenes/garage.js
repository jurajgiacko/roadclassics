/* Garage scene — bike check mini-game.
   Player taps to inflate front tire to ~8.5 bar. If they overshoot or
   undershoot they get a smaller bonus. */
(function () {
  let overlay = null;
  let pressure = 0;     // current bar
  let target  = 8.5;    // sweet spot
  let timer   = null;
  let pumping = false;
  let resolved = false;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-garage';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/garage-bike-check.png')"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 2 / 5 · Garáž</div>
        <h2 class="title-display">Nahust pneumatiku</h2>
        <p class="lead">Drž tlačítko na pumpování. <strong>Cíl ~8.5 bar</strong>. Přefoukneš → praskne, podfoukneš → defekt.</p>
        <div class="gauge-wrap">
          <div class="gauge-bar" id="gauge-bar">
            <div class="gauge-target"></div>
            <div class="gauge-fill" id="gauge-fill"></div>
            <div class="gauge-overload" id="gauge-overload"></div>
          </div>
          <div class="gauge-readout"><span id="gauge-val">0.0</span> <small>bar</small></div>
        </div>
        <button type="button" class="btn-pump" id="pump-btn">Drž a pumpuj</button>
        <div class="prerace-foot" id="garage-foot">Pusť tlačítko když trefíš pásmo 8.0–9.0 bar.</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#pump-btn');
    /* Both touch and mouse hold */
    const start = (e) => { e.preventDefault?.(); pumping = true; };
    const end   = (e) => { e.preventDefault?.(); if (pumping) { pumping = false; resolve(); } };
    btn.addEventListener('mousedown',  start);
    btn.addEventListener('mouseup',    end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   end,   { passive: false });
    btn.addEventListener('touchcancel',end,   { passive: false });
    return overlay;
  }

  function loop() {
    const fill     = overlay.querySelector('#gauge-fill');
    const overload = overlay.querySelector('#gauge-overload');
    const val      = overlay.querySelector('#gauge-val');
    timer = setInterval(() => {
      if (!pumping || resolved) return;
      pressure += 0.18;
      if (pressure > 12) pressure = 12;
      const pctIn = Math.min(100, pressure / 10 * 100);
      fill.style.width = `${Math.min(100, pctIn)}%`;
      const overPct = Math.max(0, (pressure - 10) / 2 * 100);
      overload.style.width = `${overPct}%`;
      val.textContent = pressure.toFixed(1);
      if (pressure >= 12) resolve(); /* burst */
    }, 60);
  }

  function resolve() {
    if (resolved) return;
    resolved = true;
    clearInterval(timer); timer = null;
    const j = window.rcScenes.journey();
    j.tirePressure = +pressure.toFixed(1);
    let outcome, bonus;
    if (pressure >= 12)         { outcome = 'BUM! Praskla. Žádný bonus.';                      bonus = 0;  j.bikeChecked = false; }
    else if (pressure >= 8 && pressure <= 9.2) {
      outcome = `Perfektních ${pressure.toFixed(1)} bar. +15 % rolling efficiency.`;
      bonus = 15; j.bikeChecked = true;
    } else if (pressure >= 7 && pressure < 8)  {
      outcome = `Trochu málo (${pressure.toFixed(1)} bar). +5 %.`;
      bonus = 5;  j.bikeChecked = true;
    } else if (pressure > 9.2 && pressure < 12) {
      outcome = `Přefouknuto (${pressure.toFixed(1)} bar). +5 %.`;
      bonus = 5;  j.bikeChecked = true;
    } else                       { outcome = `Podfouknuto ${pressure.toFixed(1)} bar — riziko defektu.`;        bonus = 0;  j.bikeChecked = false; }

    j.tireBonus = bonus;
    overlay.querySelector('#garage-foot').innerHTML = outcome;

    window.rcTrack && window.rcTrack('prep_choice', { stage: 'garage', pressure, bonus });

    /* small delay so player reads the result */
    setTimeout(() => window.rcScenes.go('bidon'), 1600);
  }

  async function enter() {
    build();
    pressure = 0; pumping = false; resolved = false;
    overlay.querySelector('#gauge-fill').style.width = '0';
    overlay.querySelector('#gauge-overload').style.width = '0';
    overlay.querySelector('#gauge-val').textContent = '0.0';
    overlay.querySelector('#garage-foot').textContent = 'Pusť tlačítko když trefíš pásmo 8.0–9.0 bar.';
    overlay.classList.add('show');
    loop();
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
    if (timer) { clearInterval(timer); timer = null; }
  }

  window.rcScenes.register('garage', { enter, exit });
})();
