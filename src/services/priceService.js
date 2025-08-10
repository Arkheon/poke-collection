const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PRICE_CACHE = new Map();    // setId -> items résolus (objet)
const PRICE_PROMISES = new Map(); // setId -> Promise en cours

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

export async function getSetPrices(setId) {
  if (!setId) return {};
  if (PRICE_CACHE.has(setId)) return PRICE_CACHE.get(setId);
  if (PRICE_PROMISES.has(setId)) return PRICE_PROMISES.get(setId);

  const cached = readSetCache(setId);
  if (cached) { PRICE_CACHE.set(setId, cached); return cached; }

  const p = (async () => {
    try {
      // chemin relatif à index.html (OK sur GitHub Pages)
      const r = await fetch(`prices/${setId}.json`, { cache: 'no-store' });
      const j = await r.json();
      const items = j.items || {};
      PRICE_CACHE.set(setId, items);
      writeSetCache(setId, items);
      return items;
    } catch (e) {
      console.warn('prix non chargés', setId, e);
      PRICE_CACHE.delete(setId);
      return {};
    } finally {
      PRICE_PROMISES.delete(setId);
    }
  })();
  PRICE_PROMISES.set(setId, p);
  return p;
 }

export function peekPriceCache(setId) {
  const v = PRICE_CACHE.get(setId);
  return v && v !== 'loading' ? v : null;
}

