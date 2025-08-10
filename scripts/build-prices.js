// scripts/build-prices.js
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.pokemontcg.io/v2';
const PRICE_DIR = path.join('public', 'prices');
const FR_MAP_FILE = path.join('data', 'fr_map.json');

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return await res.json();
}

async function buildSetPrices(setId){
  let page = 1;
  const pageSize = 250;
  const out = { setId, updatedAt: new Date().toISOString(), items: {} };

  while(true){
    const url = `${API}/cards?q=set.id:"${setId}"&select=number,cardmarket&page=${page}&pageSize=${pageSize}`;
    const json = await fetchJSON(url);
    const data = json?.data ?? [];
    for(const c of data){
      const p = c?.cardmarket?.prices || {};
      out.items[c.number] = {
        trend: p.trendPrice ?? null,
        avg7: p.avg7 ?? null,
        avg30: p.avg30 ?? null,
        low: p.lowPrice ?? null,
        reverseTrend: p.reverseHoloTrend ?? null,
        url: c?.cardmarket?.url ?? null,
        updatedAt: c?.cardmarket?.updatedAt ?? null
      };
    }
    if(data.length < pageSize) break;
    page += 1;
    await sleep(150);
  }
  return out;
}

async function main(){
  ensureDir(PRICE_DIR);

  const frMap = JSON.parse(fs.readFileSync(FR_MAP_FILE, 'utf8'));

  const setIds = Array.from(new Set(Object.values(frMap))).filter(Boolean);

  const MAX_CONCURRENCY = 4;
  let i = 0;
  async function worker(){
    while(i < setIds.length){
      const id = setIds[i++];
      console.log('Building prices for', id);
      const obj = await buildSetPrices(id);
      fs.writeFileSync(path.join(PRICE_DIR, `${id}.json`), JSON.stringify(obj));
    }
  }
  await Promise.all(Array.from({length: Math.min(MAX_CONCURRENCY, setIds.length)}, worker));

  fs.writeFileSync('public/sets.json', JSON.stringify(setIds));
  console.log('Done. Files in public/prices/*.json');
}

main().catch(err => { console.error(err); process.exit(1); });
