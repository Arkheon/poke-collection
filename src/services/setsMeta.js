// src/services/setsMeta.js
// Loads static set metadata (public/sets_meta.json) if available and
// exposes helpers to derive the era/series for a given setId.

import { getSetIdFromSlug } from './frMap.js';

const BASE_PATH =
  document.querySelector('base')?.getAttribute('href')
  || (location.pathname.startsWith('/poke-collection/') ? '/poke-collection/' : '/');

let META = null;           // { byId: { [id]: { series, seriesKey, symbol } } }
let META_TRIED = false;    // avoid repeated 404s

const SERIES_FR = {
  'scarlet-violet': 'Écarlate & Violet',
  'sword-shield': 'Épée & Bouclier',
  'sun-moon': 'Soleil & Lune',
  'xy': 'XY',
  'black-white': 'Noir & Blanc',
  'diamond-pearl': 'Diamant & Perle',
  'platinum': 'Platine',
  'heartgold-soulsilver': 'HeartGold & SoulSilver',
  'ex': 'EX',
  'neo': 'Néo',
  'e-card': 'e‑Card',
  'pop': 'POP',
  'base': 'Base',
  'gym': 'Gym',
  'legendary': 'Legendary',
};

function normSeriesKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*&\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fallbackFromSetId(id) {
  if (!id) return null;
  const s = String(id);
  // Known promos
  if (['svpromos','swshp','xyp'].includes(s)) return { key: 'promos', label: 'Promos' };
  // Specials (some popular ones; they still belong to an era but are often standalone)
  if (['cel25','g1','dc1','pgo','tot23'].includes(s)) return { key: 'special', label: 'Hors-série' };
  const prefix = (s.match(/^(sv|swsh|sm|xy|bw|dp|pl|hgss|ex|neo|ecard)/) || [null])[0];
  if (!prefix) return { key: 'special', label: 'Hors-série' };
  const key = (
    prefix === 'sv'    ? 'scarlet-violet' :
    prefix === 'swsh'  ? 'sword-shield'   :
    prefix === 'sm'    ? 'sun-moon'       :
    prefix === 'xy'    ? 'xy'             :
    prefix === 'bw'    ? 'black-white'    :
    prefix === 'dp'    ? 'diamond-pearl'  :
    prefix === 'pl'    ? 'platinum'       :
    prefix === 'hgss'  ? 'heartgold-soulsilver' :
    prefix === 'ex'    ? 'ex'             :
    prefix === 'neo'   ? 'neo'            :
    prefix === 'ecard' ? 'e-card'         :
    'special'
  );
  return { key, label: SERIES_FR[key] || key };
}

export async function loadSetsMeta() {
  if (META || META_TRIED) return META;
  try {
    const r = await fetch(`${BASE_PATH}public/sets_meta.json`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (j && j.byId && typeof j.byId === 'object') {
        META = j;
        META_TRIED = true;
        return META;
      }
    }
  } catch {}
  META_TRIED = true; // tried once
  return null;
}

export function eraFromSetId(setId) {
  if (!setId) return null;
  const id = String(setId);
  const m = META?.byId?.[id];
  if (m && m.series) {
    const key = m.seriesKey || normSeriesKey(m.series);
    const label = SERIES_FR[key] || m.series;
    return { key, label, symbol: m.symbol || '' };
  }
  return fallbackFromSetId(id);
}

export function eraFromSlug(slug) {
  const id = getSetIdFromSlug(slug);
  return eraFromSetId(id);
}

