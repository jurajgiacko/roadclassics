/* Tactical decisions — modal pause + 3 choices + 3s countdown.
   Triggers when player crosses tactic.trigger_pct.
   Default choice when timer runs out: id 'draft' (peloton) if present,
   else first option. */
(function () {
  const els = {
    modal:    document.getElementById('tactic-modal'),
    title:    document.getElementById('tactic-title'),
    sub:      document.getElementById('tactic-sub'),
    ctx:      document.getElementById('tactic-ctx'),
    options:  document.getElementById('tactic-options'),
    counter:  document.getElementById('tactic-counter'),
    incoming: document.getElementById('tactic-incoming')
  };

  let armed = [];      // tactics still to fire
  let active = null;   // currently-shown decision
  let timerInt = null;
  let pendingHint = null;

  function setup(monument) {
    armed = (monument.tactics || []).map(t => ({ ...t, fired: false, hinted: false }));
    active = null;
    if (timerInt) { cancelAnimationFrame(timerInt); timerInt = null; }
  }

  function showIncoming(text) {
    if (!els.incoming) return;
    els.incoming.textContent = text;
    els.incoming.classList.add('show');
    clearTimeout(pendingHint);
    pendingHint = setTimeout(() => els.incoming.classList.remove('show'), 1800);
  }

  const COUNTDOWN_MS = 7000; // give the player time to read the options

  function open(state, tactic, onChoice) {
    if (!els.modal) return;
    active = tactic;
    state.paused = true;

    els.ctx.textContent = tactic.context || 'Rozhodnutí';
    els.title.textContent = tactic.context || 'Tvůj tah';
    els.sub.textContent = tactic.subtext || '';

    /* Build option buttons fresh each time */
    els.options.innerHTML = '';
    tactic.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tactic-btn';
      btn.dataset.id = opt.id;
      btn.innerHTML = `<span>${opt.label}</span><span class="hint">${opt.hint || ''}</span>`;
      btn.addEventListener('click', () => choose(state, opt, onChoice), { once: true });
      els.options.appendChild(btn);
    });

    els.modal.classList.add('show');

    /* Smooth countdown using requestAnimationFrame so the ring animates
       continuously rather than jumping per second. */
    const start = performance.now();
    if (timerInt) cancelAnimationFrame(timerInt);
    function tickCountdown(now) {
      const elapsed = now - start;
      const remaining = Math.max(0, COUNTDOWN_MS - elapsed);
      const fraction = remaining / COUNTDOWN_MS;
      const sec = Math.ceil(remaining / 1000);
      els.counter.textContent = sec;
      const ring = els.modal.querySelector('.ring');
      if (ring) {
        /* CSS conic-gradient: how much of the ring is "spent" */
        ring.style.background = `conic-gradient(var(--rc-energy) ${(1 - fraction) * 360}deg, rgba(228,203,157,.18) 0)`;
      }
      if (remaining > 0 && active === tactic) {
        timerInt = requestAnimationFrame(tickCountdown);
      } else if (active === tactic) {
        const def = tactic.options.find(o => o.id === 'draft') || tactic.options[0];
        choose(state, def, onChoice, true);
      }
    }
    timerInt = requestAnimationFrame(tickCountdown);
  }

  function choose(state, opt, onChoice, isDefault = false) {
    if (!active) return;
    if (timerInt) { cancelAnimationFrame(timerInt); timerInt = null; }
    els.modal.classList.remove('show');
    state.paused = false;

    const dEnergy = -(opt.cost_energy || 0); // positive cost_energy = costs energy
    state.energy = Math.max(0, Math.min(100, state.energy + dEnergy));
    if (opt.speed_mul && opt.duration_s) {
      state.boostMul = opt.speed_mul;
      state.boostUntil = state.elapsed + opt.duration_s;
    }

    /* Score: rewarded by choice quality.
       - attack: +200 if energy was high (>=60) before, -100 if low
       - draft:  flat +120
       - refuel: +150 if energy was low (<=40), +50 otherwise
       - default-fired (player didn't decide): -50 */
    const energyAtChoice = state.energy - dEnergy;
    let delta = 0;
    if (opt.id === 'attack') delta = energyAtChoice >= 60 ? 200 : -100;
    else if (opt.id === 'draft')  delta = 120;
    else if (opt.id === 'refuel') delta = energyAtChoice <= 40 ? 200 : 60;
    if (isDefault) delta -= 50;
    state.score = (state.score || 0) + delta;

    showChoiceFeedback(opt, delta, isDefault);

    window.rcTrack && window.rcTrack('tactical_choice', {
      monument: state.monument?.id,
      pct: active.trigger_pct,
      choice: opt.id,
      defaulted: isDefault,
      score_delta: delta
    });

    if (typeof onChoice === 'function') onChoice(opt, isDefault);

    state.styleLog = state.styleLog || [];
    state.styleLog.push(opt.id);

    active = null;
  }

  function showChoiceFeedback(opt, delta, isDefault) {
    const el = els.incoming;
    if (!el) return;
    const sign = delta >= 0 ? '+' : '';
    const cls = delta >= 100 ? 'good' : (delta < 0 ? 'bad' : 'ok');
    el.className = 'tactic-incoming show ' + cls;
    const label = isDefault ? 'Nerozhodl jsi — drž peloton' : opt.label;
    el.innerHTML = `${label} <strong>${sign}${delta}</strong>`;
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function tick(state, onChoice) {
    if (active) return;
    for (const t of armed) {
      if (t.fired) continue;
      const dist = t.trigger_pct - state.progressPct;
      if (!t.hinted && dist > 0 && dist < 4) {
        t.hinted = true;
        showIncoming(`Rozhodnutí za chvíli — ${t.context}`);
      }
      if (state.progressPct >= t.trigger_pct) {
        t.fired = true;
        open(state, t, onChoice);
        break;
      }
    }
  }

  window.rcTactics = { setup, tick };
})();
