/* Breakfast scene — illustration of morning kitchen with 3 meal hotspots.
   Choosing one applies a small pre-race energy bonus and unlocks next stage. */
(function () {
  let overlay = null;

  /* Each option = ID, label, illustrated card, energy bonus, tradeoff. */
  const OPTIONS = [
    { id: 'eggs',      label: 'Míchaná vejce',        sub: '+10 energie · pomalý start',              bonus: 10, img: '/assets/scenes/prerace/food-eggs.png' },
    { id: 'oats',      label: 'Ovesná kaše',          sub: '+15 energie · stabilní release',          bonus: 15, img: '/assets/scenes/prerace/food-oats.png' },
    { id: 'croissant', label: 'Croissant + espresso', sub: '+5 energie · rychlý start, kratší kop',   bonus: 5,  img: '/assets/scenes/prerace/food-croissant.png' }
  ];

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-breakfast';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/kitchen-breakfast.png')"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 1 / 5 · Ráno</div>
        <h2 class="title-display">Čím začneš?</h2>
        <p class="lead">Pálava tě nenechá levně. Vyber snídani — každé jídlo ti dá jiný start.</p>
        <div class="food-cards" id="bf-cards">
          ${OPTIONS.map(o => `
            <button type="button" class="food-card" data-id="${o.id}">
              <div class="food-card-img" style="background-image:url('${o.img}')"></div>
              <div class="food-card-label">${o.label}</div>
              <div class="food-card-sub">${o.sub}</div>
            </button>
          `).join('')}
        </div>
        <div class="prerace-foot">Volba = trvalý bonus na trase. Nelze změnit.</div>
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
