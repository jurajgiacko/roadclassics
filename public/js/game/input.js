/* Input — top-down arcade controls.
   - Steering: device tilt (gamma) on mobile (with permission gesture on iOS),
     fallback to tap-left / tap-right thirds, plus arrow keys / A-D on desktop
   - Boost: spacebar / ArrowUp on desktop, tap+hold center third on mobile
   - laneInput() returns smooth -1..+1 (left to right)
   - isPressing() returns true while boost is held
*/
(function () {
  let pressing = false;            // boost button held
  let tiltGamma = 0;               // raw gamma reading
  let tiltNeutral = null;          // calibrated zero
  let tiltAvailable = false;       // sensor delivered any reading
  let tapLane = 0;                 // -1, 0, +1 from tap thirds
  let keyLane = 0;                 // -1, 0, +1 from arrow keys

  function down() { pressing = true; }
  function up()   { pressing = false; }

  /* ---- Keyboard ---- */
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space')                                 { e.preventDefault(); down(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW')     { e.preventDefault(); down(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA')   { keyLane = -1; }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD')  { keyLane = +1; }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space')                                 { e.preventDefault(); up(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW')     { e.preventDefault(); up(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA')   { if (keyLane === -1) keyLane = 0; }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD')  { if (keyLane === +1) keyLane = 0; }
  });

  /* ---- Touch (tap-zone thirds) ---- */
  const tap = document.getElementById('tap-zone');
  function classifyTouch(clientX) {
    const x = clientX / window.innerWidth;
    if (x < 0.33) return 'left';
    if (x > 0.67) return 'right';
    return 'center';
  }
  if (tap) {
    const passive = { passive: false };
    tap.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const zone = classifyTouch(t.clientX);
      if (zone === 'left')  { tapLane = -1; }
      else if (zone === 'right') { tapLane = +1; }
      else { down(); /* center = boost */ }
    }, passive);
    tap.addEventListener('touchend',   (e) => { e.preventDefault(); tapLane = 0; up(); }, passive);
    tap.addEventListener('touchcancel',(e) => { e.preventDefault(); tapLane = 0; up(); }, passive);
    /* mouse for desktop preview testing */
    tap.addEventListener('mousedown', (e) => {
      const zone = classifyTouch(e.clientX);
      if (zone === 'left')  tapLane = -1;
      else if (zone === 'right') tapLane = +1;
      else down();
    });
    tap.addEventListener('mouseup',    () => { tapLane = 0; up(); });
    tap.addEventListener('mouseleave', () => { tapLane = 0; up(); });
  }

  /* ---- Device orientation (tilt) ---- */
  function attachTiltListener() {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      tiltAvailable = true;
      tiltGamma = e.gamma;
      if (tiltNeutral == null) tiltNeutral = e.gamma; // first reading = neutral
    }, true);
  }

  /* iOS 13+ requires explicit permission via user gesture. */
  function requestTiltPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      return DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') attachTiltListener();
          return state === 'granted';
        })
        .catch(() => false);
    }
    /* Android / desktop don't need permission */
    attachTiltListener();
    return Promise.resolve(true);
  }

  /* Recalibrate neutral position to the player's current hand pose. */
  function recalibrateTilt() { tiltNeutral = tiltGamma; }

  /* Smooth lane target from active source. Tilt wins if available. */
  function laneInput() {
    if (tiltAvailable && tiltNeutral != null) {
      /* ±20° tilt = full lane swing */
      const delta = tiltGamma - tiltNeutral;
      return Math.max(-1, Math.min(1, delta / 20));
    }
    /* keyboard takes precedence over tap if both nonzero */
    if (keyLane !== 0) return keyLane;
    return tapLane;
  }

  window.rcInput = {
    isPressing: () => pressing,
    laneInput,
    hasTilt: () => tiltAvailable,
    requestTiltPermission,
    recalibrateTilt
  };
})();
