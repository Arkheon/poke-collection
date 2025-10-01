import fs from 'node:fs';
import path from 'node:path';

const PRICE_DIR = path.join('public', 'prices');
const OUTPUT_FILE = path.join(PRICE_DIR, 'cards-bundle.json');
const FR_MAP_FILE = path.join('data', 'fr_map.json');
const CARDS_CSV = path.join('cartes.csv');

function ensureDir(p){ fs.mkdirSync(p, { recursive:true }); }
function normalizeNFC(s){ return (s ?? '').normalize('NFC').trim().replace(/\s+/g,' '); }
function slugify(s){
  const nfd = normalizeNFC(s).normalize('NFD');
  const noAcc = nfd.replace(/[\u0300-\u036f]/g,'');
  return noAcc.toLowerCase();
}
function formatEuro(n){
  if (n == null || Number.isNaN(n)) return null;
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function choosePrice(entry, row){
  if (!entry) return null;
  const nbReverse = Number(row['Nb Reverse']);
  const reverseExists = nbReverse !== -1;
  const reverseOwned = nbReverse > 0;
  if ((reverseOwned || reverseExists) && entry.reverseTrend) return entry.reverseTrend;
  return entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? null;
}
function normIndex(raw){
  const s = String(raw ?? '').trim().toUpperCase();
  const mDen = s.match(/^(?:SV)?0*(\d+)\/\d+$/i);
  if (mDen) return parseInt(mDen[1],10);
  const mPre = s.match(/^(?:GG|TG|SV)?0*(\d+)$/i);
  if (mPre) return parseInt(mPre[1],10);
  const n = parseInt(s,10);
  return Number.isFinite(n) ? n : s;
}

function loadJSON(file){
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e){
    return null;
  }
}

function readFRMapBySlug(){
  const raw = loadJSON(FR_MAP_FILE) || {};
  const out = {};
  for (const [k,v] of Object.entries(raw)){
    out[slugify(k)] = v;
  }
  return out;
}

function detectColumns(header){
  const cols = header.split('\t');
  const idx = {
    serie: cols.findIndex(h => /s[ée]rie/i.test(h)),
    numero: cols.findIndex(h => /num[ée]ro/i.test(h)),
    nbReverse: cols.findIndex(h => /reverse/i.test(h)),
    nbSpeciale: cols.findIndex(h => /sp[ée]ciale/i.test(h)),
  };
  if (idx.nbReverse === -1) idx.nbReverse = cols.findIndex(h => /nb\s*rev/i.test(h));
  if (idx.nbSpeciale === -1) idx.nbSpeciale = cols.findIndex(h => /speciale/i.test(h));
  return { cols, idx };
}

function readPriceFile(setId, cache){
  if (!setId) return null;
  if (cache.has(setId)) return cache.get(setId);
  const file = path.join(PRICE_DIR, `${setId}.json`);
  const data = loadJSON(file);
  cache.set(setId, data ? data.items || {} : null);
  return cache.get(setId);
}

function lookupEntry({ slug, numRaw, frMap, priceCache }){
  const mainId0 = frMap[slug];
  const mainId = mainId0 || null;
  const ggId = frMap[`${slug}-gg`] || (mainId ? `${mainId}gg` : null);
  const tgId = frMap[`${slug}-tg`] || (mainId ? `${mainId}tg` : null);
  const svId = frMap[`${slug}-sv`] || (mainId ? `${mainId}sv` : null);
  const upper = String(numRaw || '').trim().toUpperCase();
  const isGG = /^GG\d+/i.test(upper);
  const isTG = /^TG\d+/i.test(upper);
  const isSV = /^(SV\d+|SV\d+\/\d+)/i.test(upper);
  const setId = isGG ? ggId : isTG ? tgId : isSV ? svId : mainId;
  if (!setId) return { entry:null, setId:null };
  const pool = readPriceFile(setId, priceCache);
  if (!pool) return { entry:null, setId };
  const key = String(upper);
  const idx = normIndex(key);
  const entry = pool[key] ?? pool[idx] ?? pool[String(idx)] ?? null;
  return { entry, setId };
}

async function main(){
  if (!fs.existsSync(CARDS_CSV)){
    console.error('cartes.csv introuvable');
    process.exit(1);
  }
  const file = fs.readFileSync(CARDS_CSV, 'utf8');
  const [header, ...lines] = file.split(/\r?\n/).filter(Boolean);
  if (!header){
    console.error('cartes.csv vide');
    process.exit(1);
  }
  const { cols, idx } = detectColumns(header);
  if (idx.serie === -1 || idx.numero === -1){
    console.error('Colonnes Série ou Numéro introuvables dans cartes.csv');
    process.exit(1);
  }

  const frMap = readFRMapBySlug();
  const priceCache = new Map();
  const bundle = {};
  let linked = 0;

  for (const line of lines){
    const parts = line.split('\t');
    if (parts.length <= idx.serie) continue;
    const serieRaw = parts[idx.serie];
    const slug = slugify(serieRaw);
    if (!slug) continue;
    const numRaw = idx.numero !== -1 ? parts[idx.numero] : '';
    if (!numRaw) continue;
    const numKey = String(numRaw).trim().toUpperCase();
    const { entry, setId } = lookupEntry({ slug, numRaw: numKey, frMap, priceCache });
    if (!entry) continue;

    const rowInfo = {
      'Nb Reverse': idx.nbReverse !== -1 ? parts[idx.nbReverse] : '-1',
    };
    const priceValue = choosePrice(entry, rowInfo);
    bundle[slug] ||= {};
    bundle[slug][numKey] = {
      setId,
      trend: entry.trend ?? null,
      avg7: entry.avg7 ?? null,
      avg30: entry.avg30 ?? null,
      reverseTrend: entry.reverseTrend ?? null,
      low: entry.low ?? null,
      price: priceValue ?? null,
      priceText: priceValue != null ? formatEuro(priceValue) : null,
      url: entry.url ?? null,
      updatedAt: entry.updatedAt ?? null,
    };
    linked += 1;
  }

  ensureDir(PRICE_DIR);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), cards: bundle }, null, 2));
  console.log(`Bundle créé : ${OUTPUT_FILE} (cartes liées: ${linked})`);
}

main().catch(err => { console.error(err); process.exit(1); });
