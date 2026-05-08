/* Packing scene — drag-style chip-shuffle with select-then-place pattern.
   Tap an item → it gets a gold ring (selected). Tap a pocket → places it
   there. Tap an item already in a pocket → returns it to the tray. */
(function () {
  let overlay = null;

  const ART = {
    gel:      '/assets/scenes/stations/item-gel-sachet.png',
    caffeine: '/assets/scenes/stations/item-gel-caffeine.png',
    jelly:    '/assets/scenes/stations/item-jelly.png',
    chews:    '/assets/scenes/stations/item-chews.png',
    bar:      '/assets/scenes/stations/item-bar-wrapped.png',
    drink:    '/assets/scenes/stations/item-isocarb-sachet.png',
    banana:   '/assets/scenes/prerace/food-banana.png'
  };

  const TRAY_INITIAL = [
    { id: 'gel1',     type: 'gel',      label: 'C2:1 GEL'  },
    { id: 'gel2',     type: 'gel',      label: 'C2:1 GEL'  },
    { id: 'caf1',     type: 'caffeine', label: 'CAFFEINE'  },
    { id: 'jelly1',   type: 'jelly',    label: 'JELLY'     },
    { id: 'jelly2',   type: 'jelly',    label: 'JELLY'     },
    { id: 'chews1',   type: 'chews',    label: 'CHEWS'     },
    { id: 'bar1',     type: 'bar',      label: 'C2:1 BAR'  },
    { id: 'banana1',  type: 'banana',   label: 'Banán'     }
  ];

  let tray = [];
  let pockets = [[], [], []];   /* 3 pockets, max 2 each */
  let selected = null;          /* selected item id */

  function reset() {
    tray = TRAY_INITIAL.map(o => ({ ...o }));
    pockets = [[], [], []];
    selected = null;
  }

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-packing';
    overlay.className = 'scene-overlay scene-prerace';
    overlay.innerHTML = `
      <div class="bg-art" style="background-image:url('/assets/scenes/prerace/jersey-packing.png'); opacity:.18"></div>
      <div class="prerace-shell">
        <div class="step-pill">Krok 4 / 5 · Tres</div>
        <h2 class="title-display">Naplň si dres</h2>
        <p class="lead">Ťukni na produkt → ťukni na kapsu. <strong>Max 2 / kapsa.</strong> Vyvážená sada (gel + bar + jelly) = max bonus.</p>
        <div class="packing-stage">
          <div class="jersey">
            <div class="pocket" data-i="0"><span class="lbl">L kapsa</span></div>
            <div class="pocket" data-i="1"><span class="lbl">Střed</span></div>
            <div class="pocket" data-i="2"><span class="lbl">P kapsa</span></div>
          </div>
          <div class="tray" id="pack-tray"></div>
        </div>
        <div class="prerace-foot" id="pack-hint">Tip: 1 banán + 1 gel + 1 jelly dá nejvyrovnanější boost.</div>
        <button type="button" class="btn btn-primary" id="pack-confirm">Hotovo (0)</button>
        <button type="button" class="btn btn-ghost" id="pack-reset">Vyprázdnit</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#pack-confirm').addEventListener('click', confirm);
    overlay.querySelector('#pack-reset').addEventListener('click', resetUI);
    overlay.querySelectorAll('.pocket').forEach(pocketEl => {
      pocketEl.addEventListener('click', (e) => {
        if (e.target.closest('.pack-chip')) return; /* let chip click handle */
        const i = +pocketEl.dataset.i;
        placeSelectedInto(i);
      });
    });
    return overlay;
  }

  function chip(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pack-chip pack-${item.type}` + (selected === item.id ? ' selected' : '');
    btn.dataset.id = item.id;
    btn.dataset.type = item.type;
    btn.innerHTML = `
      <span class="pack-img" style="background-image:url('${ART[item.type] || ''}')" aria-hidden="true"></span>
      <span class="pack-name">${item.label}</span>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleChip(item);
    });
    return btn;
  }

  function handleChip(item) {
    /* If chip is in a pocket → remove back to tray */
    for (let p = 0; p < 3; p++) {
      const idx = pockets[p].findIndex(i => i.id === item.id);
      if (idx !== -1) {
        tray.push(pockets[p][idx]);
        pockets[p].splice(idx, 1);
        selected = null;
        render();
        return;
      }
    }
    /* In tray → toggle selection */
    if (selected === item.id) selected = null;
    else                       selected = item.id;
    render();
  }

  function placeSelectedInto(pocketIdx) {
    if (!selected) return;
    const idxTray = tray.findIndex(i => i.id === selected);
    if (idxTray === -1) return;
    if (pockets[pocketIdx].length >= 2) {
      /* gentle nope hint */
      const pocketEl = overlay.querySelectorAll('.pocket')[pocketIdx];
      pocketEl.classList.add('reject');
      setTimeout(() => pocketEl.classList.remove('reject'), 300);
      return;
    }
    pockets[pocketIdx].push(tray[idxTray]);
    tray.splice(idxTray, 1);
    selected = null;
    render();
  }

  function render() {
    const trayEl = overlay.querySelector('#pack-tray');
    trayEl.innerHTML = '';
    tray.forEach(i => trayEl.appendChild(chip(i)));
    overlay.querySelectorAll('.pocket').forEach(pocketEl => {
      const i = +pocketEl.dataset.i;
      pocketEl.querySelectorAll('.pack-chip').forEach(c => c.remove());
      pocketEl.classList.toggle('targetable', !!selected && pockets[i].length < 2);
      pockets[i].forEach(it => pocketEl.appendChild(chip(it)));
    });
    const total = pockets.flat().length;
    const btn = overlay.querySelector('#pack-confirm');
    btn.textContent = `Hotovo (${total})`;
    btn.disabled = false;
  }

  function resetUI() {
    reset(); render();
  }

  function confirm() {
    const flat = pockets.flat();
    const counts = flat.reduce((a, c) => (a[c.type] = (a[c.type] || 0) + 1, a), {});
    const j = window.rcScenes.journey();
    j.pocketsLoaded = {
      gel:    counts.gel    || 0,
      bar:    counts.bar    || 0,
      drink:  counts.drink  || 0,
      banana: counts.banana || 0
    };

    let bonus = 0;
    const types = Object.keys(counts).length;
    if (types >= 3)      bonus += 30; /* well diversified */
    else if (types === 2) bonus += 15;
    else if (types === 1) bonus += 5;
    bonus += Math.min(15, flat.length * 2);
    if (counts.banana) bonus += 10; /* banana adds a small fresh-fuel bonus */
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
