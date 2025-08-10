// src/ui/statsView.js
import { eur } from '../domain/pricing.js';

/**
 * Monte la vue Stats dans #stats-root
 * @param {Object} deps
 * @param {HTMLElement} deps.root - conteneur
 * @param {Array} deps.series - retour de computeStatsPerSeries()
 * @param {Function} deps.loadPrices - (slug)=>Promise<priceStats> (computePriceStatsForSeries)
 */
export function mountStatsView({ root, series, loadPrices }) {
  if (!root) return;
  if (!Array.isArray(series) || !series.length) {
    root.innerHTML = `<div class="empty">Pas de données cartes chargées.</div>`;
    return;
  }

  // ---------- RENDER ----------
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
                  <button class="btn" data-miss="n">Normales (${s.missN.length})</button>
                  <button class="btn" data-miss="r">Reverse (${s.missR.length})</button>
                  <button class="btn" data-miss="a" aria-pressed="true">Alternatives (${s.missAlt.length})</button>
                </div>
                <div class="chips" id="miss-a-${s.slug}">${renderChips(s.missAlt)}</div>
                <div class="chips" id="miss-n-${s.slug}" hidden>${renderChips(s.missN)}</div>
                <div class="chips" id="miss-r-${s.slug}" hidden>${renderChips(s.missR)}</div>
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
                  <button class="btn">Copier la liste manquantes</button>
                  <button class="btn">Exporter CSV</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `).join('');

  // ---------- INTERACTIONS ----------

  // A) Accordéon : ouvrir une série ferme les autres
  root.querySelectorAll('.series .s-head').forEach(h=>{
    h.addEventListener('click', ()=>{
      const row = h.parentElement;
      const willOpen = !row.classList.contains('open');
      root.querySelectorAll('.series.open').forEach(x=>{ if(x!==row) x.classList.remove('open'); });
      row.classList.toggle('open', willOpen);
    });
  });

  // B) Onglets "Manquantes" + Actions (copie/export)
  root.addEventListener('click', async (e) => {
    // Tabs manquantes
    const btnMiss = e.target.closest('.card.missing .btn[data-miss]');
    if (btnMiss) {
      const row = btnMiss.closest('.series');
      const slug = row.dataset.slug;
      btnMiss.parentElement.querySelectorAll('[data-miss]').forEach(x=>x.removeAttribute('aria-pressed'));
      btnMiss.setAttribute('aria-pressed','true');
      ['n','r','a'].forEach(k=>{
        const box = root.querySelector(`#miss-${k}-${slug}`);
        if (box) box.hidden = (k !== btnMiss.dataset.miss);
      });
      return;
    }

    // Actions (Copier / Exporter) -> utilise l’onglet manquantes actif de la série
    const btnAction = e.target.closest('.card.actions .btn');
    if (btnAction) {
      const row = btnAction.closest('.series');
      const slug = row.dataset.slug;
      const active = row.querySelector('.card.missing [data-miss][aria-pressed="true"]') || row.querySelector('.card.missing [data-miss]');
      const k = active?.dataset.miss || 'a';
      const listBox = row.querySelector(`#miss-${k}-${slug}`);
      const list = listBox ? Array.from(listBox.querySelectorAll('.pill')).map(el=>el.textContent.trim()) : [];

      if (/copier/i.test(btnAction.textContent)) {
        const text = list.join('\n');
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // fallback soft
          const ta=document.createElement('textarea');
          ta.value=text; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        }
        const old = btnAction.textContent;
        btnAction.textContent = 'Copié ✓';
        setTimeout(()=>btnAction.textContent = old, 1200);
        return;
      }

      if (/export/i.test(btnAction.textContent)) {
        const rows = list.map(line => {
          const m = line.match(/^([^•]+)•\s*(.*)$/);
          return { numero:(m?m[1]:line).trim(), nom:(m?m[2]:line).trim(), type:k };
        });
        const header = 'Numero;Nom;Type\n';
        const csv = header + rows.map(r =>
          `${r.numero.replace(/;/g, ',')};${r.nom.replace(/;/g, ',')};${r.type}`
        ).join('\n');

        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `manquantes_${k}.csv`;
        document.body.appendChild(a); a.click();
        URL.revokeObjectURL(a.href); a.remove();
        return;
      }
    }
  });

  // C) Chargement prix au premier dépliage
  root.querySelectorAll('.series').forEach(row=>{
    const slug = row.dataset.slug;
    let loaded = false;

    row.querySelector('.s-head').addEventListener('click', async ()=>{
      if (loaded) return;
      loaded = true;
      try{
        const res = await loadPrices(slug);
        if (!res || !res.available) return;

        const SU = res.setUnique, OU = res.ownedUnique, OD = res.setDoubles;
        setTileValues(slug, 'set',  SU);
        setTileValues(slug, 'ownU', OU);
        setTileValues(slug, 'ownD', OD);

        // Donut par défaut : set unique
        updateDonut(slug, SU);
        row.querySelectorAll('.tile[data-view]').forEach(t=>{
          t.addEventListener('click', ()=>{
            row.querySelectorAll('.tile[data-view]').forEach(x=>x.removeAttribute('aria-current'));
            t.setAttribute('aria-current','true');
            const key = t.dataset.view;
            const label = t.dataset.label || key;
            updateDonut(slug, key==='ownU'?OU:key==='ownD'?OD:SU);
            const lab = row.querySelector(`#dn-label-${slug}`); if(lab) lab.textContent = `Répartition — ${label}`;
          });
        });

        // Top 10
        const list = row.querySelector('#top-'+slug);
        if(list){
          const html = res.top10.map(x=>`<span class="pill pill--sm">${x.numero} • ${x.nom} — ${eur(x.price)}</span>`).join('');
          list.innerHTML = html || '<span class="muted">—</span>';
        }
      }catch(err){
        console.error('loadPrices error', err);
      }
    });
  });
}

// ---------- UTILS ----------
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
