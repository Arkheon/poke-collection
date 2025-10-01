// Base path robuste (GitHub Pages vs local)
const BASE_PATH =
  document.querySelector('base')?.getAttribute('href')
  || (location.pathname.startsWith('/poke-collection/') ? '/poke-collection/' : '/');

// services/priceService.js
const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// In-memory cache and in-flight dedupe
// PRICE_CACHE: setId -> items object (including empty {})
// IN_FLIGHT: setId -> Promise<items>
const PRICE_CACHE = new Map();
const IN_FLIGHT = new Map();
// Known set list management
let KNOWN_SETS = null;               // list<string> or null if unavailable
let KNOWN_SETS_PROMISE = null;       // Promise dedup to avoid repeated 404s

let PRICE_BUNDLE = null;
let PRICE_BUNDLE_PROMISE = null;

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

async function ensureKnownSets(){
  if (KNOWN_SETS !== null) return KNOWN_SETS;
  if (KNOWN_SETS_PROMISE) return KNOWN_SETS_PROMISE;
  KNOWN_SETS_PROMISE = (async () => {
    // Try multiple candidate locations once to avoid multiple 404s.
    const candidates = [
      `${BASE_PATH}public/sets.json`,
      `${BASE_PATH}sets.json`,
    ];
    for (const url of candidates){
      try{
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok){
          const list = await r.json();
          if (Array.isArray(list)) {
            KNOWN_SETS = list;
            return KNOWN_SETS;
          }
        }
      }catch(_){}
    }
    // Not available; mark as checked so we don't retry on every call
    KNOWN_SETS = null;
    return KNOWN_SETS;
  })();
  return KNOWN_SETS_PROMISE;
}

export async function getSetPrices(setId) {
  if (!setId) return {};
  if (PRICE_CACHE.has(setId)) return PRICE_CACHE.get(setId);
  if (IN_FLIGHT.has(setId)) return IN_FLIGHT.get(setId);

  // If we know the list of built sets, skip fetch for unknown IDs to avoid 404 noise
  const known = await ensureKnownSets();
  const maybeSubset = /(tg|gg|sv)$/i.test(setId);
  if (known && !known.includes(setId) && !maybeSubset) {
    PRICE_CACHE.set(setId, {});
    return {};
  }

  const cached = readSetCache(setId);
  if (cached) { PRICE_CACHE.set(setId, cached); return cached; }

  const prom = (async () => {
    try {
      // 1) chemin correct pour GitHub Pages (public/prices)
      let url = `${BASE_PATH}public/prices/${setId}.json`;
      let r = await fetch(url, { cache: 'no-store' });

      // 2) fallback si nécessaire (ex: dev local)
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
      // Negative-cache in memory for this session to avoid repeated fetch/404
      PRICE_CACHE.set(setId, {});
      return {};
    } finally {
      IN_FLIGHT.delete(setId);
    }
  })();

  IN_FLIGHT.set(setId, prom);
  return prom;
}


export function peekPriceCache(setId) {
  const v = PRICE_CACHE.get(setId);
  return v && v !== 'loading' ? v : null;
}

export async function getPriceBundle(){
  if (PRICE_BUNDLE) return PRICE_BUNDLE;
  if (PRICE_BUNDLE_PROMISE) return PRICE_BUNDLE_PROMISE;

  const candidates = [
    `${BASE_PATH}public/prices/cards-bundle.json`,
    `${BASE_PATH}prices/cards-bundle.json`,
    `public/prices/cards-bundle.json`,
    `prices/cards-bundle.json`,
  ];

  PRICE_BUNDLE_PROMISE = (async () => {
    for (const url of candidates){
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok){
          const json = await r.json();
          if (json && json.cards){
            PRICE_BUNDLE = json;
            return PRICE_BUNDLE;
          }
        }
      } catch (_) {}
    }
    PRICE_BUNDLE = null;
    return null;
  })();

  return PRICE_BUNDLE_PROMISE;
}
