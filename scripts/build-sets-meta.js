// scripts/build-sets-meta.js (Node 20+, ESM)
// Build-time helper: fetches set metadata (series + icons) from Pokémon TCG API
// and writes a static cache for the frontend to consume (no runtime network).
//
// Output:
// - public/sets_meta.json: { byId: { [setId]: { series, seriesKey, symbol } } }
// - public/set-icons/<setId>.png: local copy of set symbol (if downloadable)
//
// Usage: node scripts/build-sets-meta.js

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.pokemontcg.io/v2';
const OUT_JSON = path.join('public', 'sets_meta.json');
const ICON_DIR = path.join('public', 'set-icons');
const PAGE_SIZE = 250;

const HEADERS = process.env.PTCG_API_KEY ? { 'X-Api-Key': process.env.PTCG_API_KEY } : {};

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSONWithRetry(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
      if ([429, 500, 502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}`);
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0,120)}`);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
}

function seriesKey(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s*&\s*/g,'-').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

async function downloadIcon(url, outPath) {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return false;
    const ab = await r.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(ab));
    return true;
  } catch { return false; }
}

async function main() {
  ensureDir('public');
  ensureDir(ICON_DIR);

  // Fetch all sets (paged)
  let page = 1;
  const byId = {};
  while (true) {
    const url = `${API}/sets?page=${page}&pageSize=${PAGE_SIZE}&select=id,series,images`;
    const json = await fetchJSONWithRetry(url);
    const arr = json?.data || [];
    if (!arr.length) break;
    for (const s of arr) {
      const id = s?.id; if (!id) continue;
      const series = s?.series || '';
      const sKey = seriesKey(series);
      const symbolUrl = s?.images?.symbol || '';
      let localSymbol = '';
      if (symbolUrl) {
        const out = path.join(ICON_DIR, `${id}.png`);
        const ok = await downloadIcon(symbolUrl, out);
        if (ok) localSymbol = `public/set-icons/${id}.png`;
      }
      byId[id] = { series, seriesKey: sKey, symbol: localSymbol || symbolUrl || '' };
    }
    if (arr.length < PAGE_SIZE) break;
    page += 1;
    await sleep(250);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ byId }, null, 2));
  console.log('Wrote', OUT_JSON, 'with', Object.keys(byId).length, 'sets');
}

main().catch(e => { console.error(e); process.exit(1); });
