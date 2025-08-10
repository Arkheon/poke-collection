// src/ui/statsView.js
import { eur } from '../domain/pricing.js';

/**
 * Monte la vue Stats dans #stats-root
 * @param {Object} deps
 * @param {HTMLElement} deps.root
 * @param {Array} deps.series             // computeStatsPerSeries()
 * @param {Function} deps.loadPrices      // (slug)=>Promise<priceStats>
 */
export function mountStatsView({ root, series, loadPrices }) {
  if (!root) return;
  if (!Array.isArray(series) || !series.length) {
    root.innerHTML = `<div class="empty">Pas de données cartes chargées.</div>`;
    return;
  }

  root.innerHTML = series.map(s => `
    <div class="series" data-slug="${s.slug}">
      <div class="s-head" role="button" aria-expanded="false">
        <div class="s-title">${s.label}</div>
        <div class="progress" aria-hidden="true">
          <span style="width:${Math.min(100, Math.max(0, s.completion)).toFixed(2)}%"></span>
        </div>
        <div class="s-meta">${s.done} / ${s.size} (${s.completion.toFixed(1)}%)</div>
      </div>

      <div class="s-body" hidden>
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
              <div class="content">
                <div class="top-list" id="top-${s.slug}"><span class="muted">—</span></div>
              </div>
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
                  <button class="btn" data-act="copy">Copier la liste manquantes</button>
                  <button class="btn" data-act="csv">Exporter CSV</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `).join('');

  // ========= Interactions =========

  // 1) Accordéon: une série ouverte à la fois + chargement prix au 1er open
  const loaded = new Set();
  root.querySelectorAll('.series .s-head').forEach(head => {
    head.addEventListener('click', async () => {
      const row = head.closest('.series');
      const slug = row.dataset.slug;

      // ferme les autres
      root.querySelectorAll('.series').forEach(s => {
        if (s !== row) {
          s.classList.remove('open');
          s.querySelector('.s-body')?.setAttribute('hidden', 'true');
          s.querySelector('.s-head')?.setAttribute('aria-expanded', 'false');
        }
      });

      // bascule l'actuelle
      const body = row.querySelector('.s-body');
      const isOpen = row.classList.toggle('open');
      head.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) body.removeAttribute('hidden'); else body.setAttribute('hidden', 'true');

      // charge les prix une seule fois
      if (isOpen && !loaded.has(slug)) {
        loaded.add(slug);
        try {
          const res = await loadPrices(slug);
          if (!res || !res.available) {
            const topListEl = row.querySelector('#top-' + slug);
            if (topListEl) topListEl.innerHTML = `<span class="muted">Prix indisponibles pour cette série.</span>`;
            return;
          }
          const SU = res.setUnique, OU = res.ownedUnique, OD = res.setDoubles;
          setTileValues(slug, 'set',  SU);
          setTileValues(slug, 'ownU', OU);
          setTileValues(slug, 'ownD', OD);

          // donut par défaut = set unique
          updateDonut(slug, SU);
          // clic sur les tuiles pour MAJ donut
          row.querySelectorAll('.tile[data-view]').forEach(t => {
            t.addEventListener('click', () => {
              row.querySelectorAll('.tile[data-view]').forEach(x => x.removeAttribute('aria-current'));
              t.setAttribute('aria-current', 'true');
              const key = t.dataset.view;
              const label = t.dataset.label || key;
              updateDonut(slug, key === 'ownU' ? OU : key === 'ownD' ? OD : SU);
              const lab = row.querySelector('#dn-label-' + slug);
              if (lab) lab.textContent = `Répartition — ${label}`;
            });
          });

          // Top 10
          const topListEl = row.querySelector('#top-' + slug);
          if (topListEl) {
            const html = (res.top10 || []).map(x =>
              `<span class="pill pill--sm">${x.numero} • ${x.nom} — ${eur(x.price)}</span>`
            ).join('');
            topListEl.innerHTML = html || `<span class="muted">—</span>`;
          }
        } catch (error) {
          console.error('loadPrices error', error);
        }
      }
    });
  });

  // 2) Onglets Manquantes (filtrage correct)
  root.querySelectorAll('.series .card.missing .toolbar').forEach(tb => {
    tb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-miss]');
      if (!btn) return;
      const row = tb.closest('.series');
      const slug = row.dataset.slug;
      // état visuel
      tb.querySelectorAll('[data-miss]').forEach(x => x.removeAttribute('aria-pressed'));
      btn.setAttribute('aria-pressed', 'true');
      // affichage
      ['n','r','a'].forEach(k => {
        const box = row.querySelector(`#miss-${k}-${slug}`);
        if (box) box.hidden = (k !== btn.dataset.miss);
      });
    });
  });

  // 3) Actions: Copy & CSV pour l’onglet actif
  root.querySelectorAll('.series .card.actions .toolbar').forEach(tb => {
    tb.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const row  = tb.closest('.series');
      const slug = row.dataset.slug;
      const active = row.querySelector('.card.missing [data-miss][aria-pressed="true"]')?.dataset.miss || 'n';
      const box = row.querySelector(`#miss-${active}-${slug}`);
      const items = box ? [...box.querySelectorAll('.pill')].map(x => x.textContent.trim()) : [];

      if (btn.dataset.act === 'copy') {
        try {
          const text = items.join('\n');
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copié ✔';
          setTimeout(() => (btn.textContent = 'Copier la liste manquantes'), 1200);
        } catch (err) {
          console.error('clipboard error', err);
          alert('Impossible de copier (permissions navigateur).');
        }
      }

      if (btn.dataset.act === 'csv') {
        // Construit Numero;Nom;Type (type ∈ {n,r,a})
        const rows = [['Numero','Nom','Type']];
        items.forEach(str => {
          // "199/165 • Dracaufeu ex" -> ["199/165","Dracaufeu ex"]
          const parts = String(str).split('•').map(s => s.trim());
          rows.push([parts[0] || '', parts[1] || '', active]);
        });
        const csv = rows.map(r => r.map(cell => safeCsv(cell)).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `manquantes_${slug}_${active}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 0);
      }
    });
  });
}

// ===== Utils =====
function renderChips(arr){
  if(!arr || !arr.length) return '<span class="muted">—</span>';
  return arr.map(m=>`<span class="pill pill--sm">${m.numero} • ${m.nom}</span>`).join('');
}

function setTileValues(slug, key, vals){
  const id = s => document.getElementById(`${s}-${slug}`);
  const fmt = n => eur(n || 0);
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
  svg.querySelector('.seg-n').setAttribute('stroke-dasharray', `${n} ${100-n}`);
  svg.querySelector('.seg-r').setAttribute('stroke-dasharray', `${r} ${100-r}`);
  svg.querySelector('.seg-a').setAttribute('stroke-dasharray', `${a} ${100-a}`);
  svg.querySelector('.seg-r').setAttribute('stroke-dashoffset', 25 - n);
  svg.querySelector('.seg-a').setAttribute('stroke-dashoffset', 25 - n - r);
  // mini-legend
  const setTxt = (k,v)=>{ const el = document.getElementById(`dl-${k}-${slug}`); if(el) el.textContent = `${v.toFixed(0)}%`; };
  setTxt('n',n); setTxt('r',r); setTxt('a',a);
}

function safeCsv(v){
  const s = String(v ?? '');
  // protège ; " \n
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
