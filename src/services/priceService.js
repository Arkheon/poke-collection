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

export async function getSetPrices(setId) {
  if (!setId) return {};
  if (PRICE_CACHE.has(setId) && PRICE_CACHE.get(setId) !== 'loading') return PRICE_CACHE.get(setId);

  const cached = readSetCache(setId);
  if (cached) { PRICE_CACHE.set(setId, cached); return cached; }

  PRICE_CACHE.set(setId, 'loading');
  try {
    const r = await fetch(`public/prices/${setId}.json`, { cache: 'no-store' });
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

