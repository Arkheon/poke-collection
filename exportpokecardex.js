// ==UserScript==
// @name         Export Pokécardex (liste figée, sans boucle) + images + alt/gradées (fix)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Exporte toutes les séries possédées via une liste figée pour éviter les boucles et ajoute data-alternative / data-gradees. Déduplication robuste des noms (espaces insécables).
// @match        https://www.pokecardex.com/collection*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const delay = ms => new Promise(r => setTimeout(r, ms));
  let isRunning = false;

  // Petit utilitaire pour éviter les surprises avec CSS.escape
  const cssEscape = str => (window.CSS && CSS.escape) ? CSS.escape(str) : String(str).replace(/([ !"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1');

  // Canonicalise un libellé de série (remplace NBSP, normalise Unicode, retire espaces en trop)
  const canon = (s) =>
    (s || '')
      .replace(/\u00A0/g, ' ')   // NBSP → espace normale
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();            // insensible à la casse pour la déduplication

  // Accès attribut brut (plus sûr que dataset si jamais)
  const getAttr = (el, name) => {
    const v = el ? el.getAttribute(name) : null;
    return (v == null) ? '' : String(v);
  };

  function extractDataForCurrentSeries(serieName) {
    const results = [];
    const cards = document.querySelectorAll('.col-12.corner-radial.text-center.card-container.card-visible');
    cards.forEach(card => {
      const nameEl = card.querySelector('.flex-grow-1.text-start.ms-3');
      const numberEl = card.querySelector('.me-2.me-md-5.justify-content-center.d-flex.align-items-center.num-card-line b, .me-2.me-md-5.justify-content-center.d-flex.align-items-center.num-card-line');
      const thumbDiv = card.querySelector('.thumbnail-picture');

      let imageUrl = '';
      if (thumbDiv && thumbDiv.style && thumbDiv.style.backgroundImage) {
        const m = thumbDiv.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        if (m && m[1]) imageUrl = m[1];
      }

      results.push({
        serie: serieName || '',
        number: numberEl ? numberEl.textContent.trim() : '',
        name: nameEl ? nameEl.textContent.trim() : '',
        rarity: getAttr(card, 'data-rarete'),
        nb_normal: getAttr(card, 'data-normale'),
        nb_ed1: getAttr(card, 'data-ed1'),
        nb_reverse: getAttr(card, 'data-reverse'),
        nb_special: getAttr(card, 'data-speciale'),
        alternative: getAttr(card, 'data-alternative'),   // <-- maintenant via getAttribute
        gradees: getAttr(card, 'data-gradees'),           // <-- idem
        img_url: imageUrl
      });
    });
    return results;
  }

  function generateCsv(rows) {
    const header = [
      'Série','Numéro','Nom','Rareté','Nb Normal','Nb Ed1','Nb Reverse','Nb Spéciale',
      'Alternative','Gradées','Image URL'
    ];
    const lines = rows.map(r => ([
      r.serie, r.number, r.name, r.rarity, r.nb_normal, r.nb_ed1, r.nb_reverse, r.nb_special,
      r.alternative, r.gradees, r.img_url
    ].join('\t')));
    return [header.join('\t'), ...lines].join('\r\n');
  }

  function openSeriesMenuIfNeeded() {
    const toggle = document.querySelector('#select-series, .menu-serie-title');
    const anyOptionVisible = document.querySelector('.menu-serie-container div.option, .menu-serie-container div.option.selected');
    if (!anyOptionVisible && toggle) toggle.click();
  }

  async function collectOwnedSeriesNames() {
    const names = [];
    const seen = new Set(); // sur clé canonique

    const titles = Array.from(document.querySelectorAll('.menu-serie-title'));
    for (const title of titles) {
      title.click();
      await delay(250);

      const options = document.querySelectorAll('.menu-serie-container div.option, .menu-serie-container div.option.selected');
      options.forEach(opt => {
        const owned = parseInt(opt.dataset.collection || '0', 10);
        const rawName = opt.dataset.name || '';
        const key = canon(rawName);
        if (owned > 0 && rawName && !seen.has(key)) {
          seen.add(key);
          names.push({ raw: rawName, key });
        }
      });

      title.click();
      await delay(150);
    }
    return names;
  }

  async function selectSeriesByRawName(rawName) {
    // on parcourt les groupes pour trouver l'option exacte par data-name
    const titles = Array.from(document.querySelectorAll('.menu-serie-title'));
    for (const title of titles) {
      title.click();
      await delay(200);

      const selector = `.menu-serie-container div.option[data-name="${cssEscape(rawName)}"], .menu-serie-container div.option.selected[data-name="${cssEscape(rawName)}"]`;
      const opt = document.querySelector(selector);
      if (opt) {
        opt.click();
        await delay(100);
        // refermer le groupe courant pour garder l'UI lisible
        title.click();
        return true;
      }

      title.click();
      await delay(120);
    }
    return false;
  }

  async function exportOnceThroughList() {
    if (isRunning) return;
    isRunning = true;

    const button = document.getElementById('export-all-series');
    if (button) {
      button.disabled = true;
      button.textContent = 'Export en cours…';
    }

    try {
      openSeriesMenuIfNeeded();
      await delay(300);

      // 1) liste figée + déduplication robuste (espaces insécables, casse, espaces multiples)
      const series = await collectOwnedSeriesNames();

      const allData = [];
      const exported = new Set(); // clé canonique déjà exportée

      // 2) parcourir la liste une seule fois
      for (const { raw, key } of series) {
        if (exported.has(key)) continue;
        const ok = await selectSeriesByRawName(raw);
        if (!ok) continue;

        await delay(2500); // temps de rendu
        const data = extractDataForCurrentSeries(raw.replace(/\u00A0/g, ' '));
        allData.push(...data);
        exported.add(key);
      }

      // 3) CSV
      if (allData.length > 0) {
        const csv = generateCsv(allData);

        try {
          if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(csv, { type: 'text', mimetype: 'text/plain' });
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(csv);
          }
        } catch (e) {
          console.warn('Échec de la copie dans le presse-papiers :', e);
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'collection.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        alert('Export terminé (images + alternative/gradées) !');
      } else {
        alert('Aucune carte n’a été exportée.');
      }

      if (button) button.textContent = 'Export terminé';
    } catch (err) {
      console.error(err);
      alert('Une erreur est survenue pendant l’export. Ouvrez la console pour les détails.');
      if (button) {
        button.disabled = false;
        button.textContent = 'Exporter toutes les séries';
      }
    } finally {
      isRunning = false;
    }
  }

  function addExportButton() {
    if (document.getElementById('export-all-series')) return;
    const btn = document.createElement('button');
    btn.id = 'export-all-series';
    btn.textContent = 'Exporter toutes les séries (images + alt/gradées, dédoublonné)';
    btn.style.margin = '10px';
    btn.style.padding = '6px 12px';
    btn.style.backgroundColor = '#28a745';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', exportOnceThroughList);

    const target = document.querySelector('#select-series, .row');
    if (target && target.parentNode) {
      target.parentNode.insertBefore(btn, target);
    } else {
      document.body.insertBefore(btn, document.body.firstChild);
    }
  }

  window.addEventListener('load', addExportButton);
})();
