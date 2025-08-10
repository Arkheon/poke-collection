// src/app.js
export function boot() {
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', initApp)
    : initApp();
}


function initApp() {

  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', initApp) : initApp();

  function initApp(){
    const params = new URLSearchParams(location.search);
    const SHOW_UPLOADS = params.has('upload');
    if(!SHOW_UPLOADS){
      const up = document.querySelector('.uploads'); if(up) up.style.display='none';
      const demoBtn = document.getElementById('load-demo'); if(demoBtn) demoBtn.style.display='none';
    }

    const normalize = (s) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g,' ');
    const slugify = (s) => normalize(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

    let SERIE_CANON = new Map();

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
        case 'promo': return `<span class='rarity'><span class='rarity-label'>PROMO</span></span>`;
        default: return '';
      }
    }
    function rarityFromRow(r){ const code=String(r['Rareté']??'').trim(); const key=RARITY_MAP[code]; return {key,label:key?RARITY_LABELS[key]:null,raw:code}; }

    const selectedRarities = new Set(RARITY_ORDER);
    const rarityBtn=document.getElementById('rarityBtn');
    const rarityDD=document.getElementById('rarityDD');
    function buildRarityDropdown(){
      const box = document.getElementById('rarityChips');
      if(!box) return;
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
      if(!rarityBtn) return;
      if(selectedRarities.size===RARITY_ORDER.length) rarityBtn.textContent='Toutes les raretés';
      else if(selectedRarities.size===0) rarityBtn.textContent='Aucune sélection';
      else rarityBtn.textContent=`${selectedRarities.size} rareté(s) sélectionnée(s)`;
    }
    if(rarityBtn){
      rarityBtn.addEventListener('click', (e) => { e.stopPropagation(); rarityDD.hidden = !rarityDD.hidden; });
      rarityDD.addEventListener('click', (e) => { e.stopPropagation(); });
      document.addEventListener('click', (e) => { if (!rarityDD.hidden && !e.target.closest('.multi')) { rarityDD.hidden = true; } });
    }

    let CARDS=[], SEALED=[], GRADED=[];
    const AUTO_SOURCES={ cards:'cartes.csv', sealed:'scelle.csv', graded:'gradees.csv' };
    function loadCsvFromUrl(url, cb, onError){
      fetch(url,{cache:'no-store'})
        .then(r=>{ if(!r.ok) throw new Error(r.status+" "+r.statusText); return r.text(); })
        .then(text=> Papa.parse(text,{header:true,skipEmptyLines:true,complete:res=>cb(res.data)}))
        .catch(err=>{ console.warn('CSV auto-load failed for', url, err); onError && onError(err); });
    }
    loadCsvFromUrl(AUTO_SOURCES.cards, rows=>{ CARDS=normalizeRows(rows); refreshSeries(); render(); });
    loadCsvFromUrl(AUTO_SOURCES.sealed, rows=>{ SEALED=normalizeRows(rows); refreshSeries(); refreshSealedFilters(); render(); });
    loadCsvFromUrl(AUTO_SOURCES.graded, rows=>{ GRADED=normalizeRows(rows); refreshCompanies(); render(); });

    function normalizeRows(rows){
      return rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k).trim(), typeof v==='string'? v.trim(): v])));
    }

    if(SHOW_UPLOADS){
      document.getElementById('csv-cards').addEventListener('change', e=>{
        const f=e.target.files?.[0]; if(!f) return; parseFile(f, rows=>{ CARDS=normalizeRows(rows); refreshSeries(); render(); });
      });
      document.getElementById('csv-sealed').addEventListener('change', e=>{
        const f=e.target.files?.[0]; if(!f) return; parseFile(f, rows=>{ SEALED=normalizeRows(rows); refreshSeries(); refreshSealedFilters(); render(); });
      });
      document.getElementById('csv-graded').addEventListener('change', e=>{
        const f=e.target.files?.[0]; if(!f) return; parseFile(f, rows=>{ GRADED=normalizeRows(rows); refreshCompanies(); render(); });
      });
      document.getElementById('load-demo').addEventListener('click', ()=>{
        CARDS=[
          {'Série':'151','Numéro':'1/165','Nom':'Bulbizarre','Rareté':'1','Nb Normal':'1','Nb Reverse':'1','Nb Spéciale':'0','Alternative':'-1','Image URL':'https://images.pokemontcg.io/sv3/fr/1_hires.png'},
          {'Série':'Écarlate et Violet','Numéro':'14/198','Nom':'Rare','Rareté':'5','Nb Normal':'1','Alternative':'1','Nb Spéciale':'0'},
          {'Série':'Zénith Suprême','Numéro':'GG05','Nom':'Lokhlass','Rareté':'33','Nb Normal':'1','Alternative':'1','Nb Spéciale':'1'},
        ];
        SEALED=[{'Série':'151','Type':'ETB','Détail':'Exemple','Commentaires':'—','Image':'https://via.placeholder.com/400x250?text=ETB+151'}];
        GRADED=[{'Nom':'Pikachu','Edition':'SWSH','Société':'PSA','Note':'10','Détail':'Test','Image':'https://via.placeholder.com/400x250?text=PSA+10'}];
        refreshSeries(); refreshSealedFilters(); refreshCompanies(); render();
      });
    }
    function parseFile(file, cb){ Papa.parse(file,{header:true,skipEmptyLines:true,complete:res=>cb(res.data)}); }

    const q=document.getElementById('q');
    const serie=document.getElementById('serie');
    const view=document.getElementById('view');
    q.oninput=serie.onchange=view.onchange=()=>render();

    const qs=document.getElementById('qs');
    const serieS=document.getElementById('serieS');
    const typeS=document.getElementById('typeS');
    if(qs) qs.oninput=()=>render();
    if(serieS) serieS.onchange=()=>render();
    if(typeS) typeS.onchange=()=>render();

    const qg=document.getElementById('qg');
    const company=document.getElementById('company');
    const minG=document.getElementById('minG');
    const minG_label=document.getElementById('minG_label');
    if(qg) qg.oninput=()=>render();
    if(company) company.onchange=()=>render();
    if(minG) minG.oninput=()=>{minG_label.textContent=minG.value; render();}

    buildRarityDropdown();

    // ===================== PRIX : chargement & cache =====================
    const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
    let FR_SET_MAP = {};                    // { slug(série FR) -> setId }
    const PRICE_CACHE = new Map();          // setId -> items (num -> prix)

    function eur(n){ return (n??0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }

    async function loadFrMap(){
      try{
        const r = await fetch('data/fr_map.json',{cache:'no-store'});
        const m = await r.json();
        const norm={}; Object.entries(m).forEach(([k,v])=>{ norm[slugify(k)] = v; });
        FR_SET_MAP = norm;
      }catch(e){ console.warn('fr_map.json introuvable', e); }
    }
    loadFrMap(); // charge dès le départ

    function readSetCache(setId){
      try{
        const raw = localStorage.getItem('ptcg_prices_'+setId);
        if(!raw) return null;
        const o = JSON.parse(raw);
        if(Date.now() - o.ts > PRICE_TTL_MS) return null;
        return o.items || null;
      }catch{ return null; }
    }
    function writeSetCache(setId, items){
      try{ localStorage.setItem('ptcg_prices_'+setId, JSON.stringify({ts:Date.now(), items})); }catch{}
    }

    async function getSetPrices(setId){
      if(!setId) return {};
      if(PRICE_CACHE.has(setId) && PRICE_CACHE.get(setId) !== 'loading') return PRICE_CACHE.get(setId);
      const cached = readSetCache(setId);
      if(cached){ PRICE_CACHE.set(setId, cached); return cached; }
      PRICE_CACHE.set(setId, 'loading');
      try{
        const r = await fetch(`public/prices/${setId}.json`, {cache:'no-store'});
        const j = await r.json();
        const items = j.items || {};
        PRICE_CACHE.set(setId, items);
        writeSetCache(setId, items);
        return items;
      }catch(e){
        console.warn('prix non chargés', setId, e);
        PRICE_CACHE.delete(setId);
        return {};
      }
    }

    function baseNumber(row){
      const s = String(row['Numéro']||'').trim();
      let m = s.match(/^(\d+)\s*\/\s*\d+$/); if(m) return m[1];       // 186/198
      m = s.match(/^[A-Za-z]+0*?(\d{1,3})$/); if(m) return String(parseInt(m[1],10)); // GG05 -> 5
      const d = s.replace(/\D/g,''); return d || s;
    }

    // --- prix par variante (avec fallback reverse -> normal) ---
    function priceFromEntry(entry, variant){
      if(!entry) return 0;
      const base = Number(entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? 0) || 0;
      if(variant === 'reverse'){
        const rr = Number(entry.reverseTrend ?? 0);
        return rr > 0 ? rr : base;
      }
      return base;
    }
    // Personnalisation possible : window.ALT_PRICE_BY_SET = { sv7:{mode:'reverse'}, sv3pt5:{mode:'multiplier',factor:2} }
    function altPriceFromEntry(entry, setId){
      // défaut = même prix que reverse (repli normal)
      let val = priceFromEntry(entry,'reverse');
      const ov = (window.ALT_PRICE_BY_SET && setId && window.ALT_PRICE_BY_SET[setId]) || null;
      if(ov){
        if(ov.mode === 'normal') val = priceFromEntry(entry,'normal');
        if(ov.mode === 'multiplier'){
          const base = priceFromEntry(entry,'reverse') || priceFromEntry(entry,'normal');
          const f = Number(ov.factor||1);
          val = base * f;
        }
      }
      return val;
    }
    function posInt(v){ const n = Number(String(v??'').replace(',','.')); return Number.isFinite(n) ? Math.max(0,n) : 0; }

    // annote les lignes d'une série avec r['Prix'] (affichage liste cartes)
    function choosePrice(entry, row){
      if(!entry) return null;
      const reverseExists = Number(row['Nb Reverse']) !== -1;
      const reverseOwned  = Number(row['Nb Reverse']) > 0;
      if((reverseOwned || reverseExists) && entry.reverseTrend) return entry.reverseTrend;
      return entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? null;
    }
    function annotateRowsWithPrices(slug, arr){
      const setId = FR_SET_MAP[slug]; if(!setId) return;
      const items = PRICE_CACHE.get(setId);
      if(items && items !== 'loading'){
        arr.forEach(r=>{
          const num = baseNumber(r);
          const p = choosePrice(items[num], r);
          if(p!=null) r['Prix'] = eur(Number(p));
        });
        return;
      }
      if(!PRICE_CACHE.has(setId)){
        PRICE_CACHE.set(setId,'loading');
        getSetPrices(setId).then(()=>{ try{ render(); }catch{} });
      }
    }

    // ======= STATS (avec Alternative + Gradées) =======
    function parseNumDen(numStr){
      const s = String(numStr||'').trim();
      const m = s.match(/^(\d+)\s*\/\s*(\d+)$/i);
      if(!m) return null;
      return {num:parseInt(m[1],10), den:parseInt(m[2],10)};
    }
    function parseSubset(numStr){
      const s = String(numStr||'').trim();
      const m = s.match(/^([A-Za-z]+)\s*0*?(\d{1,3})$/i);
      if(!m) return null;
      return {prefix:m[1].toUpperCase(), n:parseInt(m[2],10)};
    }

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
        const isNumDen = /^\d+\s*\/\s*\d+$/i.test(numStr);
        const isSubset = /^[A-Za-z]+\s*0*?\d{1,3}$/i.test(numStr);

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

    // ===== Valeur / Top 10 par série (nouvelle logique N/R/Alt) =====
    async function computePriceStatsForSeries(slug){
      const setId = FR_SET_MAP[slug];
      if(!setId) return {available:false};
      const items = await getSetPrices(setId);
      const rows = CARDS.filter(r=>slugify(r['Série'])===slug);

      let setU = {normal:0, reverse:0, alt:0};
      let ownU = {normal:0, reverse:0, alt:0};
      let ownD = {normal:0, reverse:0, alt:0};

      const topAll = [];

      for(const r of rows){
        const idx = Number(baseNumber(r));
        const e = items[idx];
        if(!e) continue;

        const hasNormal  = Number(r['Nb Normal']) !== -1;      // la carte existe en normal (inclut secrètes)
        const hasReverse = Number(r['Nb Reverse']) !== -1;
        const hasAlt     = Number(r['Alternative']) === 1;

        const pNorm = hasNormal  ? priceFromEntry(e, 'normal')  : 0;
        const pRev  = hasReverse ? priceFromEntry(e, 'reverse') : 0;
        const pAlt  = hasAlt     ? altPriceFromEntry(e, setId)  : 0;

        // --- Set (unique complet) : 1 de chaque version qui existe ---
        if(hasNormal)  setU.normal += pNorm;
        if(hasReverse) setU.reverse += pRev;
        if(hasAlt)     setU.alt    += pAlt;

        // --- Possédé (unique) : 1 par version possédée ---
        const qNorm = posInt(r['Nb Normal']) + posInt(r['Nb Ed1']);
        const qRev  = hasReverse ? posInt(r['Nb Reverse']) : 0;
        const qAlt  = hasAlt ? posInt(r['Nb Spéciale'] ?? r['Nb Speciale'] ?? 0) : 0;

        if(qNorm>0) ownU.normal += pNorm;
        if(qRev >0) ownU.reverse += pRev;
        if(qAlt >0) ownU.alt    += pAlt;

        // --- Possédé (doublons) : quantités réelles ---
        ownD.normal += qNorm * pNorm;
        ownD.reverse+= qRev  * pRev;
        ownD.alt    += qAlt  * pAlt;

        // Top 10 par prix normal (info)
        topAll.push({numero:String(r['Numéro']||'—'), nom:String(r['Nom']||''), price: pNorm});
      }

      const sum = o => o.normal + o.reverse + o.alt;

      topAll.sort((a,b)=> b.price - a.price);
      const top10 = topAll.slice(0,10);

      return {
        available:true,
        setId,
        setUnique:  {...setU, total: sum(setU)},
        ownedUnique:{...ownU, total: sum(ownU)},
        setDoubles: {...ownD, total: sum(ownD)},
        top10
      };
    }

    function renderStats(){
      const root = document.getElementById('stats-root');
      const data = computeStatsPerSeries();
      if(!data.length){ root.innerHTML = `<div class="empty">Pas de données cartes chargées.</div>`; root.onclick=null; return; }

      let html = '';
      const chips = (arr)=> arr.map(m=>`<span>${m.numero} • ${m.nom}</span>`).join('') || '<span class="hint">—</span>';

      data.forEach(s=>{
        const pct = Math.max(0, Math.min(100, s.completion));
        html += `
          <div class="stat-row" data-slug="${s.slug}">
            <div class="stat-head">
              <div class="stat-title">${s.label}</div>
              <div class="progress" aria-hidden="true"><span style="width:${pct.toFixed(2)}%"></span></div>
              <div class="stat-meta">${s.done} / ${s.size} (${pct.toFixed(1)}%)</div>
            </div>
            <div class="stat-body">
              <div class="stat-break">
                <div><b>Normales :</b> ${s.ownedN} / ${s.totN}</div>
                <div><b>Reverse :</b> ${s.ownedR} / ${s.totR}</div>
                <div><b>Alternatives :</b> ${s.ownedAlt} / ${s.totAlt}</div>
                <div><b>Gradées :</b> ${s.gradedTotal} <span class="hint">(PCA: ${s.gradedPCA}, PSA: ${s.gradedPSA})</span></div>
              </div>

              <div class="missing">
                <h4>Manquantes (normales) — ${s.missN.length}</h4>
                <div class="chips-list">${chips(s.missN)}</div>
              </div>

              <div class="missing">
                <h4>Manquantes (reverse) — ${s.missR.length}</h4>
                <div class="chips-list">${chips(s.missR)}</div>
              </div>

              <div class="missing">
                <h4>Manquantes (alternatives) — ${s.missAlt.length}</h4>
                <div class="chips-list">${chips(s.missAlt)}</div>
              </div>

              <div class="missing">
                <h4>Valeur & Top (Cardmarket)</h4>
                <div id="price-${s.slug}">
                  <div class="stat-break">
                    <div>
                      <b>Valeur set complet :</b> <span id="p-set-${s.slug}" class="hint">—</span>
                      <div class="hint">N: <span id="p-setN-${s.slug}">—</span> · R: <span id="p-setR-${s.slug}">—</span> · Alt: <span id="p-setA-${s.slug}">—</span></div>
                    </div>
                    <div>
                      <b>Possédé (unique) :</b> <span id="p-ownu-${s.slug}" class="hint">—</span>
                      <div class="hint">N: <span id="p-ownuN-${s.slug}">—</span> · R: <span id="p-ownuR-${s.slug}">—</span> · Alt: <span id="p-ownuA-${s.slug}">—</span></div>
                    </div>
                    <div>
                      <b>Possédé (doublons) :</b> <span id="p-ownd-${s.slug}" class="hint">—</span>
                      <div class="hint">N: <span id="p-owndN-${s.slug}">—</span> · R: <span id="p-owndR-${s.slug}">—</span> · Alt: <span id="p-owndA-${s.slug}">—</span></div>
                    </div>
                  </div>
                  <div class="missing">
                    <h4>Top 10 (prix normal)</h4>
                    <div class="chips-list" id="p-top-${s.slug}"><span class="hint">—</span></div>
                  </div>
                </div>
              </div>

            </div>
          </div>`;
      });
      root.innerHTML = html;

      // toggle + calcul prix au premier déploiement
      root.onclick = async (e)=>{
        const head = e.target.closest('.stat-head');
        if(!head) return;
        const row = head.parentElement;
        row.classList.toggle('open');

        const slug = row.dataset.slug;
        const block = document.getElementById('price-'+slug);
        if(block && !block.dataset.ready){
          block.dataset.ready = '1';
          const res = await computePriceStatsForSeries(slug);
          if(!res.available){
            block.innerHTML = `<span class="hint">Aucun setId mappé pour cette série (voir data/fr_map.json).</span>`;
            return;
          }
          const SU = res.setUnique, OU = res.ownedUnique, OD = res.setDoubles;
          document.getElementById('p-set-'+slug).textContent   = eur(SU.total);
          document.getElementById('p-ownu-'+slug).textContent  = eur(OU.total);
          document.getElementById('p-ownd-'+slug).textContent  = eur(OD.total);

          document.getElementById('p-setN-'+slug).textContent  = eur(SU.normal);
          document.getElementById('p-setR-'+slug).textContent  = eur(SU.reverse);
          document.getElementById('p-setA-'+slug).textContent  = eur(SU.alt);

          document.getElementById('p-ownuN-'+slug).textContent = eur(OU.normal);
          document.getElementById('p-ownuR-'+slug).textContent = eur(OU.reverse);
          document.getElementById('p-ownuA-'+slug).textContent = eur(OU.alt);

          document.getElementById('p-owndN-'+slug).textContent = eur(OD.normal);
          document.getElementById('p-owndR-'+slug).textContent = eur(OD.reverse);
          document.getElementById('p-owndA-'+slug).textContent = eur(OD.alt);

          const topBox = document.getElementById('p-top-'+slug);
          topBox.innerHTML = res.top10.map(x=>`<span>${x.numero} • ${x.nom} — ${eur(x.price)}</span>`).join('') || '<span class="hint">—</span>';
        }
      };
    }

    function rebuildSerieCanon() {
      const map = new Map();
      CARDS.forEach(r=>{
        const raw = normalize(r['Série']);
        if(!raw) return;
        const sl = slugify(raw);
        if(!map.has(sl)) map.set(sl, raw);
      });
      SEALED.forEach(r=>{
        const raw = normalize(r['Série']);
        if(!raw) return;
        const sl = slugify(raw);
        if(!map.has(sl)) map.set(sl, raw);
      });
      SERIE_CANON = map;
    }
    function refreshSeries(){
      rebuildSerieCanon();
      const options = ['all', ...Array.from(SERIE_CANON.keys()).sort((a,b)=>{
        return SERIE_CANON.get(a).localeCompare(SERIE_CANON.get(b),'fr');
      })];
      serie.innerHTML = options.map(sl=>{
        return `<option value="${sl}">${sl==='all' ? 'Toutes' : SERIE_CANON.get(sl)}</option>`;
      }).join('');
      const sSet = new Set(SEALED.map(r=>slugify(r['Série']||'')));
      const sList = ['all', ...Array.from(sSet).filter(Boolean).sort((a,b)=>{
        return SERIE_CANON.get(a)?.localeCompare(SERIE_CANON.get(b),'fr');
      })];
      if(serieS){
        serieS.innerHTML = sList.map(sl=>{
          const label = sl==='all' ? 'Toutes' : (SERIE_CANON.get(sl) || '');
          return `<option value="${sl}">${label}</option>`;
        }).join('');
      }
    }
    function refreshSealedFilters(){
      if(!(SEALED && SEALED.length)) return;
      const t=new Set();
      SEALED.forEach(r=>{ const raw = normalize(r['Type']); if(raw) t.add(raw); });
      const tOpt=['all',...Array.from(t).sort((a,b)=>a.localeCompare(b,'fr'))];
      if(typeS) typeS.innerHTML=tOpt.map(v=>`<option value="${v}">${v==='all'?'Tous':v}</option>`).join('');
    }
    function refreshCompanies(){
      const s=new Set(GRADED.map(r=>String(r['Société']||'')));
      const options=['all',...Array.from(s).filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'))];
      company.innerHTML=options.map(v=>`<option value="${v}">${v==='all'?'Toutes':v}</option>`).join('');
    }

    function ownedQty(r){
      const keys=["Nb Normal","Nb Ed1","Nb Reverse","Nb Spéciale","Quantité","Qty"]; 
      return keys.map(k=>{ const n=Number(r[k]); return Number.isNaN(n)?0:Math.max(0,n); }).reduce((a,b)=>a+b,0);
    }
    function sortCardNumbers(a,b){
      const A=String(a['Numéro']||''); const B=String(b['Numéro']||'');
      const [mA,sA]=A.split('/').map(x=>parseInt(x,10)); const [mB,sB]=B.split('/').map(x=>parseInt(x,10));
      if(!Number.isNaN(mA)&&!Number.isNaN(mB)){ if(mA!==mB) return mA-mB; if(!Number.isNaN(sA)&&!Number.isNaN(sB)) return sA-sB; }
      return A.localeCompare(B,'fr',{numeric:true});
    }

    const modal=document.getElementById('imgModal');
    const modalImg=document.getElementById('modalImg');
    const modalClose=document.getElementById('modalClose');
    function openModal(src,alt){
      modalImg.src=src; modalImg.alt=alt||''; modal.classList.add('open');
      document.body.style.overflow='hidden';
    }
    function closeModal(){
      modal.classList.remove('open'); modalImg.src='';
      document.body.style.overflow='';
    }
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
    document.body.addEventListener('click', (e)=>{
      const img = e.target.closest('.thumb img');
      if(img){ openModal(img.src, img.alt); }
    });

    function render(){
      // CARTES
      const root=document.getElementById('cards-root');
      if(!(CARDS&&CARDS.length)){ root.innerHTML=`<div class='empty'>Aucun CSV cartes chargé (auto : <code>${AUTO_SOURCES.cards}</code>)</div>`; }
      else{
        let rows=CARDS.slice();
        const selectedSlug = serie.value;
        if(selectedSlug !== 'all'){
          rows = rows.filter(r => slugify(r['Série']) === selectedSlug);
        }
        if(q.value.trim()){
          const qq=q.value.toLowerCase();
          rows=rows.filter(r=>['Nom','Numéro','Série'].some(k=>String(r[k]||'').toLowerCase().includes(qq)));
        }

        // Vue (possédées / manquantes / toutes)
        const mode = document.getElementById('view').value;
        rows = rows.filter(r => {
          const n  = Number(r['Nb Normal']);
          const rv = Number(r['Nb Reverse']);
          const sp = Number(r['Nb Spéciale']);
          const alt = Number(r['Alternative']);
          switch (mode) {
            case 'owned':           return (n>0) || (rv>0) || (sp>0) || (Number(r['Nb Ed1'])>0);
            case 'missing':         return (n !== -1) && (n <= 0);
            case 'missing_reverse': return (rv !== -1) && (rv <= 0);
            case 'missing_alt':     return (alt === 1) && (sp <= 0);
            case 'all':
            default: return true;
          }
        });

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
        const rarityHtml=(r)=>{ const {key,label,raw}=rarityFromRow(r); return key? `${rarityIconsByKey(key)} <span class='rarity-label'>${label}</span>`: `<span class='rarity-label'>Rareté: ${raw||'—'}</span>`; };
        const badges=(r)=>{ const n=Number(r['Nb Normal'])>0, rv=Number(r['Nb Reverse'])>0, sp=Number(r['Nb Spéciale'])>0; return `<span class='badges'>${n?`<span class='ball red' title='Normale'></span>`:''}${rv?`<span class='ball yellow' title='Reverse'></span>`:''}${sp?`<span class='ball blue' title='Alternative'></span>`:''}</span>`; };

        groups.forEach(([slug,arr])=>{
          const title = SERIE_CANON.get(slug) || 'Sans série';
          arr.sort(sortCardNumbers);

          // ==> ajoute le prix si dispo (chargement lazy par série)
          annotateRowsWithPrices(slug, arr);

          html+=`<div class='section'><h3 style='margin:0 4px 10px 4px;font-size:16px;'>${title} <span class='hint'>(${arr.length} cartes)</span></h3><div class='grid'>`;
          arr.forEach(r=>{
            const url = r['Image URL'] || r['Image'] || '';
            const img = url? `<img loading='lazy' src='${url}' alt='${(r['Nom']||'')}'/>` : '';
            const qte=ownedQty(r);
            html+=`<div class='item'>
              <div class='thumb'>${img || '<span class="hint">(pas d\'image)</span>'}</div>
              <div class='meta'>
                <div class='t'>${(r['Numéro']||'')} • ${(r['Nom']||'Sans nom')}</div>
                <div class='s'>${rarityHtml(r)}<span>Qté: ${qte}</span>${badges(r)}</div>
                ${r['Prix']? `<div class='s'>Prix: ${r['Prix']}</div>`:''}
              </div>
            </div>`;
          });
          html+=`</div></div>`;
        });
        root.innerHTML=html||`<div class='empty'>Aucun résultat avec ces filtres.</div>`;
      }

      // SCELLÉ
      const rootS=document.getElementById('sealed-root');
      if(!(SEALED&&SEALED.length)){ rootS.innerHTML=`<div class='empty'>Aucun CSV scellé chargé (auto : <code>${AUTO_SOURCES.sealed}</code>)</div>`; }
      else{
        let rows=SEALED.slice();
        const selectedSlugS = document.getElementById('serieS') ? document.getElementById('serieS').value : 'all';
        if(selectedSlugS!=='all') rows=rows.filter(r=>slugify(r['Série'])===selectedSlugS);
        if(typeS && typeS.value!=='all') rows=rows.filter(r=>normalize(r['Type']||'')===typeS.value);
        if(qs && qs.value.trim()){
          const qq=qs.value.toLowerCase();
          rows=rows.filter(r=>['Type','Détail','Commentaires','Série'].some(k=>String(r[k]||'').toLowerCase().includes(qq)));
        }
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
        groups.forEach(([slug,arr])=>{
          const title = SERIE_CANON.get(slug) || 'Sans série';
          html+=`<div class='section'><h3 style='margin:0 4px 10px 4px;font-size:16px;'>${title} <span class='hint'>(${arr.length})</span></h3><div class='grid' style='grid-template-columns:repeat(3,1fr)'>`;
          arr.forEach(r=>{
            const img = r['Image']? `<img loading='lazy' src='${r['Image']}' alt='${(r['Type']||'Item')}'/>` : '';
            html+=`<div class='item'>
              <div class='thumb img-short'>${img || '<span class="hint">(pas d\'image)</span>'}</div>
              <div class='meta'>
                <div class='t'>${(r['Type']||'Item')}</div>
                ${r['Détail']? `<div class='s'>Détail: ${r['Détail']}</div>`:''}
                ${r['Commentaires']? `<div class='s'>${r['Commentaires']}</div>`:''}
              </div>
            </div>`;
          });
          html+=`</div></div>`;
        });
        rootS.innerHTML=html;
      }

      // GRADÉES
      const rootG=document.getElementById('graded-root');
      if(!(GRADED&&GRADED.length)){ rootG.innerHTML=`<div class='empty'>Aucun CSV gradées chargé (auto : <code>${AUTO_SOURCES.graded}</code>)</div>`; }
      else{
        let rows=GRADED.slice();
        if(document.getElementById('company').value!=='all') rows=rows.filter(r=>String(r['Société'])===document.getElementById('company').value);
        if(document.getElementById('qg').value.trim()){ const qq=document.getElementById('qg').value.toLowerCase(); rows=rows.filter(r=>['Nom','Edition','Détail'].some(k=>String(r[k]||'').toLowerCase().includes(qq))); }
        const parseNote = v => { const s=String(v??'').replace(',', '.').trim(); const n=parseFloat(s); return Number.isFinite(n)? n : NaN; };
        const min=parseNote(document.getElementById('minG').value);
        rows=rows.filter(r=>{ const n=parseNote(r['Note']); return Number.isNaN(n)? true : n>=min; });
        rows.sort((a,b)=> String(a['Nom']||'').localeCompare(String(b['Nom']||''),'fr'));
        let html=`<div class='grid' style='grid-template-columns:repeat(3,1fr)'>`;
        rows.forEach(r=>{
          const img = r['Image']? `<img loading='lazy' src='${r['Image']}' alt='${(r['Nom']||'Carte')}'/>` : '';
          html+=`<div class='item'>
            <div class='thumb img-short'>${img || '<span class="hint">(pas d\'image)</span>'}</div>
            <div class='meta'>
              <div class='t'>${r['Nom']||'Carte'}</div>
              <div class='s'>Note: ${(r['Note']??'—')} (${r['Société']||'?'})</div>
              ${r['Edition']? `<div class='s'>Édition: ${r['Edition']}</div>`:''}
              ${r['Détail']? `<div class='s'>${r['Détail']}</div>`:''}
            </div>
          </div>`;
        });
        html+=`</div>`;
        rootG.innerHTML=html||`<div class='empty'>Aucun résultat.</div>`;
      }

      renderStats();
    }

    function rebuildSerieCanon() {
      const map = new Map();
      CARDS.forEach(r=>{
        const raw = normalize(r['Série']);
        if(!raw) return;
        const sl = slugify(raw);
        if(!map.has(sl)) map.set(sl, raw);
      });
      SEALED.forEach(r=>{
        const raw = normalize(r['Série']);
        if(!raw) return;
        const sl = slugify(raw);
        if(!map.has(sl)) map.set(sl, raw);
      });
      SERIE_CANON = map;
    }
    function refreshSeries(){
      rebuildSerieCanon();
      const options = ['all', ...Array.from(SERIE_CANON.keys()).sort((a,b)=>{
        return SERIE_CANON.get(a).localeCompare(SERIE_CANON.get(b),'fr');
      })];
      serie.innerHTML = options.map(sl=>{
        return `<option value="${sl}">${sl==='all' ? 'Toutes' : SERIE_CANON.get(sl)}</option>`;
      }).join('');
      const sSet = new Set(SEALED.map(r=>slugify(r['Série']||'')));
      const sList = ['all', ...Array.from(sSet).filter(Boolean).sort((a,b)=>{
        return SERIE_CANON.get(a)?.localeCompare(SERIE_CANON.get(b),'fr');
      })];
      if(serieS){
        serieS.innerHTML = sList.map(sl=>{
          const label = sl==='all' ? 'Toutes' : (SERIE_CANON.get(sl) || '');
          return `<option value="${sl}">${label}</option>`;
        }).join('');
      }
    }
    function refreshSealedFilters(){
      if(!(SEALED && SEALED.length)) return;
      const t=new Set();
      SEALED.forEach(r=>{ const raw = normalize(r['Type']); if(raw) t.add(raw); });
      const tOpt=['all',...Array.from(t).sort((a,b)=>a.localeCompare(b,'fr'))];
      if(typeS) typeS.innerHTML=tOpt.map(v=>`<option value="${v}">${v==='all'?'Tous':v}</option>`).join('');
    }
    function refreshCompanies(){
      const s=new Set(GRADED.map(r=>String(r['Société']||'')));
      const options=['all',...Array.from(s).filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'))];
      company.innerHTML=options.map(v=>`<option value="${v}">${v==='all'?'Toutes':v}</option>`).join('');
    }

    function parseFile(file, cb){ Papa.parse(file,{header:true,skipEmptyLines:true,complete:res=>cb(res.data)}); }
  }
  
}

