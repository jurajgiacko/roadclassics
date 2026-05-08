/* Sprite renderer — preload illustrated PNG assets and draw them into canvas
   contexts as full-bleed backgrounds, scrolling parallax layers, or single
   sprite icons. Replaces the procedural draw functions used in early iters. */
(function () {
  const cache = new Map();   // id → HTMLImageElement
  const failed = new Set();
  let manifest = null;       // loaded /assets/scenes/manifest.json

  /* A no-op transparent 1×1 used while loading or when the asset is missing,
     so renders don't blow up. */
  const blank = new Image();
  blank.src =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

  /* Sprites that need their off-white background stripped before
     compositing on the gameplay landscape backdrop. Without this they
     show as a square box behind the subject. */
  const NEEDS_CHROMA = new Set([
    'cyclist-player-topdown',
    'peloton-rider-1', 'peloton-rider-2', 'peloton-rider-3', 'peloton-rider-4',
    'station-gel', 'station-bar', 'station-drink',
    'station-jelly', 'station-chews', 'station-caffeine'
  ]);

  /* Strip near-white pixels from the loaded image. Result is a canvas
     element which drawImage accepts identically to an HTMLImageElement. */
  function chromaKeyToCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    let data;
    try { data = cx.getImageData(0, 0, c.width, c.height); }
    catch (e) { /* CORS-tainted, return raw */ return img; }
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const min = Math.min(r, g, b);
      /* Pure off-white background → fully transparent */
      if (r > 235 && g > 235 && b > 235) {
        px[i + 3] = 0;
      } else if (min > 215) {
        /* Soft edge AA fade */
        const t = (min - 215) / 20; // 0..1 over the soft band
        px[i + 3] = Math.max(0, Math.floor(px[i + 3] * (1 - t)));
      }
    }
    cx.putImageData(data, 0, 0);
    return c;
  }

  function load(id) {
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    if (failed.has(id)) return Promise.resolve(blank);
    const meta = manifest?.assets.find(a => a.id === id);
    if (!meta) {
      failed.add(id);
      console.warn('[sprite] missing manifest entry for', id);
      return Promise.resolve(blank);
    }
    const url = `/assets/scenes/${meta.category}/${id}.png`;
    return new Promise((resolve) => {
      const img = new Image();
      /* Same-origin asset — no need for crossOrigin (which would require
         explicit ACAO headers and could fail loading). */
      img.onload = () => {
        const finalAsset = NEEDS_CHROMA.has(id) ? chromaKeyToCanvas(img) : img;
        /* expose width/height like Image for drawImage compatibility */
        if (finalAsset.tagName === 'CANVAS') {
          finalAsset.naturalWidth = finalAsset.width;
          finalAsset.naturalHeight = finalAsset.height;
        }
        cache.set(id, finalAsset);
        resolve(finalAsset);
      };
      img.onerror = () => {
        failed.add(id);
        console.warn('[sprite] failed to load', url);
        resolve(blank);
      };
      img.src = url;
    });
  }

  /* Preload a list of asset IDs in parallel and return when all settle. */
  async function preload(ids) {
    return Promise.all(ids.map(load));
  }

  /* Lookup synchronously — returns the cached image or blank. */
  function get(id) {
    return cache.get(id) || blank;
  }

  /* Return the cached asset as a PNG Data URL — useful when something
     external (e.g. a MapLibre <img> marker) needs the chroma-keyed version
     instead of the raw network PNG. */
  function getDataUrl(id) {
    const a = cache.get(id);
    if (!a) return null;
    try {
      if (a.tagName === 'CANVAS') return a.toDataURL('image/png');
      /* For raw images that didn't go through chroma-key, draw to canvas */
      const c = document.createElement('canvas');
      c.width = a.naturalWidth || a.width;
      c.height = a.naturalHeight || a.height;
      c.getContext('2d').drawImage(a, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }

  /* ---- Drawing helpers ---- */

  /* Cover-fit: scale image to fully cover (cx,cy,cw,ch) keeping aspect ratio.
     Crops overflow. Useful for backgrounds. */
  function drawCover(ctx, id, cx, cy, cw, ch) {
    const img = get(id);
    if (!img.width || !img.height) return;
    const ar = img.width / img.height;
    const target = cw / ch;
    let dw, dh, dx, dy;
    if (ar > target) {
      dh = ch;
      dw = ch * ar;
      dx = cx - (dw - cw) / 2;
      dy = cy;
    } else {
      dw = cw;
      dh = cw / ar;
      dx = cx;
      dy = cy - (dh - ch) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* Contain-fit: scale to fit inside (cx,cy,cw,ch) with letterboxing. */
  function drawContain(ctx, id, cx, cy, cw, ch) {
    const img = get(id);
    if (!img.width || !img.height) return;
    const ar = img.width / img.height;
    const target = cw / ch;
    let dw, dh, dx, dy;
    if (ar > target) {
      dw = cw;
      dh = cw / ar;
      dx = cx;
      dy = cy + (ch - dh) / 2;
    } else {
      dh = ch;
      dw = ch * ar;
      dx = cx + (cw - dw) / 2;
      dy = cy;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* Centered draw at (cx, cy) with given height; width derived from image AR. */
  function drawCentered(ctx, id, cx, cy, height, opts = {}) {
    const img = get(id);
    if (!img.width || !img.height) return;
    const ar = img.width / img.height;
    const w = height * ar;
    const x = cx - w / 2;
    const y = cy - height / 2;
    if (opts.alpha != null) {
      ctx.save();
      ctx.globalAlpha = opts.alpha;
      ctx.drawImage(img, x, y, w, height);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, w, height);
    }
  }

  /* Tiled horizontal scroll for parallax layers (e.g., hills, vineyards).
     `offset` shifts the layer leftwards; image repeats to fill width. */
  function drawHTile(ctx, id, x, y, w, h, offset = 0) {
    const img = get(id);
    if (!img.width || !img.height) return;
    const tileW = h * (img.width / img.height);
    const start = -((offset % tileW) + tileW) % tileW;
    for (let dx = start; dx < x + w; dx += tileW) {
      ctx.drawImage(img, x + dx, y, tileW, h);
    }
  }

  async function setManifest(m) {
    manifest = m;
  }
  async function loadManifest(url = '/assets/scenes/manifest.json') {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (err) {
      console.warn('[sprite] no manifest.json — copy tools/assets-manifest.json there once assets are generated', err);
      manifest = { assets: [] };
    }
    return manifest;
  }

  window.rcSprites = {
    setManifest, loadManifest, preload, load, get, getDataUrl,
    drawCover, drawContain, drawCentered, drawHTile
  };
})();
