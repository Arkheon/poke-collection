// scripts/quick-prices.js
// Usage: node scripts/quick-prices.js swsh12pt5gg swsh12tg swsh11tg
// Requiert: POKEMONTCG_API_KEY

import fs from 'node:fs/promises';

const API = 'https://api.pokemontcg.io/v2/cards';
const KEY = process.env.POKEMONTCG_API_KEY;
if (!KEY) {
  console.error('POKEMONTCG_API_KEY manquant');
  process.exit(1);
}

const setIds = process.argv.slice(2);
if (!setIds.length) {
  console.error('Donne au moins 1 setId. Exemple: node scripts/quick-prices.js swsh12pt5gg');
  process.exit(1);
}

async function fetchAll(setId){
  let page = 1, out = {};
  while (true) {
    const url = `${API}?q=set.id:"${setId}"&select=number,cardmarket&page=${page}&pageSize=250`;
    const r = await fetch(url, { headers: { 'X-Api-Key': KEY }});
    if (!r.ok) {
      console.warn(`! ${setId} page ${page}: HTTP ${r.status}`);
      break;
    }
    const { data } = await r.json();
    if (!data || !data.length) break;

    for (const c of data) {
      const numRaw = String(c.number || '');
      const idx = Number(numRaw.replace(/[^0-9]/g, '')); // GG05 -> 5, TG30 -> 30
      const p = c.cardmarket?.prices || {};
      out[idx] = {
        trend:        p.trendPrice ?? p.averageSellPrice ?? p.avg30 ?? p.avg7 ?? 0,
        avg7:         p.avg7 ?? 0,
        avg30:        p.avg30 ?? 0,
        low:          p.lowPrice ?? p.suggestedPrice ?? 0,
        reverseTrend: p.reverseHoloTrend ?? p.reverseHoloSell ?? 0,
        url: `https://prices.pokemontcg.io/cardmarket/${setId}-${numRaw}`,
        updatedAt: new Date().toISOString().slice(0,10).replaceAll('-','/'),
      };
    }
    page += 1;
  }
  return { setId, updatedAt: new Date().toISOString(), items: out };
}

for (const id of setIds) {
  console.log('Building quick prices for', id);
  const res = await fetchAll(id);
  await fs.mkdir('data/prices', { recursive: true });
  await fs.writeFile(`data/prices/${id}.json`, JSON.stringify(res), 'utf8');
  console.log('→ data/prices/%s.json (%d items)', id, Object.keys(res.items).length);
}
