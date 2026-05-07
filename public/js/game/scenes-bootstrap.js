/* Scenes bootstrap — preload manifest + assets, register all scenes, start
   at intro. This is the single entry point that wires the whole multi-stage
   day flow together. */
(async function () {
  /* Preload the manifest so sprite renderer knows what's available */
  if (window.rcSprites) {
    await window.rcSprites.loadManifest('/assets/scenes/manifest.json');
    /* Preload key landscape and prerace images so the first scene transitions
       are instant. Other assets lazy-load on first use. */
    await window.rcSprites.preload([
      'valtice-morning',
      'kitchen-breakfast',
      'garage-bike-check',
      'jersey-packing',
      'drive-to-start'
    ]);
  }

  /* Start the scene loop */
  if (window.rcScenes) {
    window.rcScenes.start();
    window.rcScenes.go('intro');
  } else {
    console.error('[bootstrap] rcScenes not available');
  }
})();
