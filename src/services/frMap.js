import { slugify } from '../domain/strings.js';

// Base path robuste (GitHub Pages sous sous-répertoire)
const BASE_PATH =
  document.querySelector('base')?.getAttribute('href')
  || (location.pathname.startsWith('/poke-collection/') ? '/poke-collection/' : '/');

let FR_SET_MAP = {};
let ready = false;

export async function loadFrMap() {
  if (ready) return FR_SET_MAP;
  try {
    const r = await fetch(`${BASE_PATH}data/fr_map.json`, { cache: 'no-store' });
    const m = await r.json();
    const norm = {};
    Object.entries(m).forEach(([k, v]) => { norm[slugify(k)] = v; });
    FR_SET_MAP = norm;
    ready = true;
    return FR_SET_MAP;
  } catch (e) {
    console.warn('fr_map.json introuvable', e);
    ready = true;
    FR_SET_MAP = {};
    return FR_SET_MAP;
  }
}

export function getSetIdFromSlug(slug) {
  return FR_SET_MAP[slug] || null;
}
