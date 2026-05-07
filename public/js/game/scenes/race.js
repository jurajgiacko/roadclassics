/* Race scene — handles the actual top-down race using engine.js as
   the renderer. Pre-race overlays disappear, canvas + HUD become visible,
   engine.startRace() flips the waiting flag. */
(function () {
  let countdown = null;

  function hideAllPreraceOverlays() {
    document.querySelectorAll('.scene-overlay').forEach(el => el.classList.remove('show'));
  }
  function showCountdown(onDone) {
    countdown = document.createElement('div');
    countdown.className = 'race-countdown';
    countdown.innerHTML = `<div class="num" id="cd-num">3</div>`;
    document.body.appendChild(countdown);
    let n = 3;
    const tick = () => {
      const el = countdown.querySelector('#cd-num');
      if (!el) return;
      el.textContent = n;
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      n -= 1;
      if (n < 0) {
        countdown.querySelector('#cd-num').textContent = 'GO';
        setTimeout(() => {
          countdown && countdown.remove();
          countdown = null;
          onDone();
        }, 600);
      } else {
        setTimeout(tick, 800);
      }
    };
    tick();
  }

  async function enter() {
    hideAllPreraceOverlays();
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = '';
    /* Boot the engine if not yet booted */
    if (window.rcEngine && !window.rcEngine.getState().monument) {
      await window.rcEngine.boot();
    }
    /* Countdown then start */
    showCountdown(() => {
      window.rcEngine && window.rcEngine.startRace();
    });
  }
  async function exit() {
    if (countdown) { countdown.remove(); countdown = null; }
  }

  window.rcScenes.register('race', { enter, exit });
})();
