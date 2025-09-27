export const normalize = (s) =>
  String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

export const slugify = (s) =>
  normalize(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

