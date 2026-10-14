import { execFileSync } from "node:child_process";

/**
 * Recalage des champs sur les pointillés du PDF.
 *
 * L'IA dit quel champ est où, à peu près ; la couche texte d'un PDF natif dit où sont exactement les
 * pointillés (« ……… », « ….. », « …/…/…… », « ____ » sont des mots, avec leur cadre). Chaque champ
 * « texte » prend la place des pointillés qu'il recouvre sur sa ligne. Sans couche texte (scan, photo)
 * ou sans pointillés sous la zone, la zone de l'IA est gardée telle quelle.
 */

/**
 * Un mot qui finit par des pointillés (points, points de suspension, soulignés, barres de date) : un blanc
 * à remplir, éventuellement collé à un court libellé (« à………… », « SIRET:……… »). Groupes : libellé, pointillés.
 */
const POINTILLES = /^(.{0,12}?)([.…_][.…_/\s-]*[.…_])[.)]?$/u;
/** Largeur relative d'un caractère, pour situer les pointillés dans un mot qui commence par un libellé. */
const largeurCar = (c) => (c === "…" ? 1 : c === "_" ? 0.55 : /[.\s/]/.test(c) ? 0.3 : 0.55);

/**
 * Pointillés de chaque page d'un PDF, en fractions de page (x, y depuis le haut à gauche).
 *
 * @return {Map<number, {x: number, y: number, l: number, h: number, texte: string}[]>} vide pour une image ou un PDF sans texte
 */
export function pointilles(fichier) {
  const parPage = new Map();
  if (!fichier.toLowerCase().endsWith(".pdf")) return parPage;

  let html;
  try {
    html = execFileSync("pdftotext", ["-bbox", fichier, "-"], { maxBuffer: 64 * 1024 * 1024 }).toString();
  } catch {
    return parPage;
  }

  let numero = 0;
  let largeur = 1;
  let hauteur = 1;
  for (const ligne of html.split("\n")) {
    const page = ligne.match(/<page width="([\d.]+)" height="([\d.]+)"/);
    if (page) {
      numero++;
      [largeur, hauteur] = [Number(page[1]), Number(page[2])];
      parPage.set(numero, []);
      continue;
    }
    const mot = ligne.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)<\/word>/);
    const blanc = mot?.[5].match(POINTILLES);
    if (!blanc || [...blanc[2]].filter((c) => /[.…_]/.test(c)).length < 2) continue;
    const [x0, y0, x1, y1] = mot.slice(1, 5).map(Number);
    // Libellé collé devant : on le retire, en proportion de la largeur estimée des caractères.
    const total = [...mot[5]].reduce((s, c) => s + largeurCar(c), 0);
    const avant = [...blanc[1]].reduce((s, c) => s + largeurCar(c), 0);
    const debut = x0 + ((x1 - x0) * avant) / total;
    parPage.get(numero).push({ x: debut / largeur, y: y0 / hauteur, l: (x1 - debut) / largeur, h: (y1 - y0) / hauteur, texte: blanc[2] });
  }

  return parPage;
}

/**
 * Recale les champs « texte » d'une page sur ses pointillés. Chaque série de pointillés va au champ
 * qui la recouvre le plus en largeur, sur la même ligne ; un champ prend l'union de ses pointillés.
 * La zone d'origine est gardée dans `zone_ia`, et `recale` indique si la zone a changé.
 *
 * @param {object[]} elements  éléments de la page, positions en fractions
 * @param {object[]} traits  pointillés de la page (voir pointilles)
 */
export function recaler(elements, traits) {
  const champs = elements.map((e, i) => ({ e, i })).filter(({ e }) => e.nature === "champ" && e.type === "texte");
  const attribues = new Map(); // indice de l'élément → pointillés

  for (const t of traits) {
    let meilleur = null;
    let recouvrement = 0;
    for (const { e, i } of champs) {
      if (!memeLigne(e, t)) continue;
      // Marge d'un demi-cadre de pointillés : l'IA tombe souvent un peu à côté.
      const r = Math.min(e.x + e.l, t.x + t.l) - Math.max(e.x, t.x) + Math.min(t.l, 0.02);
      if (r > recouvrement) [meilleur, recouvrement] = [i, r];
    }
    if (meilleur === null) continue;
    if (!attribues.has(meilleur)) attribues.set(meilleur, []);
    attribues.get(meilleur).push(t);
  }

  return elements.map((e, i) => {
    const zone_ia = { x: e.x, y: e.y, l: e.l, h: e.h };
    const siens = attribues.get(i);
    if (!siens) return e.nature === "champ" ? { ...e, zone_ia, recale: false } : e;

    const x = Math.min(...siens.map((t) => t.x));
    const y = Math.min(...siens.map((t) => t.y));

    return {
      ...e,
      x,
      y,
      l: Math.max(...siens.map((t) => t.x + t.l)) - x,
      h: Math.max(...siens.map((t) => t.y + t.h)) - y,
      zone_ia,
      recale: true,
    };
  });
}

/** Le centre vertical des pointillés est dans la zone, élargie d'une demi-hauteur de ligne de chaque côté. */
function memeLigne(zone, trait) {
  const centre = trait.y + trait.h / 2;
  const marge = Math.max(trait.h / 2, zone.h / 2);

  return centre >= zone.y - marge && centre <= zone.y + zone.h + marge;
}
