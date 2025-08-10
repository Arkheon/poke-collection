export const eur = (n) =>
  (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function choosePrice(entry, row) {
  if (!entry) return null;
  const reverseExists = Number(row['Nb Reverse']) !== -1;
  const reverseOwned  = Number(row['Nb Reverse']) > 0;
  if ((reverseOwned || reverseExists) && entry.reverseTrend) return entry.reverseTrend;
  return entry.trend ?? entry.avg30 ?? entry.avg7 ?? entry.low ?? null;
}

