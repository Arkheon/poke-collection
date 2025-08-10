// src/ui/statsView.js
import { eur } from '../domain/pricing.js';

/**
 * Monte la vue Stats dans #stats-root
 * @param {Object} deps
 * @param {HTMLElement} deps.root
 * @param {Array} deps.series              // retour de computeStatsPerSeries()
 * @param {Function} deps.loadPrices       // (slug)=>Promise<priceStats>
 */
export function mountStatsView({ root, series, loadPrices }) {
  if (!root) return;
  if (!Array.isArray(series) || !series.length) {
    root.innerHTML = `<div class="empty">Pas de données cartes chargées.</div>`;
    return;
  }

  // Accès facile aux données brutes par slug (pour copier / exporter)
  const bySlug = new Map(series.map(s => [s.slug, s]));

  root.innerHTML = series.map(s => `
    <div class="series" data-slug="${s.slug}">
      <div class="s-head" role="button">
        <div class="s-title">${s.label}</div>
        <div class="progress" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, s.completion)).toFixed(2)}%"></span></div>
        <div class="s-meta">${s.done} / ${s.size} (${s.completion.toFixed(1)}%)</div>
      </div>
      <div class="s-body">
        <div class="grid">
          <div class="col">
            <div class="card progression">
              <h3>Progression</h3>
              <div class="content">
                <div class="list">
                  <span class="pill"><span class="ball n"></span> <b>${s.ownedN}/${s.totN}</b></span>
                  <span class="pill"><span class="ball r"></span> <b>${s.ownedR}/${s.totR}</b></span>
                  <span class="pill"><span class="ball a"></span> <b>${s.ownedAlt}/${s.totAlt}</b></span>
                  <span class="pill"><span class="psa-ico" aria-label="PSA"></span> <b>${s.gradedTotal}</b></span>
                </div>
              </div>
            </div>

            <div class="card missing">
              <h3>Manquantes</h3>
              <div class="content">
                <div class="toolbar">
                  <button class="btn" data-miss="n" aria-pressed="true">Normales (${s.missN.length})</button>
                  <button class="btn" data-miss="r">Reverse (${s.missR.length})</button>
                  <button class="btn" data-miss="a">Alternatives (${s.missAlt.length})</button>
                </div>
                <div class="chips" id="miss-n-${s.slug}">${renderChips(s.missN)}</div>
                <div class="chips" id="miss-r-${s.slug}" hidden>${renderChips(s.missR)}</div>
                <div class="chips" id="miss-a-${s.slug}" hidden>${renderChips(s.missAlt)}</div>
              </div>
            </div>

            <div class="card top">
              <h3>Top cartes (prix normal)</h3>
              <div class="content"><div class="top-list" id="top-${s.slug}"><span class="muted">—</span></div></div>
            </div>
          </div>

          <div class="col">
            <div class="card value">
              <h3>Valeur</h3>
              <div class="content">
                <div class="tiles">
                  <div class="tile" data-view="set" data-label="Set unique" aria-current="true">
                    <div class="muted">Valeur set complet</div>
                    <b id="v-set-${s.slug}" class="num">—</b>
                    <div class="seg"><span class="ball n"></span><span id="v-set-n-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball r"></span><span id="v-set-r-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball a"></span><span id="v-set-a-${s.slug}" class="muted num">—</span></div>
                  </div>
                  <div class="tile" data-view="ownU" data-label="Possédé (unique)">
                    <div class="muted">Possédé (unique)</div>
                    <b id="v-ownU-${s.slug}" class="num">—</b>
                    <div class="seg"><span class="ball n"></span><span id="v-ownU-n-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball r"></span><span id="v-ownU-r-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball a"></span><span id="v-ownU-a-${s.slug}" class="muted num">—</span></div>
                  </div>
                  <div class="tile" data-view="ownD" data-label="Possédé (doublons)">
                    <div class="muted">Possédé (doublons)</div>
                    <b id="v-ownD-${s.slug}" class="num">—</b>
                    <div class="seg"><span class="ball n"></span><span id="v-ownD-n-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball r"></span><span id="v-ownD-r-${s.slug}" class="muted num">—</span></div>
                    <div class="seg"><span class="ball a"></span><span id="v-ownD-a-${s.slug}" class="muted num">—</span></div>
                  </div>
                </div>

                <div class="donut">
                  <svg viewBox="0 0 42 42" class="donut" id="dn-${s.slug}" aria-label="Répartition">
                    <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e5e7eb" stroke-width="6"></circle>
                    <circle class="seg-n" cx="21" cy="21" r="15.915" fill="none" stroke="#ef4444" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                    <circle class="seg-r" cx="21" cy="21" r="15.915" fill="none" stroke="#eab308" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                    <circle class="seg-a" cx="21" cy="21" r="15.915" fill="none" stroke="#3b82f6" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                  </svg>
                  <div class="mini-legend">
                    <span><span class="ball n"></span> <span id="dl-n-${s.slug}">—%</span></span>
                    <span><span class="ball r"></span> <span id="dl-r-${s.slug}">—%</span></span>
                    <span><span class="ball a"></span> <span id="dl-a-${s.slug}">—%</span></span>
                  </div>
                  <div class="muted" id="dn-label-${s.slug}">Répartition — Set unique</div>
                </div>
              </div>
            </div>

            <div class="card actions">
              <h3>Actions</h3>
              <div class="content">
                <div class="toolbar">
                  <button class="btn" data-action="copy" data-scope="n">Copier la liste manquantes</button>
                  <button class="btn" data-action="csv" data-scope="n">Exporter CSV</button>
                </div>
                <div class="hint">Astuce : le scope (N/R/Alt) suit l’onglet « Manquantes » sélectionné.</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `).join('');

  // ---------- Interactions (un seul listener par zone) ----------

  // 1) Accordeon : ouvrir une série ferme les autres
  root.querySelectorAll('.series .s-head').forEach(head=>{
    head.addEventListener('click', ()=>{
      const row = head.parentElement;
      const willOpen = !row.classList.contains('open');
      // ferme les autres
      root.querySelectorAll('.series.open').forEach(x=>{ if(x!==row) x.classList.remove('open'); });
      // (lazy) charge prix au premier open
      row.classList.toggle('open');
      if (willOpen) loadPriceBlock(row);
    });
  });

  // 2) Onglets Manquantes (délégation par série)
  root.querySelectorAll('.series .card.missing .toolbar').forEach(tb=>{
    tb.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-miss]'); if(!btn) return;
      const row  = btn.closest('.series'); const slug = row.dataset.slug;
      tb.querySelectorAll('[data-miss]').forEach(x=>x.removeAttribute('aria-pressed'));
      btn.setAttribute('aria-pressed','true');

      const g = btn.dataset.miss; // 'n' | 'r' | 'a'
      // show/hide lists
      ['n','r','a'].forEach(k=>{
        const box = row.querySelector(`#miss-${k}-${slug}`);
        if (box) box.hidden = (k !== g);
      });
      // propager le scope aux boutons d'action
      row.querySelectorAll('.card.actions [data-action]').forEach(b=> b.dataset.scope = g);
    });
  });

  // 3) Actions (copie / CSV) — une seule fois par série
  root.querySelectorAll('.series .card.actions .toolbar').forEach(tb=>{
    tb.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-action]'); if(!btn) return;
      const row = btn.closest('.series'); const slug = row.dataset.slug;
      const scope = btn.dataset.scope || 'n';
      const s = bySlug.get(slug);
      const list = scope==='r' ? s.missR : scope==='a' ? s.missAlt : s.missN;

      if (btn.dataset.action === 'copy') {
        const text = list.map(m => `${m.numero};${m.nom}`).join('\n') || '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copié !';
          setTimeout(()=>{ btn.textContent = 'Copier la liste manquantes'; }, 1200);
        } catch (err) {
          console.error('Clipboard error', err);
          alert('Impossible de copier (presse-papier bloqué par le navigateur).');
        }
      }

      if (btn.dataset.action === 'csv') {
        const rows = [['Numero','Nom'], ...list.map(m => [m.numero, m.nom])];
        const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `manquantes_${slug}_${scope}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
      }
    });
  });

  // 4) Valeur : click tuile => met à jour donut
  root.querySelectorAll('.series').forEach(row=>{
    row.addEventListener('click', (e)=>{
      const tile = e.target.closest('.tile[data-view]'); if(!tile) return;
      const slug = row.dataset.slug;
      row.querySelectorAll('.tile[data-view]').forEach(x=>x.removeAttribute('aria-current'));
      tile.setAttribute('aria-current','true');
      const store = row._priceStore;
      if(!store) return;
      const key = tile.dataset.view; // set | ownU | ownD
      const data = key==='ownU' ? store.OU : key==='ownD' ? store.OD : store.SU;
      updateDonut(slug, data);
      const lab = row.querySelector(`#dn-label-${slug}`); if(lab) lab.textContent = `Répartition — ${tile.dataset.label || key}`;
    });
  });

  // ---------- Helpers ----------

  function renderChips(arr){
    if(!arr || !arr.length) return '<span class="muted">—</span>';
    return arr.map(m=>`<span class="pill pill--sm">${m.numero} • ${m.nom}</span>`).join('');
  }

  function setTileValues(slug, key, vals){
    const id = (s)=>document.getElementById(`${s}-${slug}`);
    const fmt = (n)=> eur(n||0);
    id(`v-${key}`).textContent      = fmt(vals.total);
    id(`v-${key}-n`).textContent    = fmt(vals.normal);
    id(`v-${key}-r`).textContent    = fmt(vals.reverse);
    id(`v-${key}-a`).textContent    = fmt(vals.alt);
  }

  function updateDonut(slug, values){
    const svg = document.getElementById(`dn-${slug}`);
    if(!svg) return;
    const total = Math.max(1,(values.normal||0)+(values.reverse||0)+(values.alt||0));
    const n = (values.normal||0)/total*100;
    const r = (values.reverse||0)/total*100;
    const a = (values.alt||0)/total*100;
    const segN = svg.querySelector('.seg-n');
    const segR = svg.querySelector('.seg-r');
    const segA = svg.querySelector('.seg-a');
    segN.setAttribute('stroke-dasharray', `${n} ${100-n}`);
    segR.setAttribute('stroke-dasharray', `${r} ${100-r}`);
    segA.setAttribute('stroke-dasharray', `${a} ${100-a}`);
    segR.setAttribute('stroke-dashoffset', 25 - n);
    segA.setAttribute('stroke-dashoffset', 25 - n - r);
    // mini-legend
    const setTxt = (k,v)=>{ const el = document.getElementById(`dl-${k}-${slug}`); if(el) el.textContent = `${v.toFixed(0)}%`; };
    setTxt('n',n); setTxt('r',r); setTxt('a',a);
  }

  function escapeCSV(val){
    const s = String(val ?? '');
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  // charge les prix pour une série à l'ouverture
  async function loadPriceBlock(row){
    if (row._priceLoaded) return;
    row._priceLoaded = true;
    const slug = row.dataset.slug;

    try{
      const res = await loadPrices(slug);
      if (!res || !res.available) return;

      // valeurs
      const SU = res.setUnique, OU = res.ownedUnique, OD = res.setDoubles;
      setTileValues(slug, 'set',  SU);
      setTileValues(slug, 'ownU', OU);
      setTileValues(slug, 'ownD', OD);

      // memorise pour le donut et les tuiles
      row._priceStore = { SU, OU, OD };
      updateDonut(slug, SU);

      // top
      const list = row.querySelector('#top-'+slug);
      if(list){
        const html = (res.top10 || []).map(x=>`<span class="pill pill--sm">${x.numero} • ${x.nom} — ${eur(x.price)}</span>`).join('');
        list.innerHTML = html || '<span class="muted">—</span>';
      }
    }catch(err){
      console.error('loadPrices error', err);
    }
  }
}
