#!/usr/bin/env node
/**
 * Parse a GPX file from roadclassics.cz into a JSON usable by the game engine.
 *
 * Output schema:
 * {
 *   "id": "palava-long",
 *   "name": "Pálava long",
 *   "total_km": 123.4,
 *   "total_elev_m": 1450,
 *   "points": [
 *     { "distM": 0,    "ele": 194, "lat": 48.741, "lon": 16.755 },
 *     { "distM": 100,  "ele": 196, "lat": 48.742, "lon": 16.755 },
 *     ...
 *   ],
 *   "segments": [
 *     { "from_pct": 0, "to_pct": 12, "label": "Valtice → Lednice", "kind": "flat", "gradient": 0.4 },
 *     ...
 *   ]
 * }
 *
 * Usage:
 *   node tools/gpx-to-segments.mjs public/monuments/gpx/palava-long.gpx public/monuments/palava-real.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error('Usage: node tools/gpx-to-segments.mjs <input.gpx> <output.json>');
  process.exit(1);
}

const xml = readFileSync(inFile, 'utf8');

/* -- Crude GPX parser (regex over trkpt; sufficient for mapy.com output) -- */
const trkptRe = /<trkpt\s+lat="([0-9.\-]+)"\s+lon="([0-9.\-]+)">\s*<ele>([0-9.\-]+)<\/ele>\s*<\/trkpt>/g;
const nameRe  = /<name>([^<]+)<\/name>/;

const nameMatch = xml.match(nameRe);
const trackName = nameMatch ? nameMatch[1] : 'Track';

const raw = [];
let m;
while ((m = trkptRe.exec(xml)) !== null) {
  raw.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: parseFloat(m[3]) });
}
console.log(`Parsed ${raw.length} GPX points from "${trackName}"`);

/* -- Haversine distance between two points (meters) -- */
function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* -- Resample to fixed 100m intervals + smooth elevation -- */
const SAMPLE_M = 100;

let cumDist = 0;
const cumPoints = raw.map((p, i) => {
  if (i > 0) cumDist += haversine(raw[i - 1], p);
  return { ...p, distM: cumDist };
});
const totalDist = cumDist;
console.log(`Total distance: ${(totalDist / 1000).toFixed(2)} km`);

/* Sample at exact 100m intervals using linear interpolation along track */
function sampleAt(distM) {
  if (distM <= 0) return { ...cumPoints[0], distM: 0 };
  if (distM >= totalDist) return { ...cumPoints[cumPoints.length - 1], distM: totalDist };
  /* binary search */
  let lo = 0, hi = cumPoints.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumPoints[mid].distM < distM) lo = mid + 1; else hi = mid;
  }
  const a = cumPoints[Math.max(0, lo - 1)];
  const b = cumPoints[lo];
  const t = b.distM === a.distM ? 0 : (distM - a.distM) / (b.distM - a.distM);
  return {
    distM,
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    ele: a.ele + (b.ele - a.ele) * t
  };
}

const points = [];
for (let d = 0; d <= totalDist; d += SAMPLE_M) {
  points.push(sampleAt(d));
}

/* Elevation smoothing — moving average over 5 samples (500 m) */
function smooth(arr, key, w = 5) {
  const out = arr.map(p => ({ ...p }));
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, n = 0;
    for (let j = -w; j <= w; j++) {
      const k = i + j;
      if (k >= 0 && k < arr.length) { sum += arr[k][key]; n++; }
    }
    out[i][key] = sum / n;
  }
  return out;
}
const smoothed = smooth(points, 'ele', 5);

/* Total elevation gain (climbs only) */
let totalGain = 0;
for (let i = 1; i < smoothed.length; i++) {
  const dE = smoothed[i].ele - smoothed[i - 1].ele;
  if (dE > 0) totalGain += dE;
}
console.log(`Total elevation gain: ${totalGain.toFixed(0)} m`);

/* -- Auto-segment detection --
   Scan smoothed points; identify runs of climb / descent / flat by gradient. */
