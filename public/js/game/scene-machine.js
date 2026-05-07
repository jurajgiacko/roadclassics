/* Scene state machine — orchestruje multi-stage Pálava day.
   Každá scéna má enter(state, ctx) / exit() / render(ctx) / tick(dt).
   Prechody cez window.rcScenes.go(id, payload). */
(function () {
  const scenes = new Map();
  let current = null;
  let pendingPayload = null;

  /* Shared global state spanning all scenes — persistuje progres celého dňa */
  const journey = {
    monumentId: 'palava-long',
    monument: null,
    /* preparation outcomes */
    breakfast: null,        // 'eggs' | 'oats' | 'croissant'
    bikeChecked: false,
    tirePressure: 0,
    pocketsLoaded: { gel: 0, bar: 0, drink: 0 },
    prepBonusEnergy: 0,
    /* race outcomes (set by race scene) */
    finishTime: 0,
    finishEnergy: 100,
    pickupsCollected: 0,
    styleLog: [],
    score: 0,
    /* meta */
    startedAt: 0,
    finishedAt: 0
  };

  function register(id, scene) {
    scenes.set(id, scene);
  }

  async function go(id, payload = null) {
    const next = scenes.get(id);
    if (!next) {
      console.error('[scene] unknown scene:', id);
      return;
    }
    if (current && current.exit) {
      try { await current.exit(); } catch (e) { console.error('[scene] exit failed:', e); }
    }
    pendingPayload = payload;
    current = next;
    document.body.dataset.scene = id;
    if (current.enter) {
      try { await current.enter(journey, payload); }
      catch (e) { console.error('[scene] enter failed:', e); }
    }
    window.rcTrack && window.rcTrack('scene_enter', { scene: id });
  }

  /* Per-frame loop — engine.js used to drive RAF; the machine takes it over */
  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (current && current.tick) current.tick(dt);
    if (current && current.render) current.render(dt);
    requestAnimationFrame(loop);
  }

  function start() {
    requestAnimationFrame(loop);
  }

  function getJourney() { return journey; }
  function getCurrentId() {
    for (const [id, s] of scenes) if (s === current) return id;
    return null;
  }

  window.rcScenes = { register, go, start, journey: getJourney, currentId: getCurrentId };
})();
