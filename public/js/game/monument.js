/* Monument loader. Reads /monuments/<id>.json and exposes a small API
   to render the elevation profile and resolve gradient at a given pct. */
(function () {
  async function load(id) {
    const res = await fetch(`/monuments/${id}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Monument ${id} not found`);
    return await res.json();
  }

  function gradientAtPct(monument, pct) {
    const seg = monument.segments.find(s => pct >= s.from_pct && pct < s.to_pct);
    return seg ? seg.gradient : 0;
  }

  function segmentAtPct(monument, pct) {
    return monument.segments.find(s => pct >= s.from_pct && pct < s.to_pct) || null;
  }

  /* Build a smoothed elevation polyline (in 0..1 space) from segment gradients,
     so the mini-map can render a continuous path. */
  function buildElevationPath(monument, samples = 100) {
    const points = [];
    let elevation = 0;
    let minE = 0, maxE = 0;
    for (let i = 0; i <= samples; i++) {
      const pct = (i / samples) * 100;
      const g = gradientAtPct(monument, pct);
      elevation += g * 0.35;
      minE = Math.min(minE, elevation);
      maxE = Math.max(maxE, elevation);
      points.push({ x: pct, e: elevation });
    }
    const range = (maxE - minE) || 1;
    return points.map(p => ({ x: p.x, y: 1 - (p.e - minE) / range }));
  }

  function renderProfileSvg(svgEl, points) {
    if (!svgEl) return;
    const w = 100, h = 30;
    const top = points.map(p => `${p.x.toFixed(2)},${(p.y * (h - 4) + 1).toFixed(2)}`).join(' ');
    svgEl.innerHTML = `
      <polygon points="0,${h} ${top} ${w},${h}" fill="rgba(228,203,157,0.18)"/>
      <polyline points="${top}" fill="none" stroke="rgba(228,203,157,0.65)" stroke-width="0.6"/>
    `;
  }

  window.rcMonument = { load, gradientAtPct, segmentAtPct, buildElevationPath, renderProfileSvg };
})();
