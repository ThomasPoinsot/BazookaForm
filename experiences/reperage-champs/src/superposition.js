import { execFileSync } from "node:child_process";

const COULEURS = { texte: "#d00000", multiligne: "#e07000", case: "#0050d0", cases: "#8000c0", image: "#008060", information: "#808080" };

/**
 * Page avec les éléments repérés dessinés et numérotés dans l'ordre de lecture (couleur selon le type
 * de champ, gris pour une information), et la référence
 * en vert pointillé s'il y en a une. Pour la relecture par un voyant.
 */
export function superposer(page, champs, reference, sortie) {
  const args = ["png:-", "-fill", "none", "-strokewidth", "2"];

  for (const z of reference ?? []) {
    args.push("-stroke", "#00a000", "-draw", `stroke-dasharray 6 4 rectangle ${rect(z, page)}`);
  }
  for (const [i, z] of champs.entries()) {
    const couleur = COULEURS[z.nature === "information" ? "information" : z.type] ?? "#d00000";
    args.push("-stroke", couleur, "-draw", `rectangle ${rect(z, page)}`);
    args.push("-stroke", "none", "-fill", couleur, "-pointsize", "14",
      "-draw", `text ${Math.round(z.x * page.largeur) + 2},${Math.max(12, Math.round(z.y * page.hauteur) - 2)} '${i + 1}'`, "-fill", "none");
  }
  execFileSync("magick", [...args, sortie], { input: page.png });
}

function rect(z, page) {
  const x = Math.round(z.x * page.largeur);
  const y = Math.round(z.y * page.hauteur);

  return `${x},${y} ${x + Math.round(z.l * page.largeur)},${y + Math.round(z.h * page.hauteur)}`;
}
