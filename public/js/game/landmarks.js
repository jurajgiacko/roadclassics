/* Landmarks — full-screen chapter cards triggered by progressPct.
   When the player crosses into a new landmark zone, briefly pause the
   game and show the landscape illustration with the zone label.
   After ~1.6s the vignette fades out and the race resumes. */
(function () {
  /* 7 zones along the Pálava 124 km route, each tied to one landscape PNG */
  const ZONES = [
    { from: 0,  to: 12, art: 'valtice-morning',        label: 'Štart · Valtice',          subtitle: 'námestí Svobody, 11:00' },
    { from: 12, to: 25, art: 'lednice-vineyards',      label: 'Vinice u Lednice',         subtitle: '~16 km · roller cez vinné rady' },
    { from: 25, to: 38, art: 'mikulov-overlook',       label: 'Mikulov',                  subtitle: '~32 km · pred prvou stúpačkou' },
    { from: 38, to: 50, art: 'devin-climb',            label: 'Stúpanie na Děvín',        subtitle: '~47 km · 7.8 % gradient' },
    { from: 50, to: 65, art: 'novomlynske-reservoirs', label: 'Novomlýnské nádrže',       subtitle: '~62 km · vietor cez vodu' },
    { from: 65, to: 80, art: 'tesarova-past-pass',     label: 'Tesarova past',            subtitle: '~96 km · technický úsek' },
    { from: 80, to: 100,art: 'reistna-kolonada',       label: 'Reistna kolonáda',         subtitle: '~110 km · finálne stúpanie' }
  ];

  let currentZone = -1;
  let card = null;

  function buildCard() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'landmark-card';
    card.innerHTML = `
      <div class="lm-art" id="lm-art"></div>
      <div class="lm-text">
        <div class="lm-kicker" id="lm-kicker">Zóna 1 z 7</div>
        <h3 class="lm-title" id="lm-title">…</h3>
        <p class="lm-sub" id="lm-sub">…</p>
      </div>
    `;
    document.body.appendChild(card);
    return card;
  }

  /* Show a vignette for the given zone index. Pauses the race state,
     fades in / holds / fades out, then resumes. */
  function show(idx, state) {
    const z = ZONES[idx];
    if (!z) return;
    buildCard();
    document.getElementById('lm-art').style.backgroundImage = `url('/assets/scenes/landscapes/${z.art}.png')`;
    document.getElementById('lm-kicker').textContent = `Zóna ${idx + 1} z ${ZONES.length}`;
    document.getElementById('lm-title').textContent = z.label;
    document.getElementById('lm-sub').textContent = z.subtitle;

    const wasPaused = state.paused;
    state.paused = true;
    card.classList.add('show');
    window.rcTrack && window.rcTrack('landmark_enter', { zone: idx, art: z.art });

    setTimeout(() => {
      card.classList.remove('show');
      /* Resume the race after the vignette fades; preserve pre-existing pause if e.g. tactic modal is up */
      setTimeout(() => { state.paused = wasPaused; }, 350);
    }, 1700);
  }

  function tick(state) {
    if (!state || !state.monument) return;
    /* Skip while another overlay (tactic modal, café stop, finish) is up */
    if (state.paused || state.finished) return;
    const pct = state.progressPct || 0;
    const zoneAt = (p) => ZONES.findIndex(z => p >= z.from && p < z.to);
    const idx = zoneAt(pct);
    if (idx !== -1 && idx !== currentZone) {
      currentZone = idx;
      /* Skip the very first zone fanfare (player already saw intro/start),
         but show all subsequent ones */
      if (idx > 0) show(idx, state);
    }
  }

  function reset() { currentZone = -1; }

  function activeArt(pct) {
    const z = ZONES.find(z => pct >= z.from && pct < z.to) || ZONES[0];
    return z.art;
  }

  window.rcLandmarks = { tick, reset, activeArt, ZONES };
})();
