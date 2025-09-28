export const normalize = (s) =>
  String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

export const slugify = (s) =>
  normalize(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Minimal HTML escaping for safe text injection
export const escapeHtml = (s) => {
  const str = String(s ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
