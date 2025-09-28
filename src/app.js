// src/app.js
import { normalize, slugify, escapeHtml } from './domain/strings.js';
import { parseNumDen, parseSubset } from './domain/numbers.js';
import { eur, choosePrice } from './domain/pricing.js';
import { loadFrMap, getSetIdFromSlug } from './services/frMap.js';
import { loadSetsMeta, eraFromSlug } from './services/setsMeta.js';
import { getSetPrices } from './services/priceService.js';
import { mountStatsView } from './ui/statsView.js';

/* ====================== RENDER SCHEDULER ====================== */
let _rerenderTimer = null;
let _renderRef = null; // alimenté par initApp()
function scheduleRender(delay = 60){
  clearTimeout(_rerenderTimer);
  _rerenderTimer = setTimeout(() => { try { _renderRef && _renderRef(); } catch {} }, delay);
}

export function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
  } else {
    initApp();
  }
}

function initApp(){
  loadFrMap(); // map FR -> setId
  loadSetsMeta(); // sets meta (series/era + icons), no-op if missing

  // Une seule et unique définition : pas de redéclaration possible.
  const params = new URLSearchParams(location.search);
  const SHOW_UPLOADS = params.has('upload');

  if(!SHOW_UPLOADS){
    const up = document.querySelector('.uploads'); if(up) up.style.display='none';
    const demoBtn = document.getElementById('load-demo'); if(demoBtn) demoBtn.style.display='none';
  }

  let SERIE_CANON = new Map();
  let ERA_CANON = new Map(); // key -> label

  /* ====================== ONGLET NAV ====================== */
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const name = t.dataset.tab;
    document.getElementById('panel-cards').style.display   = (name==='cards') ? 'block' : 'none';
    document.getElementById('panel-sealed').style.display  = (name==='sealed')? 'block' : 'none';
    document.getElementById('panel-graded').style.display  = (name==='graded')? 'block' : 'none';
    document.getElementById('panel-stats').style.display   = (name==='stats') ? 'block' : 'none';
    render();
  }));

  /* ====================== RARETÉS ====================== */
  const RARITY_MAP = {'1':'commune','2':'peu_commune','3':'rare','4':'rare','5':'rare_silver','6':'rare_silver','7':'promo','32':'double_rare','33':'illustration_rare','34':'ultra_rare_silver','35':'illustration_sr','36':'hyper_rare','39':'chromatique_ur','40':'high_tech'};
  const RARITY_LABELS = {commune:'Commune',peu_commune:'Peu commune',rare:'Rare',rare_silver:'Rare',double_rare:'Double rare',ultra_rare_silver:'Ultra rare',illustration_rare:'Illustration rare',illustration_sr:'Illustration spéciale rare',hyper_rare:'Hyper rare',chromatique_ur:'Chromatique ultra rare',high_tech:'HIGH-TECH rare',promo:'Promo'};
  const RARITY_ORDER = ['commune','peu_commune','rare','rare_silver','promo','double_rare','ultra_rare_silver','illustration_rare','illustration_sr','hyper_rare','chromatique_ur','high_tech'];

  const svg=(p)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const star=(fill,stroke,strokeW=1.5)=>svg(`<path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.9 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" fill="${fill||'none'}" stroke="${stroke||'currentColor'}" stroke-width="${strokeW}"/>`);
  const circle=(fill,stroke)=>svg(`<circle cx="12" cy="12" r="7" fill="${fill||'none'}" stroke="${stroke||'currentColor'}" stroke-width="1.5"/>`);
  const diamond=(fill,stroke)=>svg(`<path d="M12 3l7 9-7 9-7-9 7-9z" fill="${fill||'none'}" stroke="${stroke||'currentColor'}" stroke-width="1.5"/>`);
  const COLORS={black:'#0f172a',silver:'#c0c9d6',gold:'#e3b341',goldStroke:'#d09a00',raspberry:'#e11d48',white:'#ffffff'};

  function rarityIconsByKey(key){
    switch(key){
      case 'commune': return `<span class='rarity'>${circle(COLORS.black, COLORS.black)}</span>`;
      case 'peu_commune': return `<span class='rarity'>${diamond(COLORS.black, COLORS.black)}</span>`;
      case 'rare': return `<span class='rarity'>${star(COLORS.black, COLORS.black)}</span>`;
      case 'rare_silver': return `<span class='rarity'>${star(COLORS.silver, COLORS.silver)}</span>`;
      case 'double_rare': return `<span class='rarity'>${star(COLORS.black, COLORS.black)}${star(COLORS.black, COLORS.black)}</span>`;
      case 'ultra_rare_silver': return `<span class='rarity'>${star(COLORS.silver, COLORS.silver)}${star(COLORS.silver, COLORS.silver)}</span>`;
      case 'illustration_rare': return `<span class='rarity'>${star(COLORS.gold, COLORS.gold)}</span>`;
      case 'illustration_sr': return `<span class='rarity'>${star(COLORS.gold, COLORS.gold)}${star(COLORS.gold, COLORS.gold)}</span>`;
      case 'hyper_rare': return `<span class='rarity'>${star(COLORS.gold, COLORS.gold)}${star(COLORS.gold, COLORS.gold)}${star(COLORS.gold, COLORS.gold)}</span>`;
      case 'chromatique_ur': return `<span class='rarity'>${star(COLORS.white, COLORS.goldStroke, 2)}${star(COLORS.white, COLORS.goldStroke, 2)}</span>`;
      case 'high_tech': return `<span class='rarity'>${star(COLORS.raspberry, COLORS.raspberry)}</span>`;
      case 'promo': return `<span class='rarity promo' title="Promo"><b>P</b></span>`;
      default: return '';
    }
  }
  const rarityFromRow = (r)=>{ const code=String(r['Rareté']??'').trim(); const key=RARITY_MAP[code]; return {key,label:key?RARITY_LABELS[key]:null,raw:code}; };

  const selectedRarities = new Set(RARITY_ORDER);

  function buildRarityDropdown(){
    const box = document.getElementById('rarityChips'); if(!box) return;
    box.innerHTML='';
    RARITY_ORDER.forEach(key=>{
      const id = 'rk_'+key;
      const wrap = document.createElement('span'); wrap.className='chip';
      const input = document.createElement('input');
      input.type='checkbox'; input.id=id; input.checked=true; input.dataset.key=key;
      const label = document.createElement('label'); label.setAttribute('for', id); label.innerHTML = rarityIconsByKey(key); label.title = RARITY_LABELS[key];
      wrap.appendChild(input); wrap.appendChild(label); box.appendChild(wrap);
      input.addEventListener('change', ()=>{ if(input.checked) selectedRarities.add(key); else selectedRarities.delete(key); updateRarityBtn(); render(); });
    });
    document.getElementById('checkAll').onclick=()=>{ selectedRarities.clear(); RARITY_ORDER.forEach(k=>{selectedRarities.add(k); const el=document.getElementById('rk_'+k); if(el) el.checked=true;}); updateRarityBtn(); render(); };
    document.getElementById('uncheckAll').onclick=()=>{ RARITY_ORDER.forEach(k=>{selectedRarities.delete(k); const el=document.getElementById('rk_'+k); if(el) el.checked=false;}); updateRarityBtn(); render(); };
    updateRarityBtn();
  }
  function updateRarityBtn(){
    const btn = document.getElementById('rarityBtn'); if(!btn) return;
    if(selectedRarities.size===RARITY_ORDER.length) btn.textContent='Toutes les raretés';
    else if(selectedRarities.size===0) btn.textContent='Aucune sélection';
    else btn.textContent=`${selectedRarities.size} rareté(s) sélectionnée(s)`;
  }
  (function wireRarityDropdown(){
    const btn = document.getElementById('rarityBtn');
    const dd  = document.getElementById('rarityDD');
    if(!btn || !dd) return;
    if (btn._rarityWired) return;
    btn._rarityWired = true;
    const toggle = (e)=>{ e.stopPropagation(); dd.hidden = !dd.hidden; };
    const stop   = (e)=>{ e.stopPropagation(); };
    const close  = (e)=>{ if (!dd.hidden && !e.target.closest('#rarityDD') && !e.target.closest('#rarityBtn')) dd.hidden = true; };
    btn.addEventListener('click', toggle);
    dd.addEventListener('click', stop);
    document.addEventListener('click', close);
  })();

  /* ====================== DONNÉES ====================== */
  let CARDS=[], SEALED=[], GRADED=[];
  const AUTO_SOURCES={ cards:'cartes.csv', sealed:'scelle.csv', graded:'gradees.csv' };

  function loadCsvFromUrl(url, cb, onError){
    fetch(url,{cache:'no-store'})
      .then(r=>{ if(!r.ok) throw new Error(r.status+" "+r.statusText); return r.text(); })
      .then(text=>{
        // Détection simple de faux CSV (ex: Gnumeric/XML ou binaire compressé)
        const looksGnumeric = text.startsWith('<?xml') || text.includes('<gnm:Workbook');
        const looksBinary = /\x00/.test(text);
        if(looksGnumeric || looksBinary){
          const msg = 'Fichier non-CSV détecté (probablement Gnumeric/ZIP). Exportez en CSV texte non compressé.';
          console.warn(msg, url);
          // Message utilisateur si scellés (les autres panels restent silencieux)
          if(/scell/i.test(url)){
            const rootS = document.getElementById('sealed-root');
            if(rootS) rootS.innerHTML = `<div class='empty'>${escapeHtml(msg)}<br><small>Chemin: ${escapeHtml(url)}</small></div>`;
          }
          throw new Error(msg);
        }
        Papa.parse(text,{header:true,skipEmptyLines:true,complete:res=>cb(res.data)});
      })
      .catch(err=>{ console.warn('CSV auto-load failed for', url, err); onError && onError(err); });
  }
  const normalizeRows = rows =>
    rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k).trim(), typeof v==='string'? v.trim(): v])));

  // Chargements auto (+ mise à jour KPI)
  loadCsvFromUrl(AUTO_SOURCES.cards, rows=>{ CARDS=normalizeRows(rows); refreshSeries();PriceBook.bySet.clear();PriceBook.ready = false; render(); updateKPIs(); });
  loadCsvFromUrl(AUTO_SOURCES.sealed, rows=>{ SEALED=normalizeRows(rows); refreshSeries();  refreshSealedFilters(); render(); updateKPIs(); });
  loadCsvFromUrl(AUTO_SOURCES.graded, rows=>{ GRADED=normalizeRows(rows); refreshCompanies();  render(); updateKPIs(); });

  // Uploads manuels
  if(SHOW_UPLOADS){
    document.getElementById('csv-cards')?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return;
      Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
        CARDS=normalizeRows(res.data); refreshSeries(); render(); updateKPIs();
      }});
    });
    document.getElementById('csv-sealed')?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return;
      Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
        SEALED=normalizeRows(res.data); refreshSeries(); refreshSealedFilters(); render(); updateKPIs();
      }});
    });
    document.getElementById('csv-graded')?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return;
      Papa.parse(f,{header:true,skipEmptyLines:true,complete:res=>{
        GRADED=normalizeRows(res.data); refreshCompanies(); render(); updateKPIs();
      }});
    });
    document.getElementById('load-demo')?.addEventListener('click', ()=>{
      CARDS=[
        {'Série':'151','Numéro':'1/165','Nom':'Bulbizarre','Rareté':'1','Nb Normal':'1','Nb Reverse':'1','Nb Spéciale':'0','Alternative':'-1','Image URL':'https://images.pokemontcg.io/sv3/fr/1_hires.png','avg30':'0.4'},
        {'Série':'Écarlate et Violet','Numéro':'14/198','Nom':'Rare','Rareté':'5','Nb Normal':'1','Alternative':'1','Nb Spéciale':'0','avg30':'1.2'},
        {'Série':'Zénith Suprême','Numéro':'GG05','Nom':'Lokhlass','Rareté':'33','Nb Normal':'1','Alternative':'1','Nb Spéciale':'1','avg30':'22.5'},
      ];
      SEALED=[{'Série':'151','Type':'ETB','Détail':'Exemple','Commentaires':'—','Image':'https://via.placeholder.com/400x250?text=ETB+151','Prix':'89,00'}];
      GRADED=[{'Nom':'Pikachu','Edition':'SWSH','Société':'PSA','Note':'10','Détail':'Test','Image':'https://via.placeholder.com/400x250?text=PSA+10','Prix':'120'}];
      refreshSeries(); refreshSealedFilters(); refreshCompanies(); render(); updateKPIs();
    });
  }

  /* ====================== SÉLECTEURS ====================== */
  const q=document.getElementById('q');
  const era=document.getElementById('era');
  const serie=document.getElementById('serie');
  const view=document.getElementById('view');
  q && (q.oninput=()=>scheduleRender(80));
  era && (era.onchange=()=>{ refreshSeries(); scheduleRender(0); });
  serie && (serie.onchange=()=>scheduleRender(0));
  view && (view.onchange=()=>scheduleRender(0));

  const qs=document.getElementById('qs');
  const eraS=document.getElementById('eraS');
  const serieS=document.getElementById('serieS');
  const typeS=document.getElementById('typeS');
  qs && (qs.oninput=()=>scheduleRender(80));
  eraS && (eraS.onchange=()=>{ refreshSeries(); scheduleRender(0); });
  serieS && (serieS.onchange=()=>scheduleRender(0));
  typeS && (typeS.onchange=()=>scheduleRender(0));

  const qg=document.getElementById('qg');
  const company=document.getElementById('company');
  const minG=document.getElementById('minG');
  const minG_label=document.getElementById('minG_label');
  qg && (qg.oninput=()=>scheduleRender(80));
  company && (company.onchange=()=>scheduleRender(0));
  minG && (minG.oninput=()=>{ if(minG_label) minG_label.textContent=minG.value; scheduleRender(80); });

  buildRarityDropdown();

  /* ====================== PRIX (catalogue préchargé) ====================== */
  async function safeGet(setId){
    try { return setId ? await getSetPrices(setId) : null; }
    catch { return null; }
  }
  const unwrap = (x)=> (x && x.items) ? x.items : x;

  // PriceBook: on charge chaque set (main + GG/TG/SV) une seule fois
  const PriceBook = { bySet:new Map(), ready:false };

  async function ensurePriceBook(){
    if (PriceBook.ready) return;

    await loadFrMap();

    const slugs = Array.from(new Set(CARDS.map(r => slugify(r['Série'] || '')).filter(Boolean)));
    const setIds = new Set();
    for (const sl of slugs){
      // Detect subsets actually used in the CSV for this slug
      const rowsForSlug = CARDS.filter(r => slugify(r['Série'] || '') === sl);
      const hasGG = rowsForSlug.some(r => /^GG\d+/i.test(String(r['Numéro']||'').trim()));
      const hasTG = rowsForSlug.some(r => /^TG\d+/i.test(String(r['Numéro']||'').trim()));
      const hasSV = rowsForSlug.some(r => /^(SV\d+|SV\d+\/\d+)/i.test(String(r['Numéro']||'').trim()));

      const mainId0 = getSetIdFromSlug(sl);
      const ggId0   = getSetIdFromSlug(`${sl}-gg`);
      const tgId0   = getSetIdFromSlug(`${sl}-tg`);
      const svId0   = getSetIdFromSlug(`${sl}-sv`);

      const mainId = mainId0 || null;
      const ggId   = ggId0 || (mainId && hasGG ? `${mainId}gg` : null);
      const tgId   = tgId0 || (mainId && hasTG ? `${mainId}tg` : null);
      const svId   = svId0 || (mainId && hasSV ? `${mainId}sv` : null);
      [mainId, ggId, tgId, svId].forEach(id => { if (id) setIds.add(id); });
    }

    const results = await Promise.all(Array.from(setIds).map(async id => [id, await safeGet(id)]));
    results.forEach(([id, data]) => { if (data) PriceBook.bySet.set(id, unwrap(data)); });
    PriceBook.ready = true;
  }

  function lookupEntryForRow(row){
    const slug   = slugify(row['Série'] || '');
    const numRaw = String(row['Numéro'] || '').trim().toUpperCase();
    if (!slug || !numRaw) return null;

    const mainId0 = getSetIdFromSlug(slug);
    const ggId0   = getSetIdFromSlug(`${slug}-gg`);
    const tgId0   = getSetIdFromSlug(`${slug}-tg`);
    const svId0   = getSetIdFromSlug(`${slug}-sv`);

    const mainId = mainId0 || null;
    const ggId   = ggId0 || (mainId ? `${mainId}gg` : null);
    const tgId   = tgId0 || (mainId ? `${mainId}tg` : null);
    const svId   = svId0 || (mainId ? `${mainId}sv` : null);

    const isGG = /^GG\d+/i.test(numRaw);
    const isTG = /^TG\d+/i.test(numRaw);
    const isSV = /^(SV\d+|SV\d+\/\d+)/i.test(numRaw);

    const pool = isGG ? PriceBook.bySet.get(ggId)
             : isTG ? PriceBook.bySet.get(tgId)
             : isSV ? PriceBook.bySet.get(svId)
                    : PriceBook.bySet.get(mainId);
    if (!pool) return null;

    const normIndex = (s)=>{
      const mDen = s.match(/^(?:SV)?0*(\d+)\/\d+$/i); if (mDen) return parseInt(mDen[1],10);
      const mPre = s.match(/^(?:GG|TG|SV)?0*(\d+)$/i); if (mPre) return parseInt(mPre[1],10);
      const n = parseInt(s,10); return Number.isFinite(n) ? n : s;
    };
    const k = normIndex(numRaw);
    return pool[numRaw] ?? pool[k] ?? pool[String(k)] ?? null;
  }

  function priceForRow(row, entry){
    if (!entry) return 0;
    const num = String(row['Numéro'] || '').toUpperCase();
    const isSub = /^(GG|TG|SV)/.test(num);
    if (isSub) return Number(entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? 0) || 0;
    return Number(choosePrice(entry, row) || 0);
  }

