// scripts/build-prices.js (Node 20, ESM)
import fs from "node:fs";
import path from "node:path";

const API = "https://api.pokemontcg.io/v2";
const PRICE_DIR = path.join("public", "prices");
const FR_MAP_FILE = path.join("data", "fr_map.json");
const CARDS_CSV = path.join("cartes.csv");

// Réglages
const MAX_CONCURRENCY = 2;     // ↓ charge coté API
const PAGE_SIZE       = 250;
const RETRIES         = 6;     // nb de tentatives par requête
const BASE_DELAY_MS   = 600;   // backoff de base
const BETWEEN_PAGES_MS= 400;   // pause entre pages d’un même set

const HEADERS = process.env.PTCG_API_KEY ? { "X-Api-Key": process.env.PTCG_API_KEY } : {};

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchJSONWithRetry(url, tries = RETRIES){
  for (let i = 0; i < tries; i++){
    try{
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
      // Statuts “retryables”
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Sinon, inutile d’insister
      const body = await res.text().catch(()=> "");
      throw new Error(`HTTP ${res.status} ${body.slice(0,120)}`);
    }catch(err){
      const last = i === tries - 1;
      if (last) throw err;
      const wait = (i+1)*(i+1)*BASE_DELAY_MS + Math.floor(Math.random()*400);
      console.warn(`Retry ${i+1}/${tries} in ${wait}ms → ${url}`);
      await sleep(wait);
    }
  }
}

async function buildSetPrices(setId){
  let page = 1;
  const out = { setId, updatedAt: new Date().toISOString(), items: {} };

  while (true){
    const url = `${API}/cards?q=set.id:"${setId}"&select=number,cardmarket&page=${page}&pageSize=${PAGE_SIZE}`;
    try{
      const json = await fetchJSONWithRetry(url);
      const data = json?.data ?? [];
      for (const c of data){
        const p = c?.cardmarket?.prices || {};
        out.items[c.number] = {
          trend: p.trendPrice ?? null,
          avg7: p.avg7 ?? null,
          avg30: p.avg30 ?? null,
          low: p.lowPrice ?? null,
          reverseTrend: p.reverseHoloTrend ?? null,
          url: c?.cardmarket?.url ?? null,
          updatedAt: c?.cardmarket?.updatedAt ?? null,
        };
      }
      if (data.length < PAGE_SIZE) break;  // fin du set
      page += 1;
      await sleep(BETWEEN_PAGES_MS);
    }catch(err){
      // Si une page refuse de répondre après retries, on abandonne ce set mais on n’arrête pas tout le job
      console.error(`! Abandon set ${setId} page ${page}: ${err.message}`);
      break;
    }
  }
  return out;
}

// ==== Discover only needed sets from cartes.csv + fr_map.json ====
function normalizeNFC(s){ return (s ?? "").normalize('NFC').trim().replace(/\s+/g,' '); }
function slugify(s){
  const nfd = normalizeNFC(s).normalize('NFD');
  const noAcc = nfd.replace(/[\u0300-\u036f]/g,'');
  return noAcc.toLowerCase();
}

function readFRMapBySlug(){
  const raw = fs.readFileSync(FR_MAP_FILE, 'utf8');
  const map = JSON.parse(raw);
  const out = {};
  for (const [k,v] of Object.entries(map)) out[slugify(k)] = v;
  return out;
}

function detectUsedSets({ frBySlug }){
  let txt;
  try { txt = fs.readFileSync(CARDS_CSV, 'utf8'); }
  catch { return []; }

  const lines = txt.split(/\r?\n/);
  if (!lines.length) return [];
  const header = lines[0].split('\t');
  const idxSerie = header.findIndex(h => /s[ée]rie/i.test(h));
  const idxNum   = header.findIndex(h => /num[ée]ro/i.test(h));
  if (idxSerie === -1) return [];

  // group by slug, detect subsets present
  const used = new Map(); // slug -> { mainId, gg:false, tg:false, sv:false }
  for (let i=1;i<lines.length;i++){
    const L = lines[i]; if (!L) continue;
    const cols = L.split('\t'); if (cols.length <= idxSerie) continue;
    const serieRaw = cols[idxSerie];
    const numRaw = (idxNum !== -1 ? cols[idxNum] : '') || '';
    const slug = slugify(serieRaw);
    const mainId = frBySlug[slug];
    if (!mainId) continue; // ignore unmapped series
    const obj = used.get(slug) || { mainId, gg:false, tg:false, sv:false };
    const num = String(numRaw).trim().toUpperCase();
    if (/^GG\d+/.test(num)) obj.gg = true;
    if (/^TG\d+/.test(num)) obj.tg = true;
    if (/^(SV\d+|SV\d+\/\d+)/.test(num)) obj.sv = true;
    used.set(slug, obj);
  }

  // expand to real setIds (only those present in fr_map.json keys)
  const out = new Set();
  for (const [slug, info] of used){
    const mainId = info.mainId;
    out.add(mainId);
    const ggId = frBySlug[`${slug}-gg`];
    const tgId = frBySlug[`${slug}-tg`];
    const svId = frBySlug[`${slug}-sv`];
    if (info.gg && ggId) out.add(ggId);
    if (info.tg && tgId) out.add(tgId);
    if (info.sv && svId) out.add(svId);
  }
  return Array.from(out);
}

async function main(){
  ensureDir(PRICE_DIR);

  // mapping FR -> setId (by slug)
  const frBySlug = readFRMapBySlug();
  // Focus only on sets actually used in cartes.csv (+ only subsets that appear)
  const setIds = detectUsedSets({ frBySlug });

  let idx = 0;
  const errors = [];

  async function worker(){
    while (true){
      const i = idx++; if (i >= setIds.length) break;
      const id = setIds[i];
      console.log("Building prices for", id);
      try{
        const obj = await buildSetPrices(id);
        fs.writeFileSync(path.join(PRICE_DIR, `${id}.json`), JSON.stringify(obj));
      }catch(e){
        console.error(`× Failed ${id}: ${e.message}`);
        errors.push({ id, msg: e.message });
      }
      await sleep(200);
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, setIds.length) }, worker));

  fs.writeFileSync("public/sets.json", JSON.stringify(setIds));
  if (errors.length){
    console.log("Done with partial errors:", errors);
  } else {
    console.log("Done. Files in public/prices/*.json");
  }
  // Toujours terminer en succès pour que le commit puisse se faire
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(0); });
