/* HUD bindings. Updated each frame from engine. */
(function () {
  const els = {
    timer:    document.getElementById('hud-timer'),
    energy:   document.getElementById('hud-energy'),
    energyBar:document.querySelector('#energy-bar > span'),
    energyBarWrap: document.getElementById('energy-bar'),
    cadence:  document.getElementById('hud-cadence'),
    zones:    document.getElementById('cadence-zones'),
    monument: document.getElementById('hud-monument'),
    posMarker:document.getElementById('pos-marker'),
    profileSvg: document.getElementById('profile-svg')
  };

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${sec}`;
  }

  function cadenceZone(rpm) {
    if (rpm < 70)   return 'low';
    if (rpm < 80)   return 'below';
    if (rpm <= 95)  return 'ideal';
    if (rpm <= 110) return 'above';
    return 'anaer';
  }

  function setCadenceZones(rpm) {
    if (!els.zones) return;
    const z = cadenceZone(rpm);
    els.zones.dataset.zone = z;
    const lit = { low: 1, below: 2, ideal: 3, above: 4, anaer: 5 }[z];
    [...els.zones.children].forEach((s, i) => s.classList.toggle('lit', i < lit));
  }

  function setEnergyBar(energy) {
    if (!els.energyBarWrap) return;
    els.energyBar.style.width = `${Math.max(0, Math.min(100, energy))}%`;
    els.energyBarWrap.classList.toggle('warn', energy < 50 && energy >= 25);
    els.energyBarWrap.classList.toggle('crit', energy < 25);
  }

  window.rcUI = {
    els,
    fmtTime,
    cadenceZone,
    setCadenceZones,
    setEnergyBar,
    setMonumentName(name) { if (els.monument) els.monument.textContent = name; },
    setTimer(seconds)     { if (els.timer)    els.timer.textContent = fmtTime(seconds); },
    setEnergy(value)      { if (els.energy)   els.energy.textContent = Math.round(value); setEnergyBar(value); },
    setCadence(rpm)       { if (els.cadence)  els.cadence.textContent = Math.round(rpm); setCadenceZones(rpm); },
    setProgressPct(pct)   { if (els.posMarker) els.posMarker.style.left = `${Math.max(0, Math.min(100, pct))}%`; }
  };
})();