// Prix bruts depuis une entrée du catalogue
const pNorm = e => Number(e?.trend ?? e?.avg30 ?? e?.avg7 ?? e?.low ?? 0) || 0;
const pRev  = e => Number(e?.reverseTrend ?? 0) || pNorm(e);


  // Annote les prix d’une série visible (utile pour afficher le prix par carte)
  async function annotateRowsWithPrices(slug, arr){
    await loadFrMap();
    const mainId0 = getSetIdFromSlug(slug);
    const ggId0   = getSetIdFromSlug(`${slug}-gg`);
    const tgId0   = getSetIdFromSlug(`${slug}-tg`);
    const svId0   = getSetIdFromSlug(`${slug}-sv`);
    // Detect subsets usage within the provided rows
    const hasGG = arr.some(r => /^GG\d+/i.test(String(r['Numéro']||'').trim()));
    const hasTG = arr.some(r => /^TG\d+/i.test(String(r['Numéro']||'').trim()));
    const hasSV = arr.some(r => /^(SV\d+|SV\d+\/\d+)/i.test(String(r['Numéro']||'').trim()));
    const mainId = mainId0 || null;
    const ggId   = ggId0 || (mainId && hasGG ? `${mainId}gg` : null);
    const tgId   = tgId0 || (mainId && hasTG ? `${mainId}tg` : null);
    const svId   = svId0 || (mainId && hasSV ? `${mainId}sv` : null);

    const [dMain, dGG, dTG, dSV] = await Promise.all([
      getSetPrices(mainId),
      getSetPrices(ggId),
      getSetPrices(tgId),
      getSetPrices(svId)
    ]);
    const itemsMain = unwrap(dMain) || null;
    const itemsGG   = unwrap(dGG)   || null;
    const itemsTG   = unwrap(dTG)   || null;
    const itemsSV   = unwrap(dSV)   || null;

    const isGG = s => /^GG\d+/i.test(String(s||'').trim());
    const isTG = s => /^TG\d+/i.test(String(s||'').trim());
    const isSV = s => /^SV\d+/i.test(String(s||'').trim()) || /^SV\d+\/\d+/i.test(String(s||'').trim());

    const normIndex = raw => {
      const s = String(raw ?? '').trim().toUpperCase();
      const mDen = s.match(/^(?:SV)?0*(\d+)\/\d+$/i); if (mDen) return parseInt(mDen[1],10);
      const mPre = s.match(/^(?:GG|TG|SV)?0*(\d+)$/i); if (mPre) return parseInt(mPre[1],10);
      const n = parseInt(s,10); return Number.isFinite(n) ? n : s;
    };
    const lookup = num => {
      const raw  = String(num||'').trim().toUpperCase();
      const pool = isGG(raw) ? itemsGG : isTG(raw) ? itemsTG : isSV(raw) ? itemsSV : itemsMain;
      if (!pool) return null;
      const k = normIndex(raw);
      return pool[raw] ?? pool[k] ?? pool[String(k)] ?? null;
    };

    let changed = false;
    for (const r of arr){
      const raw = String(r['Numéro']||'').toUpperCase();
      const entry = lookup(raw); if (!entry) continue;
      const price = (/^(GG|TG|SV)/i.test(raw))
        ? Number(entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? 0)
        : choosePrice(entry, r);
      if (price != null) {
        const euro = eur(Number(price));
        if (r['Prix'] !== euro) { r['Prix'] = euro; changed = true; }
      }
    }
    if (changed) { scheduleRender(30); updateKPIs(); }
  }

  const posInt = (v)=>{ const n = Number(String(v??'').replace(',','.')); return Number.isFinite(n) ? Math.max(0,n) : 0; };

  /* ====================== STATS ====================== */
  function computeStatsPerSeries(){
    const map = new Map();
    CARDS.forEach(r=>{
      const slug = slugify(r['Série']); if(!slug) return;

      const nbN = Number(r['Nb Normal']);
      const nbR = Number(r['Nb Reverse']);
      const nbS = Number(r['Nb Spéciale']);
      const alt = Number(r['Alternative'] ?? -1);
      const grad = Number(r['Gradées'] ?? 0);

      if(!map.has(slug)){
        map.set(slug, {
          slug,
          label: SERIE_CANON.get(slug) || normalize(r['Série']),
          sizeN: 0, sizeSub: 0,
          totN: 0, totR: 0,
          totAlt: 0, ownedAlt: 0, missAlt: [],
          gradedTotal: 0, gradedPCA: 0, gradedPSA: 0,
          ownedN: 0, ownedR: 0,
          missN: [], missR: []
        });
      }
      const o = map.get(slug);

      const numStr = String(r['Numéro']||'').trim();
      const isNumDen = !!parseNumDen(numStr);
      const isSubset = !!parseSubset(numStr) || /^SV\d+/i.test(numStr);

      if (nbN !== -1) {
        if (isNumDen) o.sizeN += 1;
        else if (isSubset) o.sizeSub += 1;
      }

      if (nbN !== -1) {
        o.totN += 1;
        if (nbN > 0) o.ownedN += 1;
        else o.missN.push({numero: numStr || '—', nom: String(r['Nom']||'')});
      }

      if (nbR !== -1) {
        o.totR += 1;
        if (nbR > 0) o.ownedR += 1;
        else o.missR.push({numero: numStr || '—', nom: String(r['Nom']||'')});
      }

      if (alt === 1) {
        o.totAlt += 1;
        if (nbS > 0) o.ownedAlt += 1;
        else o.missAlt.push({numero: numStr || '—', nom: String(r['Nom']||'')});
      }

      if (grad === 2 || grad === 4) {
        o.gradedTotal += 1;
        if (grad === 2) o.gradedPCA += 1;
        if (grad === 4) o.gradedPSA += 1;
      }
    });

    const arr = Array.from(map.values()).map(o=>{
      const sizeTotal = o.sizeN + o.sizeSub;
      const done = Math.min(o.ownedN, sizeTotal);
      const pct = sizeTotal ? (done / sizeTotal) * 100 : 0;
      return {...o, size: sizeTotal, done, completion: pct};
    });

    arr.sort((a,b)=> b.completion - a.completion || a.label.localeCompare(b.label,'fr'));
    return arr;
  }

  async function computePriceStatsForSeries(slug){
    await loadFrMap();

    const mainId0 = getSetIdFromSlug(slug);
    const ggId0   = getSetIdFromSlug(`${slug}-gg`);
    const tgId0   = getSetIdFromSlug(`${slug}-tg`);
    const svId0   = getSetIdFromSlug(`${slug}-sv`);

    const mainId = mainId0 || null;
    const ggId   = ggId0 || (mainId ? `${mainId}gg` : null);
    const tgId   = tgId0 || (mainId ? `${mainId}tg` : null);
    const svId   = svId0 || (mainId ? `${mainId}sv` : null);

    if (!mainId && !ggId && !tgId && !svId) return { available:false };

    const [dMain, dGG, dTG, dSV] = await Promise.all([
      safeGet(mainId), safeGet(ggId), safeGet(tgId), safeGet(svId),
    ]);

    const itemsMain = unwrap(dMain) || null;
    const itemsGG   = unwrap(dGG)   || null;
    const itemsTG   = unwrap(dTG)   || null;
    const itemsSV   = unwrap(dSV)   || null;

    const rows = CARDS.filter(r => slugify(r['Série']) === slug);

    const isGG = s => /^GG\d+/i.test(String(s||'').trim());
    const isTG = s => /^TG\d+/i.test(String(s||'').trim());
    const isSV = s => /^SV\d+/i.test(String(s||'').trim()) || /^SV\d+\/\d+/i.test(String(s||'').trim());

    const normIndex = num=>{
      const s = String(num ?? '').trim().toUpperCase();
      const mDen = s.match(/^(?:SV)?0*(\d+)\/\d+$/i); if (mDen) return parseInt(mDen[1],10);
      const mPre = s.match(/^(?:GG|TG|SV)?0*(\d+)$/i); if (mPre) return parseInt(mPre[1],10);
      const n = parseInt(s,10); return Number.isFinite(n) ? n : s;
    };

    const lookup = num=>{
      const raw = String(num||'').trim().toUpperCase();
      const pool = isGG(raw) ? itemsGG : isTG(raw) ? itemsTG : isSV(raw) ? itemsSV : itemsMain;
      if (!pool) return null;
      const idx = normIndex(raw);
      return pool[idx] ?? pool[raw] ?? pool[String(idx)] ?? null;
    };

    const pNorm = e => Number(e?.trend ?? e?.avg30 ?? e?.avg7 ?? e?.low ?? 0) || 0;
    const pRev  = e => Number(e?.reverseTrend ?? 0) || pNorm(e);

    const sum = { setU:{normal:0,reverse:0,alt:0}, ownU:{normal:0,reverse:0,alt:0}, ownD:{normal:0,reverse:0,alt:0} };
    const topAll = [];

    for (const r of rows){
      const numRaw = String(r['Numéro']||'');
      const entry  = lookup(numRaw);
      if (!entry) continue;

      const prefixed = isGG(numRaw) || isTG(numRaw) || isSV(numRaw);
      const hasN   = Number(r['Nb Normal'])  !== -1 || prefixed;
      const hasR   = Number(r['Nb Reverse']) !== -1;
      const hasAlt = Number(r['Alternative']) === 1;

      const priceN = pNorm(entry);
      const priceR = pRev(entry);
      const priceA = pRev(entry) || pNorm(entry);

      if (hasN)   sum.setU.normal  += priceN;
      if (hasR)   sum.setU.reverse += priceR;
      if (hasAlt) sum.setU.alt     += priceA;

      const qNraw = posInt(r['Nb Normal']);
      const qRraw = posInt(r['Nb Reverse']);
      const qAraw = posInt(r['Nb Spéciale'] ?? r['Nb Speciale']);

      // ⬇️ NE PAS compter la valeur des cartes gradées dans "Possédé (unique)"
      const skipGraded = isGradedRow(r);
      if (!skipGraded) {
        if (qNraw > 0)           sum.ownU.normal  += priceN;
        if (qRraw > 0)           sum.ownU.reverse += priceR;
        if (hasAlt && qAraw > 0) sum.ownU.alt     += priceA;
}

      if (qNraw > 1) sum.ownD.normal  += (qNraw - 1) * priceN;
      if (qRraw > 1) sum.ownD.reverse += (qRraw - 1) * priceR;
      if (qAraw > 1) sum.ownD.alt     += (qAraw - 1) * priceA;

      topAll.push({ numero:String(numRaw||'—'), nom:String(r['Nom']||''), price:priceN });
    }

    const withTotal = o => ({ ...o, total:o.normal + o.reverse + o.alt });
    topAll.sort((a,b)=> b.price - a.price);

    const anyAvailable = !!(itemsMain || itemsGG || itemsTG || itemsSV);
    return { available:anyAvailable, setId: mainId || ggId || tgId || svId || null,
             setUnique:withTotal(sum.setU), ownedUnique:withTotal(sum.ownU), setDoubles:withTotal(sum.ownD),
             top10: topAll.slice(0,10) };
  }

  function renderStats(){
    const root = document.getElementById('stats-root');
    const data = computeStatsPerSeries();
    try{
      mountStatsView({ root, series: data, loadPrices: computePriceStatsForSeries });
      requestAnimationFrame(enhanceStatsBars);
    }catch(err){
      console.error('renderStats failed', err);
      if(root) root.innerHTML = `<div class="empty">Erreur d’affichage des stats.</div>`;
    }
  }

  /* ====================== UI HELPERS ====================== */
  function rebuildSerieCanon() {
    const map = new Map();
    CARDS.forEach(r=>{
      const raw = normalize(r['Série']); if(!raw) return;
      const sl = slugify(raw); if(!map.has(sl)) map.set(sl, raw);
    });
    SEALED.forEach(r=>{
      const raw = normalize(r['Série']); if(!raw) return;
      const sl = slugify(raw); if(!map.has(sl)) map.set(sl, raw);
    });
    SERIE_CANON = map;
  }

  function rebuildEraCanon(){
    const m = new Map();
    for (const sl of SERIE_CANON.keys()){
      const era = eraFromSlug(sl);
      if (era && era.key) m.set(era.key, era.label || era.key);
    }
    ERA_CANON = m;
  }
  function refreshSeries(){
    rebuildSerieCanon();
    rebuildEraCanon();

    // Era selector (cards)
    const eraSel = document.getElementById('era');
    if (eraSel){
      const eras = Array.from(ERA_CANON.entries()).sort((a,b)=> a[1].localeCompare(b[1],'fr'));
      eraSel.innerHTML = ['all', ...eras]
        .map(e => e==='all' ? `<option value="all">Toutes</option>` : `<option value="${e[0]}">${e[1]}</option>`)
        .join('');
    }
    const selectedEra = document.getElementById('era') ? document.getElementById('era').value : 'all';

    // Series selector (cards), filtered by era
    let series = Array.from(SERIE_CANON.keys());
    if (selectedEra !== 'all') series = series.filter(sl => (eraFromSlug(sl)?.key || '') === selectedEra);
    const serie = document.getElementById('serie');
    if(serie){
      const opts = ['all', ...series.sort((a,b)=> SERIE_CANON.get(a).localeCompare(SERIE_CANON.get(b),'fr'))];
      serie.innerHTML = opts.map(sl=>`<option value="${sl}">${sl==='all' ? 'Toutes' : SERIE_CANON.get(sl)}</option>`).join('');
    }

    // Era selector (sealed)
    const eraSelS = document.getElementById('eraS');
    if (eraSelS){
      const eras = Array.from(ERA_CANON.entries()).sort((a,b)=> a[1].localeCompare(b[1],'fr'));
      eraSelS.innerHTML = ['all', ...eras]
        .map(e => e==='all' ? `<option value="all">Toutes</option>` : `<option value="${e[0]}">${e[1]}</option>`)
        .join('');
    }
    const selectedEraS = eraSelS ? eraSelS.value : 'all';

    // Series selector (sealed), filtered by era
    const serieS = document.getElementById('serieS');
    const sSet = new Set(SEALED.map(r=>slugify(r['Série']||'')));
    let sArr = Array.from(sSet).filter(Boolean);
    if (selectedEraS !== 'all') sArr = sArr.filter(sl => (eraFromSlug(sl)?.key || '') === selectedEraS);
    const sList = ['all', ...sArr.sort((a,b)=> (SERIE_CANON.get(a)||'').localeCompare(SERIE_CANON.get(b)||'','fr'))];
    if(serieS){
      serieS.innerHTML = sList.map(sl=>{
        const label = sl==='all' ? 'Toutes' : (SERIE_CANON.get(sl) || '');
        return `<option value="${sl}">${label}</option>`;
      }).join('');
    }
  }
  function refreshSealedFilters(){
    if(!(SEALED && SEALED.length)) return;
    const typeS=document.getElementById('typeS');
    const t=new Set();
    SEALED.forEach(r=>{ const raw = normalize(r['Type']); if(raw) t.add(raw); });
    const tOpt=['all',...Array.from(t).sort((a,b)=>a.localeCompare(b,'fr'))];
    if(typeS) typeS.innerHTML=tOpt.map(v=>`<option value="${v}">${v==='all'?'Tous':v}</option>`).join('');
  }
  function refreshCompanies(){
    const company=document.getElementById('company');
    const s=new Set(GRADED.map(r=>String(r['Société']||'')));
    const options=['all',...Array.from(s).filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'))];
    if(company) company.innerHTML=options.map(v=>`<option value="${v}">${v==='all'?'Toutes':v}</option>`).join('');
  }

  function ownedQty(r){
    const keys=["Nb Normal","Nb Reverse","Nb Spéciale","Quantité","Qty"];
    return keys.map(k=>{ const n=Number(r[k]); return Number.isNaN(n)?0:Math.max(0,n); }).reduce((a,b)=>a+b,0);
  }
  function sortCardNumbers(a,b){
    const A=String(a['Numéro']||''); const B=String(b['Numéro']||'');
    const [mA,sA]=A.split('/').map(x=>parseInt(x,10)); const [mB,sB]=B.split('/').map(x=>parseInt(x,10));
    if(!Number.isNaN(mA)&&!Number.isNaN(mB)){ if(mA!==mB) return mA-mB; if(!Number.isNaN(sA)&&!Number.isNaN(sB)) return sA-sB; }
    return A.localeCompare(B,'fr',{numeric:true});
  }

  // Modal
  const modal=document.getElementById('imgModal');
  const modalImg=document.getElementById('modalImg');
  const modalClose=document.getElementById('modalClose');
  function openModal(src,alt){ modalImg.src=src; modalImg.alt=alt||''; modal.classList.add('open'); document.body.style.overflow='hidden'; }
  function closeModal(){ modal.classList.remove('open'); modalImg.src=''; document.body.style.overflow=''; }
  modalClose && modalClose.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
  document.body.addEventListener('click', (e)=>{
    const img = e.target.closest?.('.thumb img, .g-thumb img'); if (img) openModal(img.src, img.alt);
  });

  /* ====================== KPI HELPERS ====================== */
  const nf_int = new Intl.NumberFormat('fr-FR');
  const nf_eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  function parseEuro(v){
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).replace(/\s/g,'').replace('€','').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  function parseIntSafe(v){
    if (v == null) return 0;
    if (typeof v === 'number') return Math.max(0, Math.floor(v));
    const n = parseInt(String(v).replace(/\s/g,''), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  function detectPriceKey(rows){
    const candidates = [
      { keys: ['avg30','Avg30','AVG30','Moy30','30j','Prix 30 jours','Average30'], label: 'avg30' },
      { keys: ['avg7','Avg7','AVG7','Moy7','7j','Prix 7 jours','Average7'],      label: 'avg7' },
      { keys: ['Prix','Price','Valeur','Estimation','Est.','value','valeur'],     label: 'prix' },
    ];
    for (const tier of candidates){
      for (const k of tier.keys){
        const has = rows?.some(r => parseEuro(r?.[k]) > 0);
        if (has) return { key: k, label: tier.label };
      }
    }
    return { key: null, label: 'aucun prix' };
  }
  function getQty(row){
    const qtyKeys = ['Qty','Quantité','quantite','quantity','Owned','Nb','Qte','Count'];
    for (const k of qtyKeys){
      const v = row?.[k];
      const n = parseIntSafe(v);
      if (n > 0) return n;
    }
    return 1;
  }
  function sumValueByKey(rows, key){
    if (!rows || !key) return 0;
    let total = 0;
    for (const r of rows){
      const p = parseEuro(r?.[key]);
      const q = getQty(r);
      if (p > 0 && q > 0) total += p * q;
    }
    return total;
  }
  function sumCount(rows){
    if (!rows) return 0;
    let s = 0;
    for (const r of rows) s += getQty(r);
    return s;
  }

function ownsAnyVariant(row){
  const n  = Number(row['Nb Normal'])   || 0;
  const rv = Number(row['Nb Reverse'])  || 0;
  const sp = Number(row['Nb Spéciale'] ?? row['Nb Speciale']) || 0;
  return (n > 0) || (rv > 0) || (sp > 0);
}

// true si AU MOINS une variante possédée n'a pas de prix
function lacksPriceForOwned(row, entry){
  const qN = Number(row['Nb Normal'])   || 0;
  const qR = Number(row['Nb Reverse'])  || 0;
  const qA = Number(row['Nb Spéciale'] ?? row['Nb Speciale']) || 0;

  // normal / sous-set : ton “priceForRow” gère déjà bien la logique
  if (qN > 0) {
    const pN = priceForRow(row, entry);
    if (!(pN > 0)) return true;
  }

  // reverse : source = reverseTrend si dispo
  if (qR > 0) {
    const pR = entry ? Number(entry.reverseTrend || 0) : 0;
    if (!(pR > 0)) return true;
  }

  // alt/spéciale : fallback reverseTrend -> trend/avg30/avg7
  if (qA > 0) {
    const pA = entry
      ? Number(entry.reverseTrend || entry.trend || entry.avg30 || entry.avg7 || 0)
      : 0;
    if (!(pA > 0)) return true;
  }

  return false;
}

// Retourne true si la ligne carte est marquée "gradée" (colonne Gradées ≠ 0)
function isGradedRow(row){
  const v = Number(
    row['Gradées'] ??
    row['Gradée'] ??
    row['Gradees'] ??
    row['Graded'] ??
    0
  );
  return Number.isFinite(v) && v !== 0;
}


  // KPI calculés sur l’ensemble (cartes: via PriceBook)
async function computeKPIsAsync(){
  await ensurePriceBook();

  let vCards = 0;
  let cardsPricedQty = 0;
  let cardsTotalQty  = 0;

  for (const r of (Array.isArray(CARDS) ? CARDS : [])){
    const entry  = lookupEntryForRow(r);
    const numRaw = String(r['Numéro'] || '');
    const prefixed = /^GG|^TG|^SV/i.test(numRaw);

    // Quantités possédées
    const qN = Math.max(0, posInt(r['Nb Normal']));
    const qR = Math.max(0, posInt(r['Nb Reverse']));
    const hasAlt = Number(r['Alternative']) === 1;
    const qA = hasAlt ? Math.max(0, posInt(r['Nb Spéciale'] ?? r['Nb Speciale'])) : 0;

    // ==> les compteurs “Cartes” continuent d’inclure les gradées
    cardsTotalQty += qN + qR + qA;

    // Si la carte est gradée, on **n’ajoute aucune valeur** et on **n’incrémente pas** cardsPricedQty
    if (isGradedRow(r)) {
      continue;
    }

    // Sinon, on valorise normalement
    if (qN > 0) {
      const priceN = entry ? (prefixed ? pNorm(entry) : priceForRow(r, entry)) : 0;
      vCards += qN * priceN;
      if (priceN > 0) cardsPricedQty += qN;
    }
    if (qR > 0) {
      const priceR = entry ? pRev(entry) : 0;
      vCards += qR * priceR;
      if (priceR > 0) cardsPricedQty += qR;
    }
    if (qA > 0) {
      const priceA = entry ? (pRev(entry) || pNorm(entry)) : 0;
      vCards += qA * priceA;
      if (priceA > 0) cardsPricedQty += qA;
    }
  }

  // (le reste de la fonction ne change pas)
  const graded = Array.isArray(GRADED) ? GRADED : [];
  const sealed = Array.isArray(SEALED) ? SEALED : [];
  const kGraded = detectPriceKey(graded);
  const kSealed = detectPriceKey(sealed);
  const vGraded = sumValueByKey(graded, kGraded.key);
  const vSealed = sumValueByKey(sealed, kSealed.key);
  const cCards  = cardsTotalQty;
  const cGraded = sumCount(graded);
  const cSealed = sumCount(sealed);
  const totalValue = vCards + vGraded + vSealed;

  return {
    totalValue, vCards, vGraded, vSealed,
    cCards, cGraded, cSealed,
    cardsPricedQty, cardsTotalQty,
    srcCards:  'catalogue (avg30/avg7/trend)',
    srcGraded: kGraded.label,
    srcSealed: kSealed.label
  };
}



  async function updateKPIs(){
    const k = await computeKPIsAsync();

    // Valeur totale
    const elTotal = document.getElementById('kpi-total-value');
    if (elTotal) elTotal.textContent = nf_eur.format(k.totalValue);

    const elTotalNote = document.getElementById('kpi-total-note');
    if (elTotalNote){
      const parts = [];
      if (k.srcCards)  parts.push(`cartes: ${k.srcCards}`);
      if (k.srcGraded && k.srcGraded !== 'aucun prix') parts.push(`gradées: ${k.srcGraded}`);
      if (k.srcSealed && k.srcSealed !== 'aucun prix') parts.push(`scellés: ${k.srcSealed}`);
      elTotalNote.textContent = parts.length ? `Basée sur ${parts.join(' · ')}` : 'Aucune colonne prix trouvée';
    }

    // Cartes
    const elCardsCount  = document.getElementById('kpi-cards-count');
    const elCardsPriced = document.getElementById('kpi-cards-priced');
    const elCardsTotal  = document.getElementById('kpi-cards-total');
    elCardsCount  && (elCardsCount.textContent  = nf_int.format(k.cCards));
    elCardsPriced && (elCardsPriced.textContent = nf_int.format(k.cardsPricedQty));
    elCardsTotal  && (elCardsTotal.textContent  = nf_int.format(k.cardsTotalQty));

    // Scellés
    const elSealedCount = document.getElementById('kpi-sealed-count');
    const elSealedValue = document.getElementById('kpi-sealed-value');
    elSealedCount && (elSealedCount.textContent = nf_int.format(k.cSealed));
    elSealedValue && (elSealedValue.textContent = nf_eur.format(k.vSealed || 0));

    // Gradées
    const elGradedCount = document.getElementById('kpi-graded-count');
    const elGradedValue = document.getElementById('kpi-graded-value');
    elGradedCount && (elGradedCount.textContent = nf_int.format(k.cGraded));
    elGradedValue && (elGradedValue.textContent = nf_eur.format(k.vGraded || 0));
  }

  /* ====================== RENDER ====================== */
  function render(){
    // CARTES
    const root=document.getElementById('cards-root');
    if(!(CARDS&&CARDS.length)){
      root.innerHTML=`<div class='empty'>Aucun CSV cartes chargé (auto : <code>${AUTO_SOURCES.cards}</code>)</div>`;
    }else{
      let rows=CARDS.slice();
      // Era filter first (cards)
      const eraSel=document.getElementById('era');
      const selectedEraKey = eraSel ? eraSel.value : 'all';
      if (selectedEraKey !== 'all') {
        rows = rows.filter(r => (eraFromSlug(slugify(r['Série'])||'')?.key || '') === selectedEraKey);
      }
      const serieSel=document.getElementById('serie');
      const selectedSlug = serieSel ? serieSel.value : 'all';
      if(selectedSlug !== 'all'){
        rows = rows.filter(r => slugify(r['Série']) === selectedSlug);
      }
      if(q && q.value.trim()){
        const qq=q.value.toLowerCase();
        rows=rows.filter(r=>['Nom','Numéro','Série'].some(k=>String(r[k]||'').toLowerCase().includes(qq)));
      }

      // Vue (possédées / manquantes / toutes)
const vSel = document.getElementById('view');
const mode = vSel ? vSel.value : 'owned';

if (mode === 'noprice') {
  // on a besoin du PriceBook ; si pas prêt, on charge et on relance render()
  if (!PriceBook.ready) {
    // petit message pendant le chargement
    const root = document.getElementById('cards-root');
    if (root) root.innerHTML = `<div class="empty">Chargement des prix…</div>`;
    ensurePriceBook().then(() => render());
    return; // on stoppe le rendu courant
  }

  // Filtre: je possède au moins 1 exemplaire ET une variante possédée n'a pas de prix
  rows = rows.filter(r => {
    if (!ownsAnyVariant(r)) return false;
    const entry = lookupEntryForRow(r);      // PriceBook déjà prêt ici
    return lacksPriceForOwned(r, entry);     // true => “sans prix”
  });
} else {
  // filtres existants
  rows = rows.filter(r => {
    const n  = Number(r['Nb Normal']);
    const rv = Number(r['Nb Reverse']);
    const sp = Number(r['Nb Spéciale']);
    const alt = Number(r['Alternative']);
    switch (mode) {
      case 'owned':           return (n>0) || (rv>0) || (sp>0);
      case 'missing':         return (n !== -1) && (n <= 0);
      case 'missing_reverse': return (rv !== -1) && (rv <= 0);
      case 'missing_alt':     return (alt === 1) && (sp <= 0);
      case 'all':
      default: return true;
    }
  });
}


      // Raretés cochées
      rows=rows.filter(r=>{ const {key}=rarityFromRow(r); return !key || selectedRarities.has(key); });

      // Groupes par série
      const groupsMap = new Map();
      rows.forEach(r=>{
        const sl = slugify(r['Série']);
        if(!groupsMap.has(sl)) groupsMap.set(sl, []);
        groupsMap.get(sl).push(r);
      });
      const groups = Array.from(groupsMap.entries()).sort((a,b)=>{
        const la = SERIE_CANON.get(a[0]) || '';
        const lb = SERIE_CANON.get(b[0]) || '';
        return la.localeCompare(lb,'fr');
      });

      let html='';
      const badges=(r)=>{ const n=Number(r['Nb Normal'])>0, rv=Number(r['Nb Reverse'])>0, sp=Number(r['Nb Spéciale'])>0; return `<span class='badges'>${n?`<span class='ball red' title='Normale'></span>`:''}${rv?`<span class='ball yellow' title='Reverse'></span>`:''}${sp?`<span class='ball blue' title='Alternative'></span>`:''}</span>`; };
      const rarityIconOnly = (r) => { const { key } = rarityFromRow(r); return key ? rarityIconsByKey(key) : "";};

      groups.forEach(([slug,arr])=>{
        const title = SERIE_CANON.get(slug) || 'Sans série';
        arr.sort(sortCardNumbers);

        // Ajoute le prix seulement quand une série précise est sélectionnée (affichage grille)
        const serieSel = document.getElementById('serie');
        const selectedSlug = serieSel ? serieSel.value : 'all';
        if (selectedSlug !== 'all' && selectedSlug === slug) {
          annotateRowsWithPrices(slug, arr);
        }

        html+=`<div class='section'><h3 style='margin:0 4px 10px 4px;font-size:16px;'>${escapeHtml(title)} <span class='hint'>(${arr.length} cartes)</span></h3><div class='grid'>`;
arr.forEach(r=>{
  const url = r['Image URL'] || r['Image'] || '';
  const img = url ? `<img loading='lazy' decoding='async' src='${url}' alt='${escapeHtml(r['Nom']||'')}'/>` : '';
  const qte = ownedQty(r);
  const prix = r['Prix'] ? String(r['Prix']) : null;

  // ★ Etoile si "Gradées" != 0
const gradedVal = Number(r['Gradées'] ?? 0);
const gradedBadge = (gradedVal !== 0)
  ? `<span class="ribbon-graded" aria-label="Gradée"><span>GRADÉE</span></span>`
  : '';

  
  html += `
  <div class='item'>
    <div class='thumb'>${gradedBadge}${img || '<span class="hint">(pas d\'image)</span>'}</div>
    <div class='meta compact'>
      <div class='title'>${escapeHtml(r['Nom']||'Sans nom')}</div>
      <div class='subline'>${escapeHtml(r['Numéro']||'—')}</div>
      <div class='foot'>
        <span class='left'>
          ${rarityIconOnly(r)}
          <span class='qty'>×${qte}</span>
          ${badges(r)}
        </span>
        ${prix ? `<span class='price'>${prix}</span>` : ''}
      </div>
    </div>
  </div>`;
});

        html+=`</div></div>`;
      });
      root.innerHTML=html||`<div class='empty'>Aucun résultat avec ces filtres.</div>`;
    }

    // SCELLÉS
    const rootS = document.getElementById('sealed-root');
    if (!(SEALED && SEALED.length)) {
      rootS.innerHTML = `<div class='empty'>Aucun CSV scellé chargé (auto : <code>${AUTO_SOURCES.sealed}</code>)</div>`;
    } else {
      let rows = SEALED.slice();

      const eraSelS = document.getElementById('eraS');
      const selectedEraSKey = eraSelS ? eraSelS.value : 'all';
      const selectedSlugS = document.getElementById('serieS') ? document.getElementById('serieS').value : 'all';
      if (selectedEraSKey !== 'all') rows = rows.filter(r => (eraFromSlug(slugify(r['Série'])||'')?.key || '') === selectedEraSKey);
      if (selectedSlugS !== 'all') rows = rows.filter(r => slugify(r['Série']) === selectedSlugS);

      const typeS = document.getElementById('typeS');
      if (typeS && typeS.value !== 'all') rows = rows.filter(r => normalize(r['Type'] || '') === typeS.value);

      const qs = document.getElementById('qs');
      if (qs && qs.value.trim()) {
        const qq = qs.value.toLowerCase();
        rows = rows.filter(r => ['Type','Détail','Commentaires','Série'].some(k => String(r[k] || '').toLowerCase().includes(qq)));
      }

      const sealedIcon = (type) => {
        const t = String(type || '').toLowerCase();
        if (/etb|elite/.test(t)) return '📦';
        if (/display|booster box|booster/.test(t)) return '🧃';
        if (/coffret|collection|premium|box/.test(t)) return '🎁';
        if (/tin|pok[eé]ball|ball/.test(t)) return '🛢️';
        if (/deck/.test(t)) return '🃏';
        return '🗃️';
      };

      const groupsMap = new Map();
      rows.forEach(r => {
        const sl = slugify(r['Série']);
        if(!groupsMap.has(sl)) groupsMap.set(sl, []);
        groupsMap.get(sl).push(r);
      });
      const groups = Array.from(groupsMap.entries()).sort((a,b)=>{
        const la = SERIE_CANON.get(a[0]) || '';
        const lb = SERIE_CANON.get(b[0]) || '';
        return la.localeCompare(lb, 'fr');
      });

      let html = '';
      groups.forEach(([slug, arr]) => {
        const title = SERIE_CANON.get(slug) || 'Sans série';
        html += `
          <div class="section">
            <h3 style="margin:0 4px 12px 4px;font-size:16px;">
              ${escapeHtml(title)} <span class="hint">(${arr.length})</span>
            </h3>
            <div class="grid sealed-grid">`;
arr.forEach(r => {
  const url = r['Image'] || '';
  const type = r['Type'] || 'Item';
  const detail = r['Détail'] || '';
  const com = r['Commentaires'] || '';

  // ➕ NEW: lecture du prix depuis le CSV, formatage €
  const priceVal  = parseEuro(r['Prix'] ?? r['Price'] ?? r['Valeur'] ?? r['Estimation'] ?? r['value']);
  const priceChip = (priceVal > 0) ? `<span class="chip chip-price">${nf_eur.format(priceVal)}</span>` : '';

  html += `
    <div class="sealed-card">
      <div class="sealed-thumb">
        ${url ? `<img loading="lazy" decoding="async" src="${url}" alt="${escapeHtml(type)}"/>`
              : `<span class="noimg hint">(pas d'image)</span>`}
      </div>
      <div class="sealed-meta">
        ${detail ? `<div class="sealed-sub top">${escapeHtml(detail)}</div>` : ''}
        <div class="sealed-chips single">
          <span class="chip"><span class="chip-ico">${sealedIcon(type)}</span>${escapeHtml(type)}</span>
          ${priceChip}                             <!-- ➕ NEW: chip prix -->
          ${com ? `<span class="chip muted">${escapeHtml(com)}</span>` : ''}
        </div>
      </div>
    </div>`;
});

        html += `</div></div>`;
      });
      rootS.innerHTML = html || `<div class='empty'>Aucun résultat.</div>`;
    }

    // GRADÉES
    const rootG = document.getElementById('graded-root');
    if (!(GRADED && GRADED.length)) {
      rootG.innerHTML = `<div class='empty'>Aucun CSV gradées chargé (auto : <code>${AUTO_SOURCES.graded}</code>)</div>`;
    } else {
      let rows = GRADED.slice();

      if (document.getElementById('company')?.value !== 'all') {
        rows = rows.filter(r => String(r['Société']) === document.getElementById('company').value);
      }
      if (document.getElementById('qg')?.value.trim()) {
        const qq = document.getElementById('qg').value.toLowerCase();
        rows = rows.filter(r => ['Nom','Edition','Détail'].some(k => String(r[k]||'').toLowerCase().includes(qq)));
      }
      const parseNote = v => { const s = String(v ?? '').replace(',', '.').trim(); const n = parseFloat(s); return Number.isFinite(n) ? n : NaN; };
      const min = parseNote(document.getElementById('minG')?.value);
      rows = rows.filter(r => { const n = parseNote(r['Note']); return Number.isNaN(n) ? true : n >= min; });

      rows.sort((a,b)=> String(a['Nom']||'').localeCompare(String(b['Nom']||''), 'fr'));

        const companyIcon = (name='')=>{
          const n = String(name).toUpperCase();
          if (n.includes('PSA')) {
            return `<svg viewBox="0 0 24 12" width="24" height="12" class="psa" aria-hidden="true">
                      <rect x="0" y="0" width="10" height="12" rx="2"/>
                      <rect x="14" y="0" width="10" height="12" rx="2"/>
                    </svg>`;
          }
          if (n.includes('PCA')) {
            return `<svg viewBox="0 0 24 24" width="16" height="16" class="pca" aria-hidden="true">
                      <polygon points="12,2 15,9 23,9 17,14 19,22 12,17 5,22 7,14 1,9 9,9"/>
                    </svg>`;
          }
          if (n.includes('BGS')) {
            return `<svg viewBox="0 0 24 24" width="16" height="16" class="bgs" aria-hidden="true">
                      <path d="M12 2l8 5v10l-8 5-8-5V7l8-5z"/>
                    </svg>`;
          }
          if (n.includes('CGC')) {
            return `<svg viewBox="0 0 24 24" width="16" height="16" class="cgc" aria-hidden="true">
                      <polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/>
                    </svg>`;
          }
          // fallback
          return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>`;
        };


      let html = `<div class="grid">`;
      rows.forEach(r=>{
        const img = r['Image'] ? `<img loading="lazy" decoding="async" src="${r['Image']}" alt="${escapeHtml(r['Nom']||'Carte gradée')}">` : '';
        const nom = r['Nom'] || 'Carte gradée';
        const comp = r['Société'] || '?';
        const note = r['Note'] ? String(r['Note']) : null;
        const sub  = [r['Edition']||'', r['Détail']||''].filter(Boolean).join(' • ');
          // --- NEW: prix unitaire depuis le CSV gradées (colonne "Prix")
        const priceVal = parseEuro(
          r['Prix'] ?? r['Price'] ?? r['Valeur'] ?? r['Estimation'] ?? r['value']
        );
        const priceChip = (priceVal > 0)
          ? `<span class="chip chip-price">${nf_eur.format(priceVal)}</span>`
          : '';

        html += `
          <div class="g-item">
            <div class="g-thumb">${img || '<span class="hint">(pas d\'image)</span>'}</div>
            <div class="g-meta">
              <div class="g-title">${escapeHtml(nom)}</div>
              ${sub ? `<div class="g-sub">${escapeHtml(sub)}</div>` : ''}
              <div class="g-foot">
                <span class="chip">${companyIcon(comp)} <b>${comp}</b>${note ? ` • <em>${note}</em>`:''}</span>
                ${priceChip}
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
      rootG.innerHTML = html || `<div class='empty'>Aucun résultat.</div>`;
    }

    // STATS
    renderStats();
  }

  /* ====================== ENHANCE STATS BARS ====================== */
  function enhanceStatsBars(){
    const rows = document.querySelectorAll('#stats-root .series');
    rows.forEach((row, i) => {
      const pctEl = row.querySelector('.s-meta .pct') || row.querySelector('.s-meta');
      const text   = pctEl?.textContent || "";
      const m      = text.match(/(\d+(?:\.\d+)?)\s*%/);
      const pct    = m ? parseFloat(m[1]) : 0;

      const fill = row.querySelector('.progress > span');
      if (fill){
        fill.style.setProperty('--w', pct + '%');
        void fill.offsetWidth; // restart
        fill.style.animation = 'stats-fill 1s cubic-bezier(.2,.8,.2,1) forwards';
        fill.style.animationDelay = `calc(${i} * .03s)`;
      }

      if (pctEl){
        pctEl.classList.remove('good','ok','bad');
        pctEl.classList.add(pct >= 95 ? 'good' : pct >= 70 ? 'ok' : 'bad');
      }
    });
  }

  // branche le scheduler APRÈS que render soit défini
  _renderRef = render;

  // premier rendu + KPIs init
  render();
  updateKPIs();
}
