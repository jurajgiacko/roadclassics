/* Drive scene — quick animated transition: drive-to-start illustration + a
   summary card showing what bonuses you carry into the race. Auto-advances. */
(function () {
  let overlay = null;
  let timer = null;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-drive';
    overlay.className = 'scene-overlay scene-prerace scene-drive';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/drive-to-start.png')"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 5 / 5 · Cesta na štart</div>
        <h2 class="title-display">Valtice, námestí Svobody</h2>
        <p class="lead" id="drive-summary">…</p>
        <div class="prep-summary" id="prep-summary"></div>
        <div class="prerace-foot">Štart o pár sekúnd…</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function summarize(j) {
    const lines = [];
    if (j.breakfast === 'eggs')      lines.push('• Praženica');
    if (j.breakfast === 'oats')      lines.push('• Ovsená kaša');
    if (j.breakfast === 'croissant') lines.push('• Croissant + espresso');
    if (j.bikeChecked) lines.push(`• Pneu ${j.tirePressure?.toFixed?.(1) || '?'} bar (+${j.tireBonus || 0}% rolling)`);
    else               lines.push('• Pneu nedotiahnutá — risk defektu');
    if (j.bidonLevel != null) lines.push(`• Bidon ${j.bidonLevel.toFixed(2)} L Isocarb (+${j.bidonBonus || 0})`);
    const pl = j.pocketsLoaded || {};
    const pocketSummary = [pl.gel ? `${pl.gel}× gel` : null,
                           pl.bar ? `${pl.bar}× bar` : null,
                           pl.drink ? `${pl.drink}× drink` : null].filter(Boolean).join(', ');
    lines.push(`• V tres-ke: ${pocketSummary || 'prázdne!'} (+${j.packingBonus || 0} bonus)`);
    return lines.join('<br/>');
  }

  async function enter() {
    build();
    const j = window.rcScenes.journey();
    overlay.querySelector('#drive-summary').innerHTML =
      `Si v aute, na streche bicykel. Pred sebou 124 km Pálavy. Cieľ: Reistna kolonáda.`;
    overlay.querySelector('#prep-summary').innerHTML = summarize(j);
    overlay.classList.add('show');

    /* auto-advance after 4 s, but allow tap to skip */
    timer = setTimeout(() => window.rcScenes.go('race'), 4000);
    overlay.addEventListener('click', skipNow, { once: true });
  }
  function skipNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    window.rcScenes.go('race');
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
    if (timer) { clearTimeout(timer); timer = null; }
  }

  window.rcScenes.register('drive', { enter, exit });
})();
