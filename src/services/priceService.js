// Base path robuste (GitHub Pages vs local)
const BASE_PATH =
  document.querySelector('base')?.getAttribute('href')
  || (location.pathname.startsWith('/poke-collection/') ? '/poke-collection/' : '/');

// services/priceService.js
const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PRICE_CACHE = new Map(); // setId -> items | 'loading'

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

function candidatePaths(setId){
  // essaie d’abord sans "public/", puis avec — compatible GH Pages & dev local
  return [
    `prices/${setId}.json`,
    `./prices/${setId}.json`,
    `public/prices/${setId}.json`,
    `./public/prices/${setId}.json`,
  ];
}

async function fetchFirstOk(setId){
  for(const url of candidatePaths(setId)){
    try{
      const r = await fetch(url, { cache: 'no-store' });
      if(r.ok){
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await r.json();
      }
    }catch(_){}
  }
  throw new Error(`prices for ${setId} not found in known paths`);
}

export async function getSetPrices(setId) {
  if (!setId) return {};
  if (PRICE_CACHE.has(setId) && PRICE_CACHE.get(setId) !== 'loading') {
    return PRICE_CACHE.get(setId);
  }

  const cached = readSetCache(setId);
  if (cached) { PRICE_CACHE.set(setId, cached); return cached; }

  PRICE_CACHE.set(setId, 'loading');
  try {
    // 1) chemin correct pour GitHub Pages (public/prices)
    let url = `${BASE_PATH}public/prices/${setId}.json`;
    let r = await fetch(url, { cache: 'no-store' });

    // 2) fallback facultatif si tu as une copie locale dans /prices
    if (!r.ok) {
      const alt = `${BASE_PATH}prices/${setId}.json`;
      r = await fetch(alt, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url} | alt ${alt}`);
    }

    const j = await r.json();
    const items = j.items || {};
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
