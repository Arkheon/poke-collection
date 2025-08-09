// ==UserScript==
// @name         Export Pokécardex jusqu’à la seconde occurrence d'une série sentinelle (avec images)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Parcourt les séries et s’arrête dès qu’il retombe sur "Aventures Ensemble", générant le CSV avec lien image.
// @author       Votre nom
// @match        https://www.pokecardex.com/collection*
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let isRunning = false;
    const SENTINEL_NAME = 'Aventures Ensemble';
    let premierPassage = true;

function extractDataForCurrentSeries(serieName) {
    const results = [];
    const cards = document.querySelectorAll('.col-12.corner-radial.text-center.card-container.card-visible');
    cards.forEach(card => {
        const nameEl = card.querySelector('.flex-grow-1.text-start.ms-3');
        const numberEl = card.querySelector('.me-2.me-md-5.justify-content-center.d-flex.align-items-center.num-card-line');
        const thumbDiv = card.querySelector('.thumbnail-picture');

        let imageUrl = '';
        if (thumbDiv && thumbDiv.style.backgroundImage) {
            const match = thumbDiv.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
            if (match && match[1]) {
                imageUrl = match[1];
            }
        }

        results.push({
            serie: serieName || '',
            number: numberEl ? numberEl.textContent.trim() : '',
            name: nameEl ? nameEl.textContent.trim() : '',
            rarity: card.dataset.rarete || '',
            nb_normal: card.dataset.normale || '',
            nb_ed1: card.dataset.ed1 || '',
            nb_reverse: card.dataset.reverse || '',
            nb_special: card.dataset.speciale || '',
            img_url: imageUrl
        });
    });
    return results;
}


    function generateCsv(rows) {
        const header = ['Série','Numéro','Nom','Rareté','Nb Normal','Nb Ed1','Nb Reverse','Nb Spéciale','Image URL'];
        const lines = rows.map(r =>
            [
                r.serie,
                r.number,
                r.name,
                r.rarity,
                r.nb_normal,
                r.nb_ed1,
                r.nb_reverse,
                r.nb_special,
                r.img_url
            ].join('\t')
        );
        return [header.join('\t'), ...lines].join('\r\n');
    }

    async function exportWithSentinel() {
        if (isRunning) return;
        isRunning = true;

        const button = document.getElementById('export-all-series');
        if (button) {
            button.disabled = true;
            button.textContent = 'Export en cours…';
        }

        const allData = [];

        const toggleMenu = () => {
            const toggle = document.querySelector('#select-series, .menu-serie-title');
            if (toggle) toggle.click();
        };

        toggleMenu();
        await delay(500);

        let shouldStop = false;

        async function processVisibleOptions() {
            const options = document.querySelectorAll('.menu-serie-container div.option, .menu-serie-container div.option.selected');
            for (const option of options) {
                const serieName = option.dataset.name || '';
                const owned = parseInt(option.dataset.collection || '0', 10);
                if (owned <= 0) continue;

                option.click();
                await delay(3000);

                const serieData = extractDataForCurrentSeries(serieName);
                allData.push(...serieData);

                if (serieName === SENTINEL_NAME) {
                    if (premierPassage) {
                        premierPassage = false;
                    } else {
                        shouldStop = true;
                        break;
                    }
                }

                if (!shouldStop) {
                    toggleMenu();
                    await delay(500);
                } else {
                    break;
                }
            }
        }

        const serieTitles = document.querySelectorAll('.menu-serie-title');
        for (const title of serieTitles) {
            title.click();
            await delay(300);
            await processVisibleOptions();
            if (shouldStop) break;
            title.click();
            await delay(300);
        }

        if (allData.length > 0) {
            const csv = generateCsv(allData);
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(csv, {type:'text', mimetype:'text/plain'});
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(csv);
                }
            } catch (e) {
                console.warn("Échec de la copie dans le presse‑papiers :", e);
            }

            const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'collection_partielle.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            alert("Export terminé avec images ! Le fichier CSV a été téléchargé et copié dans le presse‑papiers.");
        } else {
            alert("Aucune carte n’a été exportée.");
        }

        if (button) {
            button.textContent = 'Export terminé';
        }

        isRunning = false;
    }

    function addExportButton() {
        if (document.getElementById('export-all-series')) return;
        const btn = document.createElement('button');
        btn.id = 'export-all-series';
        btn.textContent = 'Exporter toutes les séries (avec arrêt sur Aventures Ensemble + images)';
        btn.style.margin = '10px';
        btn.style.padding = '6px 12px';
        btn.style.backgroundColor = '#28a745';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', exportWithSentinel);

        const target = document.querySelector('#select-series, .row');
        if (target && target.parentNode) {
            target.parentNode.insertBefore(btn, target);
        } else {
            document.body.insertBefore(btn, document.body.firstChild);
        }
    }

    window.addEventListener('load', addExportButton);
})();
