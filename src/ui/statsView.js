// src/ui/statsView.js
import { eur } from '../domain/pricing.js';

/**
 * Monte la vue Stats dans #stats-root
 * @param {Object} deps
 * @param {HTMLElement} deps.root
 * @param {Array} deps.series - retour de computeStatsPerSeries()
 * @param {Function} deps.loadPrices - (slug)=>Promise<priceStats>
 */
export function mountStatsView({ root, series, loadPrices }) {
  if (!root) return;
  if (!Array.isArray(series) || !series.length) {
    root.innerHTML = `<div class="empty">Pas de données cartes chargées.</div>`;
    return;
  }

  // 1) Render
  root.innerHTML = series.map(renderSeriesBlock).join('');

  // 2) Wire events par série (plus robuste que la délégation unique)
  root.querySelectorAll('.series').forEach(row => wireRow(row, loadPrices));
}

/* =============== RENDER =============== */

function renderSeriesBlock(s) {
  return `
    <div class="series" data-slug="${s.slug}" data-miss-scope="a">
      <div class="s-head" role="button" aria-expanded="false">
        <div class="s-title">${s.label}</div>
        <div class="progress" aria-hidden="true">
          <span style="width:${Math.max(0, Math.min(100, s.completion)).toFixed(2)}%"></span>
        </div>
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
                <div class="toolbar" style="margin-bottom:6px">
                  <button class="btn" data-miss="n">Normales (${s.missN.length})</button>
                  <button class="btn" data-miss="r">Reverse (${s.missR.length})</button>
                  <button class="btn" data-miss="a" aria-pressed="true">Alternatives (${s.missAlt.length})</button>
                </div>
                <div class="chips" data-scope="a">${renderChips(s.missAlt)}</div>
                <div class="chips" data-scope="n" hidden>${renderChips(s.missN)}</div>
                <div class="chips" data-scope="r" hidden>${renderChips(s.missR)}</div>
              </div>
            </div>

            <div class="card top">
              <h3>Top cartes (prix normal)</h3>
              <div class="content"><div class="top-list" data-top><span class="muted">—</span></div></div>
            </div>
          </div>

          <div class="col">
            <div class="card value">
              <h3>Valeur</h3>
              <div class="content">
                <div class="tiles">
                  <div class="tile" data-view="set" data-label="Set unique" aria-current="true">
                    <div class="muted">Valeur set complet</div>
                    <b class="num" data-val="set-total">—</b>
                    <div class="seg"><span class="ball n"></span><span class="muted num" data-val="set-n">—</span></div>
                    <div class="seg"><span class="ball r"></span><span class="muted num" data-val="set-r">—</span></div>
                    <div class="seg"><span class="ball a"></span><span class="muted num" data-val="set-a">—</span></div>
                  </div>
                  <div class="tile" data-view="ownU" data-label="Possédé (unique)">
                    <div class="muted">Possédé (unique)</div>
                    <b class="num" data-val="ownU-total">—</b>
                    <div class="seg"><span class="ball n"></span><span class="muted num" data-val="ownU-n">—</span></div>
                    <div class="seg"><span class="ball r"></span><span class="muted num" data-val="ownU-r">—</span></div>
                    <div class="seg"><span class="ball a"></span><span class="muted num" data-val="ownU-a">—</span></div>
                  </div>
                  <div class="tile" data-view="ownD" data-label="Possédé (doublons)">
                    <div class="muted">Possédé (doublons)</div>
                    <b class="num" data-val="ownD-total">—</b>
                    <div class="seg"><span class="ball n"></span><span class="muted num" data-val="ownD-n">—</span></div>
                    <div class="seg"><span class="ball r"></span><span class="muted num" data-val="ownD-r">—</span></div>
                    <div class="seg"><span class="ball a"></span><span class="muted num" data-val="ownD-a">—</span></div>
                  </div>
                </div>

                <div class="donut">
                  <svg viewBox="0 0 42 42" class="donut" data-donut aria-label="Répartition">
                    <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e5e7eb" stroke-width="6"></circle>
                    <circle class="seg-n" cx="21" cy="21" r="15.915" fill="none" stroke="#ef4444" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                    <circle class="seg-r" cx="21" cy="21" r="15.915" fill="none" stroke="#eab308" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                    <circle class="seg-a" cx="21" cy="21" r="15.915" fill="none" stroke="#3b82f6" stroke-width="6" stroke-dasharray="0 100" stroke-dashoffset="25"></circle>
                  </svg>
                  <div class="mini-legend">
                    <span><span class="ball n"></span> <span data-dl="n">—%</span></span>
                    <span><span class="ball r"></span> <span data-dl="r">—%</span></span>
                    <span><span class="ball a"></span> <span data-dl="a">—%</span></span>
                  </div>
                  <div class="muted" data-donut-label>Répartition — Set unique</div>
                </div>
              </div>
            </div>

            <div class="card actions">
              <h3>Actions</h3>
              <div class="content">
                <div class="toolbar">
                  <button class="btn" data-action="copy">Copier la liste manquantes</button>
                  <button class="btn" data-action="csv">Exporter CSV</button>
                  <div class="hint">Astuce : le scope (N/R/Alt) suit l’onglet « Manquantes » sélectionné.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;
}

/* =============== WIRING =============== */

function wireRow(row, loadPrices) {
  // Ouvrir / fermer + chargement prix au premier open
  const head = row.querySelector('.s-head');
  if (head) {
    head.addEventListener('click', async () => {
      // fermer les autres
      row.parentElement.querySelectorAll('.series.open').forEach(r => { if (r !== row) r.classList.remove('open'); });
      // toggle courant
      const opened = row.classList.toggle('open');
      head.setAttribute('aria-expanded', opened ? 'true' : 'false');
      if (opened) await ensurePricesLoaded({ row, loadPrices });
    });
  }

  // Filtres manquantes
  row.querySelectorAll('[data-miss]').forEach(btn => {
    btn.addEventListener('click', () => {
      const scope = btn.dataset.miss; // 'n'|'r'|'a'
      row.querySelectorAll('[data-miss]').forEach(x => x.removeAttribute('aria-pressed'));
      btn.setAttribute('aria-pressed', 'true');
      ['n', 'r', 'a'].forEach(k => {
        const box = row.querySelector(`.chips[data-scope="${k}"]`);
        if (box) box.hidden = (k !== scope);
      });
      row.dataset.missScope = scope;
    });
  });

  // Actions (copier / csv)
  row.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scope = row.dataset.missScope || 'a';
      const items = readMissingForScope(row, scope);
      if (btn.dataset.action === 'copy') {
        await copyToClipboard(items.map(x => `${x.numero} • ${x.nom}`).join('\n'));
      } else if (btn.dataset.action === 'csv') {
        const csv = buildCsv(items);
        downloadBlob(csv, `manquantes_${row.dataset.slug}_${scope}.csv`, 'text/csv;charset=utf-8;');
      }
    });
  });

  // Tuiles valeurs -> maj donut
  row.querySelectorAll('.tile[data-view]').forEach(tile => {
    tile.addEventListener('click', () => {
      row.querySelectorAll('.tile[data-view]').forEach(x => x.removeAttribute('aria-current'));
      tile.setAttribute('aria-current', 'true');
      updateDonutFor(row, tile.dataset.view);
    });
  });
}

/* =============== DATA/APPLY =============== */

function renderChips(arr) {
  if (!arr || !arr.length) return '<span class="muted">—</span>';
  return arr.map(m => `<span class="pill pill--sm">${m.numero ? `${m.numero} • ${m.nom}` : `${m}`}</span>`).join('');
}

function setTileValues(row, key, vals) {
  const q = sel => row.querySelector(`[data-val="${sel}"]`);
  const F = n => eur(n || 0);
  q(`${key}-total`).textContent = F(vals.total);
  q(`${key}-n`).textContent     = F(vals.normal);
  q(`${key}-r`).textContent     = F(vals.reverse);
  q(`${key}-a`).textContent     = F(vals.alt);
}

function updateDonut(row, values) {
  const svg = row.querySelector('[data-donut]');
  if (!svg) return;
  const total = Math.max(1, (values.normal || 0) + (values.reverse || 0) + (values.alt || 0));
  const n = (values.normal || 0) / total * 100;
  const r = (values.reverse || 0) / total * 100;
  const a = (values.alt || 0) / total * 100;
  const segN = svg.querySelector('.seg-n');
  const segR = svg.querySelector('.seg-r');
  const segA = svg.querySelector('.seg-a');
  segN.setAttribute('stroke-dasharray', `${n} ${100 - n}`);
  segR.setAttribute('stroke-dasharray', `${r} ${100 - r}`);
  segA.setAttribute('stroke-dasharray', `${a} ${100 - a}`);
  segR.setAttribute('stroke-dashoffset', 25 - n);
  segA.setAttribute('stroke-dashoffset', 25 - n - r);
  // mini-légende
  const setTxt = (k, v) => { const el = row.querySelector(`[data-dl="${k}"]`); if (el) el.textContent = `${v.toFixed(0)}%`; };
  setTxt('n', n); setTxt('r', r); setTxt('a', a);
}

function updateDonutFor(row, key) {
  const stats = row._priceStats;
  if (!stats) return;
  const values = key === 'ownU' ? stats.ownedUnique
               : key === 'ownD' ? stats.setDoubles
               : stats.setUnique;
  updateDonut(row, values);
  const label = row.querySelector('[data-donut-label]');
  if (label) label.textContent =
    `Répartition — ${key === 'ownU' ? 'Possédé (unique)' : key === 'ownD' ? 'Possédé (doublons)' : 'Set unique'}`;
}

async function ensurePricesLoaded({ row, loadPrices }) {
  if (row.dataset.priceLoaded === '1') return;
  row.dataset.priceLoaded = '1';
  const slug = row.dataset.slug;

  try {
    const raw = await loadPrices(slug);
    const res = normalizePriceStats(raw);
    if (!res || !res.available) {
      const top = row.querySelector('[data-top]');
      if (top) top.innerHTML = '<span class="muted">Aucun prix disponible pour cette série.</span>';
      return;
    }
    // mémo
    row._priceStats = res;

    // valeurs
    setTileValues(row, 'set',  res.setUnique);
    setTileValues(row, 'ownU', res.ownedUnique);
    setTileValues(row, 'ownD', res.setDoubles);

    // donut par défaut
    updateDonut(row, res.setUnique);

    // top 10
    const topList = row.querySelector('[data-top]');
    if (topList) {
      const items = (res.top10 || []).map(x => {
        const numero = x.numero ?? '';
        const nom    = x.nom ?? '';
        const price  = typeof x.price === 'number' ? eur(x.price) : (x.price || '');
        return `<span class="pill pill--sm">${numero} • ${nom} — ${price}</span>`;
      }).join('');
      topList.innerHTML = items || '<span class="muted">—</span>';
    }
  } catch (err) {
    console.error('loadPrices error', err);
    row.dataset.priceLoaded = '0'; // autorise un retry
  }
}

/**
 * Compat : ancienne forme ({valueSet, valueOwnedUnique, valueOwnedDupes})
 * -> nouvelle ({setUnique, ownedUnique, setDoubles})
 */
function normalizePriceStats(res) {
  if (!res) return null;
  if (res.setUnique && res.ownedUnique && res.setDoubles) return res;
  if ('valueSet' in res || 'valueOwnedUnique' in res || 'valueOwnedDupes' in res) {
    return {
      available: true,
      setId: res.setId,
      setUnique:   { total: +res.valueSet || 0, normal: 0, reverse: 0, alt: 0 },
      ownedUnique: { total: +res.valueOwnedUnique || 0, normal: 0, reverse: 0, alt: 0 },
      setDoubles:  { total: +res.valueOwnedDupes || 0, normal: 0, reverse: 0, alt: 0 },
      top10: res.top10 || []
    };
  }
  return res;
}

/* =============== ACTIONS & UTILS =============== */

function readMissingForScope(row, scope) {
  const box = row.querySelector(`.chips[data-scope="${scope}"]`);
  if (!box) return [];
  return Array.from(box.querySelectorAll('.pill')).map(el => {
    const txt = el.textContent.trim();
    const [numero, nom] = txt.split('•').map(s => s.trim());
    return { numero: numero || '', nom: nom || '' };
  });
}

function buildCsv(items) {
  const rows = [['Numéro', 'Nom'], ...items.map(i => [i.numero, i.nom])];
  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
}

function escapeCsv(s) {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadBlob(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
}
