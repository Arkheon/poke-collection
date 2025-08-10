// src/services/priceService.js

const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PRICE_CACHE = new Map(); // setId -> items | 'loading'

// ---- localStorage cache ----
function readSetCache(setId) {
  try {
    const raw = localStorage.getItem('ptcg_prices_' + setId);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (Date.now() - o.ts > PRICE_TTL_MS) return null;
    return o.items || null;
  } catch { return null; }
}

function writeSetCache(setId, items) {
  try {
    localStorage.setItem('ptcg_prices_' + setId, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

// ---- fetch helpers (chemins fallback) ----
function getUrlCandidates(setId){
  return [
    `prices/${setId}.json`,
    `./prices/${setId}.json`,
    `public/prices/${setId}.json`,
    `/public/prices/${setId}.json`,
  ];
}

async function fetchWithFallback(setId){
  const urls = getUrlCandidates(setId);
  let lastErr = null;
  for (const url of urls){
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) { lastErr = new Error(`${r.status} ${r.statusText}`); continue; }
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No price source reachable');
}

// ---- public API ----
export async function getSetPrices(setId) {
  if (!setId) return {};
  const inMem = PRICE_CACHE.get(setId);
  if (inMem && inMem !== 'loading') return inMem;

  const cached = readSetCache(setId);
  if (cached) { PRICE_CACHE.set(setId, cached); return cached; }

  PRICE_CACHE.set(setId, 'loading');
  try {
    const j = await fetchWithFallback(setId);
    const items = (j && j.items) || {};
    PRICE_CACHE.set(setId, items);
    writeSetCache(setId, items);
    return items;
  } catch (e) {
    console.warn('prix non chargés', setId, e);
    PRICE_CACHE.delete(setId);
    return {};
  }
}

export function peekPriceCache(setId) {
  const v = PRICE_CACHE.get(setId);
  return v && v !== 'loading' ? v : null;
}
