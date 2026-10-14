/** Recouvrement de deux zones (intersection sur union), positions en fractions de page. */
export function iou(a, b) {
  const l = Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = l * h;

  return inter / (a.l * a.h + b.l * b.h - inter || 1);
}

/** Recouvrement minimal pour qu'un champ repéré corresponde à un champ de référence. */
export const SEUIL = 0.3;

/**
 * Appariement de deux listes de zones : chaque zone de « a » va à la zone de « b » qui la recouvre
 * le plus (au moins SEUIL), chacune servant une seule fois.
 *
 * @return {{i: number, j: number, r: number}[]} i dans a, j dans b, r le recouvrement
 */
export function apparier(a, b) {
  const paires = [];
  for (const [i, za] of a.entries()) {
    for (const [j, zb] of b.entries()) {
      const r = iou(za, zb);
      if (r >= SEUIL) paires.push({ i, j, r });
    }
  }
  paires.sort((p, q) => q.r - p.r);

  const prisA = new Set();
  const prisB = new Set();
  return paires.filter((p) => {
    if (prisA.has(p.i) || prisB.has(p.j)) return false;
    prisA.add(p.i);
    prisB.add(p.j);
    return true;
  });
}

/** Compare les champs repérés à la référence. */
export function noter(reperes, reference) {
  const retenues = apparier(reference, reperes);

  return {
    reference: reference.length,
    reperes: reperes.length,
    trouves: retenues.length,
    iouMoyen: retenues.length ? retenues.reduce((s, p) => s + p.r, 0) / retenues.length : 0,
  };
}