function gradientAt(i) {
  if (i === 0) return 0;
  const dD = smoothed[i].distM - smoothed[i - 1].distM;
  const dE = smoothed[i].ele - smoothed[i - 1].ele;
  return dD === 0 ? 0 : (dE / dD) * 100; // percent
}
function classify(g) {
  if (g >  1.5) return 'climb';
  if (g < -1.5) return 'descent';
  return 'flat';
}

/* Smooth gradient with a wider window so we don't fragment into tiny segs */
const grads = smoothed.map((_, i) => gradientAt(i));
const W = 10; // ±1 km moving average
const smoothGrads = grads.map((_, i) => {
  let sum = 0, n = 0;
  for (let j = -W; j <= W; j++) {
    const k = i + j;
    if (k >= 0 && k < grads.length) { sum += grads[k]; n++; }
  }
  return sum / n;
});

const rawSegs = [];
let curKind = classify(smoothGrads[1] || 0);
let curStart = 0, curGrads = [];
for (let i = 1; i < smoothGrads.length; i++) {
  const k = classify(smoothGrads[i]);
  curGrads.push(smoothGrads[i]);
  if (k !== curKind || i === smoothGrads.length - 1) {
    rawSegs.push({
      fromIdx: curStart, toIdx: i,
      kind: curKind,
      gradient: curGrads.reduce((a, c) => a + c, 0) / Math.max(1, curGrads.length)
    });
    curKind = k;
    curStart = i;
    curGrads = [];
  }
}

/* Merge tiny segments (<1.5 km) into neighbours */
const MIN_LEN_M = 1500;
function segLen(seg) { return smoothed[seg.toIdx].distM - smoothed[seg.fromIdx].distM; }

const segs = [];
for (const s of rawSegs) {
  if (segs.length && segLen(s) < MIN_LEN_M) {
    segs[segs.length - 1].toIdx = s.toIdx;
    /* keep dominant kind */
  } else {
    segs.push({ ...s });
  }
}

/* Recompute mean gradient + assign labels */
const segOut = segs.map((s, i) => {
  const len = smoothed[s.toIdx].distM - smoothed[s.fromIdx].distM;
  const dE = smoothed[s.toIdx].ele - smoothed[s.fromIdx].ele;
  const grad = len === 0 ? 0 : (dE / len) * 100;
  return {
    from_pct: +(smoothed[s.fromIdx].distM / totalDist * 100).toFixed(2),
    to_pct:   +(smoothed[s.toIdx].distM   / totalDist * 100).toFixed(2),
    kind:     s.kind,
    gradient: +grad.toFixed(2),
    len_km:   +(len / 1000).toFixed(2)
  };
});

console.log(`Detected ${segOut.length} segments`);
for (const s of segOut) {
  console.log(`  ${s.from_pct.toString().padStart(5)}–${s.to_pct.toString().padStart(5)} %  ${s.kind.padEnd(7)}  ${s.gradient >= 0 ? '+' : ''}${s.gradient}%  ${s.len_km} km`);
}

/* Output: keep points slim by storing only every 5th (i.e. every 500 m) */
const slimPoints = points.filter((_, i) => i % 5 === 0).map(p => ({
  distM: Math.round(p.distM),
  ele:   +p.ele.toFixed(1),
  lat:   +p.lat.toFixed(6),
  lon:   +p.lon.toFixed(6)
}));

const id = inFile.match(/([a-z]+(?:-[a-z]+)?)\.gpx$/)?.[1] || 'track';
const result = {
  id,
  name: trackName,
  source: inFile.replace(/^.*\//, ''),
  total_km:     +(totalDist / 1000).toFixed(2),
  total_elev_m: Math.round(totalGain),
  sample_step_m: 500,
  points: slimPoints,
  segments: segOut
};

writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`\n→ Wrote ${outFile} (${slimPoints.length} sampled points, ${segOut.length} segments)`);
