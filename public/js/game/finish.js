/* Finish screen — opens when state.progressPct reaches 100.
   Computes the final score breakdown, classifies riding style from
   state.styleLog, persists personal best in localStorage, and wires up
   replay + share buttons. */
(function () {
  const els = {
    modal:        document.getElementById('finish-modal'),
    ribbon:       document.getElementById('finish-ribbon'),
    score:        document.getElementById('finish-score'),
    styleLabel:   document.getElementById('finish-style-label'),
    styleGlyph:   document.getElementById('finish-style-glyph'),
    time:         document.getElementById('finish-time'),
    timeSub:      document.getElementById('finish-time-sub'),
    energy:       document.getElementById('finish-energy'),
    energySub:    document.getElementById('finish-energy-sub'),
    pickups:      document.getElementById('finish-pickups'),
    distance:     document.getElementById('finish-distance'),
    pb:           document.getElementById('finish-pb'),
    replay:       document.getElementById('finish-replay'),
    share:        document.getElementById('finish-share'),
    confetti:     document.getElementById('confetti')
  };

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${sec}`;
  }

  function classifyStyle(log = []) {
    if (!log.length) return { id: 'tempař', label: 'Tempař', glyph: '⏱' };
    const counts = log.reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), {});
    const max = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const dominant = max[0];
    const dominance = max[1] / log.length;
    if (dominance < 0.5) return { id: 'taktik', label: 'Taktik', glyph: '♛' };
    if (dominant === 'attack') return { id: 'útočník', label: 'Útočník',  glyph: '⚡' };
    if (dominant === 'refuel') return { id: 'fueler',  label: 'Fueler',   glyph: '🥤' };
    return { id: 'tempař', label: 'Tempař', glyph: '⏱' };
  }
  /* CZ-friendly substring lookups since we feed labels into existing
     style modal — Tempař/Útočník/Fueler/Taktik are already CZ-compatible. */

  function computeScore(state) {
    /* Time bonus: <2:30 → 1500, 3:00 → 1000, 4:00 → 500, capped */
    const t = state.elapsed;
    const timeBonus = Math.max(200, Math.round(2200 - t * 8));
    /* Energy bonus: 5 pts per energy unit left */
    const energyBonus = Math.round(state.energy * 5);
    /* Pickup bonus already baked into state.score (collected while playing) */
    const pickupRunning = state.score || 0;
    /* Total */
    const total = timeBonus + energyBonus + pickupRunning;
    return {
      timeBonus,
      energyBonus,
      pickupRunning,
      total
    };
  }

  function pbKey(monumentId) { return `rc:pb:${monumentId}`; }

  function loadPB(monumentId) {
    try { return JSON.parse(localStorage.getItem(pbKey(monumentId))) || null; }
    catch { return null; }
  }
  function savePB(monumentId, payload) {
    try { localStorage.setItem(pbKey(monumentId), JSON.stringify(payload)); }
    catch { /* private mode etc. — silently ignore */ }
  }

  function spawnConfetti() {
    if (!els.confetti) return;
    els.confetti.innerHTML = '';
    const colors = ['#e53747', '#e4cb9d', '#198754', '#1f78d1', '#ffd43b', '#e30613'];
    const count = 80;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = `${2 + Math.random() * 2.5}s`;
      s.style.animationDelay = `${Math.random() * 0.6}s`;
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      els.confetti.appendChild(s);
    }
    setTimeout(() => { els.confetti.innerHTML = ''; }, 5000);
  }

  function open(state) {
    if (!els.modal || state.finished) return;
    state.finished = true;
    state.paused = true;

    const score = computeScore(state);
    const style = classifyStyle(state.styleLog);
    const distanceKm = state.monument?.real?.long_km || 125;
    const pickupsTotal = (state.monument?.pickups || []).length;

    els.ribbon.textContent = `${state.monument?.name || 'Monument'} dokončena`;
    els.score.textContent = score.total;
    els.styleLabel.textContent = style.label;
    els.styleGlyph.textContent = style.glyph;
    els.time.textContent = fmtTime(state.elapsed);
    els.timeSub.textContent = `Časový bonus +${score.timeBonus}`;
    /* "Energie" / "Závěrečný stav" labels live in game.html now */
    els.energy.textContent = `${Math.round(state.energy)} / 100`;
    els.energySub.textContent = `Energy bonus +${score.energyBonus}`;
    els.pickups.textContent = `${state.pickupsCollected || 0} / ${pickupsTotal}`;
    els.distance.textContent = `${distanceKm} km`;

    /* PB compare */
    const pb = loadPB(state.monument?.id);
    if (!pb || score.total > pb.score) {
      savePB(state.monument?.id, { score: score.total, time: state.elapsed, when: Date.now() });
      els.pb.textContent = pb ? `🏆 Nový rekord! Předtím ${pb.score} bodů.` : '🏆 Tvůj první záznam!';
      els.pb.className = 'finish-pb new';
    } else {
      const diff = pb.score - score.total;
      els.pb.textContent = `Osobní rekord: ${pb.score} bodů · o ${diff} méně`;
      els.pb.className = 'finish-pb';
    }

    els.modal.classList.add('show');
    spawnConfetti();
    /* re-fire confetti once for extra celebration */
    setTimeout(spawnConfetti, 1300);

    window.rcTrack && window.rcTrack('game_finish', {
      monument: state.monument?.id,
      time_s: Math.round(state.elapsed),
      score: score.total,
      style: style.id,
      energy_left: Math.round(state.energy),
      pickups: state.pickupsCollected || 0
    });
  }

  function close() {
    els.modal && els.modal.classList.remove('show');
  }

  function shareScore(state) {
    const score = computeScore(state);
    const text = `Pálava dokončena v ${fmtTime(state.elapsed)} — ${score.total} bodů. Road Classics × Enervit. Zkus mě porazit: ${location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'Road Classics: The Climb', text, url: location.origin })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(
        () => alert('Skóre zkopírováno do schránky.'),
        () => prompt('Zkopíruj výsledek:', text)
      );
    }
    window.rcTrack && window.rcTrack('share_clicked', { monument: state.monument?.id });
  }

  function attach(state) {
    els.replay && els.replay.addEventListener('click', () => {
      window.rcTrack && window.rcTrack('replay_clicked', { monument: state.monument?.id });
      location.reload();
    });
    els.share && els.share.addEventListener('click', () => shareScore(state));
    const cont = document.getElementById('finish-continue');
    cont && cont.addEventListener('click', () => {
      /* Carry race outcomes into the journey for recovery + afterparty scenes */
      if (window.rcScenes) {
        const j = window.rcScenes.journey();
        j.finishTime       = state.elapsed;
        j.finishEnergy     = state.energy;
        j.pickupsCollected = state.pickupsCollected || 0;
        j.styleLog         = state.styleLog || [];
        j.score            = state.score || 0;
        els.modal && els.modal.classList.remove('show');
        window.rcScenes.go('recovery');
      }
    });
  }

  window.rcFinish = { open, close, attach };
})();
