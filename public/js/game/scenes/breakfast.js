/* Breakfast scene — illustration of morning kitchen with 3 meal hotspots.
   Choosing one applies a small pre-race energy bonus and unlocks next stage. */
(function () {
  let overlay = null;

  /* Each option = ID, label, energy bonus, slight tradeoff explanation. */
  const OPTIONS = [
    { id: 'eggs',      label: 'Praženica',    sub: '+10 energia · pomalé štartovanie', bonus: 10 },
    { id: 'oats',      label: 'Ovsená kaša',  sub: '+15 energia · stabilný release',   bonus: 15 },
    { id: 'croissant', label: 'Croissant + espresso', sub: '+5 energia · rýchly štart, kratší kop', bonus: 5 }
  ];

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-breakfast';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/kitchen-breakfast.png')"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 1 / 4 · Ráno</div>
        <h2 class="title-display">Čím začneš?</h2>
        <p class="lead">Pálava ťa nepustí na lacno. Vyber raňajky — každé jedlo ti dá rôzny štart.</p>
        <div class="choices" id="bf-choices">
          ${OPTIONS.map(o => `
            <button type="button" class="choice" data-id="${o.id}">
              <div class="choice-label">${o.label}</div>
              <div class="choice-sub">${o.sub}</div>
            </button>
          `).join('')}
        </div>
        <div class="prerace-foot">Choice = trvalý bonus na trati. Nedá sa zmeniť.</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.choice').forEach(btn => {
      btn.addEventListener('click', () => choose(btn.dataset.id));
    });
    return overlay;
  }

  function choose(id) {
    const opt = OPTIONS.find(o => o.id === id);
    if (!opt) return;
    const j = window.rcScenes.journey();
    j.breakfast = id;
    j.prepBonusEnergy = (j.prepBonusEnergy || 0) + opt.bonus;
    window.rcTrack && window.rcTrack('prep_choice', { stage: 'breakfast', id, bonus: opt.bonus });
    window.rcScenes.go('garage');
  }

  async function enter() {
    build();
    overlay.classList.add('show');
  }
  async function exit() {
    overlay && overlay.classList.remove('show');
  }

  window.rcScenes.register('breakfast', { enter, exit });
})();
