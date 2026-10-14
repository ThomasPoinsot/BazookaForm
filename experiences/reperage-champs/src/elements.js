/** Position en pixels → fraction de page, bornée à la page. */
export function enFractions(element, page) {
  const borne = (v) => Math.min(1, Math.max(0, v));
  const x = borne(element.x / page.largeur);
  const y = borne(element.y / page.hauteur);

  return { ...element, page: page.numero, x, y, l: borne(element.l / page.largeur + x) - x, h: borne(element.h / page.hauteur + y) - y };
}

/** Champs d'une liste d'éléments (le texte devient le libellé). */
export function champs(elements) {
  return elements.filter((e) => e.nature === "champ").map((e) => ({ ...e, libelle: e.texte }));
}

/** Informations d'une liste d'éléments. */
export function informations(elements) {
  return elements.filter((e) => e.nature === "information");
}
