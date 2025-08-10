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

  root.innerHTML = series.map(s => renderSeriesBlock(s)).join('');

  // === DÉLÉGATION D’ÉVÉNEMENTS (1 seul listener pour tout) ===
  root.addEventListener('click', async (e) => {
    const head = e.target.closest('.s-head');
    if (head) {
      const row = head.closest('.series');
      if (!row) return;

      // ferme les autres séries
      root.querySelectorAll('.series.open').forEach(r => { if (r !== row) r.classList.remove('open'); });
      row.classList.toggle('open');

      // charge les prix au premier open
      if (row.classList.contains('open')) {
        await ensurePricesLoaded({ root, row, loadPrices });
      }
      return;
    }

    // Manquantes : filtres (N/R/A)
    const missBtn = e.target.closest('[data-miss]');
    if (missBtn) {
      const row = missBtn.closest('.series');
      const slug = row?.dataset.slug;
      const scope = missBtn.dataset.miss; // 'n' | 'r' | 'a'
      if (!slug || !scope) return;

      // état actif visuel
      missBtn.parentElement.querySelectorAll('[data-miss]').forEach(b => b.removeAttribute('aria-pressed'));
      missBtn.setAttribute('aria-pressed', 'true');

      // masque/affiche les listes
      ['n', 'r', 'a'].forEach(k => {
        const box = root.querySelector(`#miss-${k}-${slug}`);
        if (box) box.hidden = (k !== scope);
      });

      // mémorise l’onglet courant (utile pour copier/exporter)
      row.dataset.missScope = scope;
      return;
    }

    // Actions
    const actBtn = e.target.closest('[data-action]');
    if (actBtn) {
      const row = actBtn.closest('.series');
      if (!row) return;
      const slug = row.dataset.slug;
      const scope = row.dataset.missScope || 'a'; // défaut: onglet Alternatives

      if (actBtn.dataset.action === 'copy') {
        const items = readMissingForScope(root, slug, scope);
        const text = items.map(x => `${x.numero} • ${x.nom}`).join('\n') || '';
        await copyToClipboard(text);
        actBtn.disabled = true;
        setTimeout(() => (actBtn.disabled = false), 800);
        return;
      }
      if (actBtn.dataset.action === 'csv') {
        const items = readMissingForScope(root, slug, scope);
        const csv = buildCsv(items);
        downloadBlob(csv, `manquantes_${slug}_${scope}.csv`, 'text/csv;charset=utf-8;');
        actBtn.disabled = true;
        setTimeout(() => (actBtn.disabled = false), 800);
        return;
      }
    }

    // Tuile valeur -> met à jour le donut
    const tile = e.target.closest('.tile[data-view]');
    if (tile) {
      const row = tile.closest('.series');
      if (!row) return;
      row.querySelectorAll('.tile[data-view]').forEach(x => x.removeAttribute('aria-current'));
      tile.setAttribute('aria-current', 'true');
      const key = tile.dataset.view;
      updateDonutFor(row, key);
      return;
    }
  });
}

/* ===================== RENDER ===================== */

function renderSeriesBlock(s) {
  return `
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

/* ===================== HELPERS ===================== */

function renderChips(arr) {
  if (!arr || !arr.length) return '<span class="muted">—</span>';
  return arr.map(m => `<span class="pill pill--sm">${m.numero ? `${m.numero} • ${m.nom}` : `${m}`}</span>`).join('');
}

function setTileValues(root, slug, key, vals) {
  const id = (s) => root.querySelector(`#${s}-${slug}`);
  const fmt = (n) => eur(n || 0);
  id(`v-${key}`).textContent   = fmt(vals.total);
  id(`v-${key}-n`).textContent = fmt(vals.normal);
  id(`v-${key}-r`).textContent = fmt(vals.reverse);
  id(`v-${key}-a`).textContent = fmt(vals.alt);
}

function updateDonut(root, slug, values) {
  const svg = root.querySelector(`#dn-${slug}`);
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

  const setTxt = (k, v) => {
    const el = root.querySelector(`#dl-${k}-${slug}`);
    if (el) el.textContent = `${v.toFixed(0)}%`;
  };
  setTxt('n', n); setTxt('r', r); setTxt('a', a);
}

function updateDonutFor(row, key) {
  const slug = row.dataset.slug;
  const SU = row._priceStats?.setUnique;
  const OU = row._priceStats?.ownedUnique;
  const OD = row._priceStats?.setDoubles;
  const label = row.querySelector(`#dn-label-${slug}`);
  if (!SU) return;
  const values = key === 'ownU' ? OU : key === 'ownD' ? OD : SU;
  const txt = key === 'ownU' ? 'Possédé (unique)' : key === 'ownD' ? 'Possédé (doublons)' : 'Set unique';
  updateDonut(row, slug, values);
  if (label) label.textContent = `Répartition — ${txt}`;
}

async function ensurePricesLoaded({ root, row, loadPrices }) {
  const slug = row.dataset.slug;
  if (row.dataset.priceLoaded === '1') return;

  row.dataset.priceLoaded = '1';
  try {
    const res = await loadPrices(slug);
    if (!res || !res.available) {
      // pas de mapping de prix : on laisse le contenu à « — »
      const topBox = row.querySelector('#top-' + slug);
      if (topBox) topBox.innerHTML = '<span class="muted">Aucun prix disponible pour cette série.</span>';
      return;
    }

    // stocke les valeurs sur le noeud (évite de re-requêter)
    row._priceStats = res;

    // valeurs
    const SU = res.setUnique, OU = res.ownedUnique, OD = res.setDoubles;
    setTileValues(row, slug, 'set',  SU);
    setTileValues(row, slug, 'ownU', OU);
    setTileValues(row, slug, 'ownD', OD);

    // donut par défaut = set unique
    updateDonut(row, slug, SU);

    // top 10
    const list = row.querySelector('#top-' + slug);
    if (list) {
      const html = (res.top10 || []).map(x =>
        `<span class="pill pill--sm">${x.numero} • ${x.nom} — ${eur(x.price)}</span>`
      ).join('');
      list.innerHTML = html || '<span class="muted">—</span>';
    }
  } catch (err) {
    console.error('loadPrices error', err);
    row.dataset.priceLoaded = '0'; // autorise un 2e essai
  }
}

function readMissingForScope(root, slug, scope /* 'n'|'r'|'a' */) {
  const box = root.querySelector(`#miss-${scope}-${slug}`);
  if (!box) return [];
  // chaque badge est "NN/NNN • Nom"
  const items = Array.from(box.querySelectorAll('.pill')).map(el => {
    const txt = el.textContent.trim();
    const [numero, nom] = txt.split('•').map(s => s.trim());
    return { numero: numero || '', nom: nom || '' };
  });
  return items;
}

function buildCsv(items) {
  const rows = [['Numéro', 'Nom'], ...items.map(i => [i.numero, i.nom])];
  return rows.map(row => row.map(escapeCsv).join(',')).join('\n');
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
}
