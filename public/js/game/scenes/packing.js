/* Packing scene — drag-drop Enervit C2:1PRO products into 3 jersey pockets.
   Player has 6 slots in a tray and 3 pockets. Limit per pocket is 2 items.
   Score reflects mix balance (1 of each is ideal). */
(function () {
  let overlay = null;
  /* Tray and pocket state */
  const ART = {
    gel:   '/assets/scenes/stations/item-gel-sachet.png',
    bar:   '/assets/scenes/stations/item-bar-wrapped.png',
    drink: '/assets/scenes/stations/item-isocarb-sachet.png'
  };
  const TRAY = [
    { id: 'gel1',   type: 'gel',   label: 'C2:1 GEL'   },
    { id: 'gel2',   type: 'gel',   label: 'C2:1 GEL'   },
    { id: 'gel3',   type: 'gel',   label: 'C2:1 GEL'   },
    { id: 'bar1',   type: 'bar',   label: 'C2:1 BAR'   },
    { id: 'bar2',   type: 'bar',   label: 'C2:1 BAR'   },
    { id: 'drink1', type: 'drink', label: 'ISOCARB'    },
    { id: 'drink2', type: 'drink', label: 'ISOCARB'    }
  ];
  let tray = [];
  let pockets = [[], [], []]; /* 3 pockets, max 2 items each */

  function reset() {
    tray = TRAY.map(o => ({ ...o }));
    pockets = [[], [], []];
  }

  function totalPocketed() {
    return pockets.flat().length;
  }

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-packing';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/jersey-packing.png'); opacity:.18"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 3 / 5 · Tres</div>
        <h2 class="title-display">Naplň si dres</h2>
        <p class="lead">Maximálne <strong>2 produkty na vrecko</strong>. Vyvážená sada (1 gel + 1 bar + 1 drink) ti dá najväčší bonus.</p>
        <div class="packing-stage">
          <div class="jersey">
            <div class="pocket" data-i="0"><span class="lbl">L vrecko</span></div>
            <div class="pocket" data-i="1"><span class="lbl">Stred</span></div>
            <div class="pocket" data-i="2"><span class="lbl">P vrecko</span></div>
          </div>
          <div class="tray" id="pack-tray"></div>
        </div>
        <button type="button" class="btn btn-primary" id="pack-confirm" disabled>Potvrdiť (0/6)</button>
        <button type="button" class="btn btn-ghost" id="pack-reset">Vyprázdniť</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#pack-confirm').addEventListener('click', confirm);
    overlay.querySelector('#pack-reset').addEventListener('click', resetUI);

    return overlay;
  }

  function chip(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pack-chip pack-${item.type}`;
    btn.dataset.id = item.id;
    btn.dataset.type = item.type;
    btn.innerHTML = `
      <span class="pack-img" style="background-image:url('${ART[item.type]}')" aria-hidden="true"></span>
      <span class="pack-name">${item.label}</span>
    `;
    btn.addEventListener('click', () => moveItem(item.id));
    return btn;
  }

  function moveItem(id) {
    /* If item is in tray, find first pocket with space and move */
    const idxTray = tray.findIndex(i => i.id === id);
    if (idxTray !== -1) {
      const targetP = pockets.findIndex(p => p.length < 2);
      if (targetP === -1) return; /* all full */
      pockets[targetP].push(tray[idxTray]);
      tray.splice(idxTray, 1);
      render();
      return;
    }
    /* If item is in a pocket, move back to tray */
    for (let p = 0; p < 3; p++) {
      const idx = pockets[p].findIndex(i => i.id === id);
      if (idx !== -1) {
        tray.push(pockets[p][idx]);
        pockets[p].splice(idx, 1);
        render();
        return;
      }
    }
  }

  function render() {
    const trayEl = overlay.querySelector('#pack-tray');
    trayEl.innerHTML = '';
    tray.forEach(i => trayEl.appendChild(chip(i)));
    overlay.querySelectorAll('.pocket').forEach(pocketEl => {
      const i = +pocketEl.dataset.i;
      pocketEl.querySelectorAll('.pack-chip').forEach(c => c.remove());
      pockets[i].forEach(it => pocketEl.appendChild(chip(it)));
    });
    const total = totalPocketed();
    const btn = overlay.querySelector('#pack-confirm');
    btn.textContent = `Potvrdiť (${total}/6)`;
    btn.disabled = total === 0;
  }

  function resetUI() {
    reset(); render();
  }

  function confirm() {
    /* Compute bonus based on type counts */
    const flat = pockets.flat();
    const counts = flat.reduce((a, c) => (a[c.type] = (a[c.type] || 0) + 1, a), {});
    const has = (t) => counts[t] > 0;
    const j = window.rcScenes.journey();
    j.pocketsLoaded = { gel: counts.gel || 0, bar: counts.bar || 0, drink: counts.drink || 0 };

    let bonus = 0;
    if (has('gel') && has('bar') && has('drink')) bonus += 30;       /* balanced */
    else if (Object.keys(counts).length === 2) bonus += 15;         /* 2 types */
    else if (Object.keys(counts).length === 1) bonus += 5;          /* monoculture */
    bonus += Math.min(15, flat.length * 2);                          /* total volume up to 6 = +12 */
    j.packingBonus = bonus;
    j.prepBonusEnergy = (j.prepBonusEnergy || 0) + Math.round(bonus / 3);

    window.rcTrack && window.rcTrack('prep_choice', {
      stage: 'packing', counts, bonus, total: flat.length
    });

    window.rcScenes.go('drive');
  }

  async function enter() {
    build();
    reset(); render();
    overlay.classList.add('show');
  }
  async function exit() { overlay && overlay.classList.remove('show'); }

  window.rcScenes.register('packing', { enter, exit });
})();
