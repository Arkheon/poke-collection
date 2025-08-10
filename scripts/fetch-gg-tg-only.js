// scripts/fetch-gg-tg-only.js
import fs from 'node:fs/promises';

const API = 'https://api.pokemontcg.io/v2/cards';
const HEADERS = {
  'Accept': 'application/json',
  ...(process.env.POKEMONTCG_API_KEY ? {'X-Api-Key': process.env.POKEMONTCG_API_KEY} : {})
};

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
async function fetchWithRetry(url, tries=6){
  let t=0;
  for(;;){
    try{
      const r = await fetch(url,{headers:HEADERS});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    }catch(e){
      t++; if(t>=tries) throw e;
      const backoff = Math.min(15000, 600 * 2**(t-1)) + Math.random()*500;
      console.log(`Retry ${t}/${tries} in ${Math.round(backoff)}ms → ${url}`);
      await sleep(backoff);
    }
  }
}

function keyFromNumber(n){
  const m = String(n||'').match(/\d+/);
  return m ? String(+m[0]) : String(n||''); // "GG05" -> "5"
}

function mapPrices(cm){
  const p = cm?.prices || {};
  return {
    trend: Number(p.trendPrice ?? 0) || 0,
    avg7:  Number(p.avg7 ?? 0) || 0,
    avg30: Number(p.avg30 ?? 0) || 0,
    low:   Number(p.lowPrice ?? 0) || 0,
    // GG/TG n'ont pas de reverse → 0
    reverseTrend: 0
  };
}

async function buildOne(setId){
  console.log('Building', setId);
  let page=1, pageSize=250;
  const out = { setId, updatedAt: new Date().toISOString(), items:{} };

  for(;;){
    const url = `${API}?q=set.id:"${setId}"&select=number,cardmarket&page=${page}&pageSize=${pageSize}`;
    const json = await fetchWithRetry(url);
    const data = json?.data || [];
    for(const card of data){
      const k = keyFromNumber(card.number);
      out.items[k] = mapPrices(card.cardmarket);
    }
    if(data.length < pageSize) break;
    page++;
  }

  await fs.mkdir('public/prices', { recursive:true });
  await fs.writeFile(`public/prices/${setId}.json`, JSON.stringify(out), 'utf8');
  console.log('✔ Wrote public/prices/'+setId+'.json', Object.keys(out.items).length, 'items');
}

async function main(){
  const ids = process.argv.slice(2);
  if(!ids.length){
    console.error('Usage: node scripts/fetch-gg-tg-only.js swsh12pt5gg swsh12tg swsh11tg');
    process.exit(1);
  }
  for(const id of ids){
    try{ await buildOne(id); }catch(e){ console.warn('! Failed', id, e.message); }
  }
}
main();
