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
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
  }

  function showIncoming(text) {
    if (!els.incoming) return;
    els.incoming.textContent = text;
    els.incoming.classList.add('show');
    clearTimeout(pendingHint);
    pendingHint = setTimeout(() => els.incoming.classList.remove('show'), 1800);
  }

  function open(state, tactic, onChoice) {
    if (!els.modal) return;
    active = tactic;
    state.paused = true;

    els.ctx.textContent = tactic.context || 'Rozhodnutie';
    els.title.textContent = tactic.context || 'Tvoj ťah';
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

    /* 3s countdown */
    let remaining = 3;
    els.counter.textContent = remaining;
    timerInt = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timerInt); timerInt = null;
        const def = tactic.options.find(o => o.id === 'draft') || tactic.options[0];
        choose(state, def, onChoice, true);
      } else {
        els.counter.textContent = remaining;
      }
    }, 1000);
  }

  function choose(state, opt, onChoice, isDefault = false) {
    if (!active) return;
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    els.modal.classList.remove('show');
    state.paused = false;

    /* Apply effect: energy delta + speed multiplier for opt.duration_s */
    const dEnergy = -(opt.cost_energy || 0); // cost_energy positive = costs, negative = restores
    state.energy = Math.max(0, Math.min(100, state.energy + dEnergy));
    if (opt.speed_mul && opt.duration_s) {
      state.boostMul = opt.speed_mul;
      state.boostUntil = state.elapsed + opt.duration_s;
    }

    window.rcTrack && window.rcTrack('tactical_choice', {
      monument: state.monument?.id,
      pct: active.trigger_pct,
      choice: opt.id,
      defaulted: isDefault
    });

    if (typeof onChoice === 'function') onChoice(opt, isDefault);

    /* Track style classification */
    state.styleLog = state.styleLog || [];
    state.styleLog.push(opt.id);

    active = null;
  }

  function tick(state, onChoice) {
    if (active) return;
    for (const t of armed) {
      if (t.fired) continue;
      const dist = t.trigger_pct - state.progressPct;
      if (!t.hinted && dist > 0 && dist < 4) {
        t.hinted = true;
        showIncoming(`Rozhodnutie o chvíľu — ${t.context}`);
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
