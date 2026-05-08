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
      <button type="button" class="lm-capture" id="lm-capture" title="Stiahnuť ako wallpaper" aria-label="Stiahnuť ako wallpaper">📷</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#lm-capture').addEventListener('click', captureWallpaper);
    return card;
  }

  /* Generate a 1080×1920 mobile-wallpaper PNG from the current zone:
     landscape illustration as cover, brand badge top, footer caption.
     Triggers a download (or Web Share on mobile). */
  let activeZone = null;
  async function captureWallpaper(e) {
    e.stopPropagation();
    const zoneIdx = Math.max(0, ZONES.findIndex(z => z === activeZone));
    const z = ZONES[zoneIdx] || ZONES[0];
    const canvas = document.createElement('canvas');
    canvas.width  = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    /* Background: landscape illustration cover-fit */
    const land = await loadImg(`/assets/scenes/landscapes/${z.art}.png`);
    if (land) drawCover(ctx, land, 0, 0, 1080, 1920);

    /* Wine wash overlay */
    const wash = ctx.createLinearGradient(0, 0, 0, 1920);
    wash.addColorStop(0,   'rgba(8,2,8,0.55)');
    wash.addColorStop(0.4, 'rgba(8,2,8,0.15)');
    wash.addColorStop(1,   'rgba(8,2,8,0.85)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 1080, 1920);

    /* Top badges */
    const rcLogo = await loadImg('/assets/logos/rc_logo_horizontal_sb.svg');
    const enLogo = await loadImg('/assets/logos/enervit_logo.svg');
    if (rcLogo) ctx.drawImage(rcLogo, 60, 90, 280, 80);
    if (enLogo) ctx.drawImage(enLogo, 720, 90, 280, 80);

    /* Big "×" between logos */
    ctx.fillStyle = '#e4cb9d';
    ctx.font = '700 40px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×', 540, 130);

    /* Title block bottom */
    ctx.fillStyle = '#f0d4a0';
    ctx.font = '900 88px "Fraunces", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(z.label, 540, 1620);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '500 32px "Inter", sans-serif';
    ctx.fillText(z.subtitle, 540, 1690);

    ctx.fillStyle = 'rgba(228,203,157,0.7)';
    ctx.font = '700 24px "Inter", sans-serif';
    ctx.letterSpacing = '0.2em';
    ctx.fillText('PÁLAVA · ROAD CLASSICS 2026', 540, 1820);

    /* Trigger download (or Web Share on mobile) */
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const filename = `roadclassics-${z.art}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Pálava · ${z.label}`,
            text: 'Road Classics × Enervit'
          });
        } catch { /* cancelled */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      window.rcTrack && window.rcTrack('wallpaper_saved', { zone: z.art });
    }, 'image/png');
  }

  function loadImg(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  function drawCover(ctx, img, x, y, w, h) {
    const ar = img.width / img.height;
    const target = w / h;
    let dw, dh, dx, dy;
    if (ar > target) {
      dh = h; dw = h * ar; dx = x - (dw - w) / 2; dy = y;
    } else {
      dw = w; dh = w / ar; dx = x; dy = y - (dh - h) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* Show a vignette for the given zone index. Pauses the race state,
     fades in / holds / fades out, then resumes. */
  function show(idx, state) {
    const z = ZONES[idx];
    if (!z) return;
    activeZone = z;
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
