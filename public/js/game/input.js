/* Input handler — desktop spacebar + mobile touch.
   Exposes window.rcInput.isPressing() so engine can poll per frame. */
(function () {
  let pressing = false;

  function down() { pressing = true; }
  function up()   { pressing = false; }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); down(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { e.preventDefault(); up(); }
  });

  const tap = document.getElementById('tap-zone');
  if (tap) {
    const opts = { passive: false };
    tap.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, opts);
    tap.addEventListener('touchend',   (e) => { e.preventDefault(); up();   }, opts);
    tap.addEventListener('touchcancel',(e) => { e.preventDefault(); up();   }, opts);
    tap.addEventListener('mousedown',  () => down());
    tap.addEventListener('mouseup',    () => up());
    tap.addEventListener('mouseleave', () => up());
  }

  window.rcInput = {
    isPressing: () => pressing
  };
})();
