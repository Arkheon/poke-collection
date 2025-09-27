export function parseNumDen(numStr) {
  const s = String(numStr || '').trim();
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/i);
  return m ? { num: parseInt(m[1], 10), den: parseInt(m[2], 10) } : null;
}

export function parseSubset(numStr) {
  const s = String(numStr || '').trim();
  const m = s.match(/^([A-Za-z]+)\s*0*?(\d{1,3})$/i);
  return m ? { prefix: m[1].toUpperCase(), n: parseInt(m[2], 10) } : null;
}

export function baseNumber(rowOrStr) {
  const s = typeof rowOrStr === 'string'
    ? rowOrStr
    : String(rowOrStr['Numéro'] || '').trim();

  let m = s.match(/^(\d+)\s*\/\s*\d+$/);     // ex: 186/198
  if (m) return m[1];

  m = s.match(/^[A-Za-z]+0*?(\d{1,3})$/);    // ex: GG05
  if (m) return String(parseInt(m[1], 10));

  const d = s.replace(/\D/g, '');
  return d || s;
}

