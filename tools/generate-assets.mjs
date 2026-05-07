#!/usr/bin/env node
/**
 * Generate Road Classics × Enervit illustration assets via Gemini Nano Banana
 * (gemini-2.5-flash-image).
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node tools/generate-assets.mjs              # generate missing
 *   GEMINI_API_KEY=xxx node tools/generate-assets.mjs --force      # regenerate all
 *   GEMINI_API_KEY=xxx node tools/generate-assets.mjs --only=devin-climb,reistna-kolonada
 *
 * Env:
 *   GEMINI_API_KEY            required — from https://aistudio.google.com/app/apikey
 *   GEMINI_MODEL              optional — default "gemini-2.5-flash-image"
 *   CONCURRENCY               optional — default 3
 *
 * Output:
 *   public/assets/scenes/<category>/<id>.png  (1024px-ish, aspect-ratio respected)
 *
 * Idempotent: skips assets whose PNG already exists unless --force.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST = resolve(ROOT, 'tools/assets-manifest.json');
const SCENE_DIR = resolve(ROOT, 'public/assets/scenes');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);

if (!API_KEY) {
  console.error('✗ GEMINI_API_KEY not set. Get one at https://aistudio.google.com/app/apikey');
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const { styleAnchor, negativePrompt, assets } = manifest;

const targets = assets.filter(a => !ONLY || ONLY.has(a.id));
console.log(`▶ ${targets.length} asset(s) to consider · model=${MODEL} · concurrency=${CONCURRENCY}`);

function outPath(asset) {
  return resolve(SCENE_DIR, asset.category, `${asset.id}.png`);
}

function buildFullPrompt(asset) {
  /* Per-asset style overrides the global anchor (e.g., for isolated product
     icons we don't want the landscape/character vignette mood). */
  const style = asset.style || styleAnchor;
  const neg   = asset.negativePrompt || negativePrompt;
  return [
    asset.prompt.trim().replace(/\.$/, ''),
    style.trim(),
    neg ? `Avoid: ${neg}` : ''
  ].filter(Boolean).join('. ') + '.';
}

async function generateOne(asset) {
  const out = outPath(asset);
  if (!FORCE && existsSync(out)) {
    return { id: asset.id, skipped: true, path: out };
  }
  mkdirSync(dirname(out), { recursive: true });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: buildFullPrompt(asset) }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(asset.aspect && { imageConfig: { aspectRatio: asset.aspect } })
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 400)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.data || p.inline_data?.data);
  const dataB64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!dataB64) {
    throw new Error('No image in response: ' + JSON.stringify(json).slice(0, 400));
  }
  writeFileSync(out, Buffer.from(dataB64, 'base64'));
  return { id: asset.id, path: out, bytes: Buffer.byteLength(dataB64, 'base64') };
}

/* Concurrency-limited dispatcher */
async function runAll() {
  const queue = [...targets];
  const results = [];
  const errors  = [];
  let inflight = 0;
  let nextIdx  = 0;

  return new Promise((resolveAll) => {
    function pump() {
      while (inflight < CONCURRENCY && nextIdx < queue.length) {
        const asset = queue[nextIdx++];
        inflight++;
        const t0 = Date.now();
        generateOne(asset)
          .then((r) => {
            const dt = ((Date.now() - t0) / 1000).toFixed(1);
            if (r.skipped) console.log(`  · skip ${asset.id} (already exists)`);
            else            console.log(`  ✓ ${asset.id.padEnd(28)} ${(r.bytes / 1024).toFixed(0)} KB · ${dt}s`);
            results.push(r);
          })
          .catch((e) => {
            console.error(`  ✗ ${asset.id}: ${e.message}`);
            errors.push({ id: asset.id, error: e.message });
          })
          .finally(() => {
            inflight--;
            if (inflight === 0 && nextIdx >= queue.length) resolveAll({ results, errors });
            else pump();
          });
      }
    }
    pump();
  });
}

const t0 = Date.now();
const { results, errors } = await runAll();
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n▶ done in ${dt}s · ${results.filter(r => !r.skipped).length} generated · ${results.filter(r => r.skipped).length} skipped · ${errors.length} errors`);

/* Sync public manifest so the browser sees what's available */
const publicManifest = resolve(SCENE_DIR, 'manifest.json');
writeFileSync(publicManifest, JSON.stringify(manifest, null, 2));
console.log(`▶ synced ${publicManifest}`);

if (errors.length) {
  console.log('\nFailed assets:');
  for (const e of errors) console.log(`  - ${e.id}: ${e.error}`);
  process.exit(1);
}
