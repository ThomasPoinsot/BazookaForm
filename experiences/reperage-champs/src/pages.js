import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Côté le plus long des images envoyées à l'IA, en pixels. */
export const COTE_MAX = 1568;

/**
 * Images PNG des pages d'un document (PDF ou photo), le plus long côté à COTE_MAX.
 * Rendu par pdftoppm et ImageMagick : suffisant pour l'expérience, l'app utilisera pdf.js.
 *
 * @return {{numero: number, png: Buffer, largeur: number, hauteur: number}[]}
 */
export function pages(fichier) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pages-"));
  try {
    if (fichier.toLowerCase().endsWith(".pdf")) {
      execFileSync("pdftoppm", ["-png", "-scale-to", String(COTE_MAX), fichier, path.join(dossier, "p")]);
    } else {
      execFileSync("magick", [fichier, "-auto-orient", "-resize", `${COTE_MAX}x${COTE_MAX}`, path.join(dossier, "p-1.png")]);
    }

    return fs.readdirSync(dossier)
      .map((nom) => ({ nom, numero: Number(nom.match(/(\d+)\.png$/)[1]) }))
      .sort((a, b) => a.numero - b.numero)
      .map(({ nom, numero }) => {
        const chemin = path.join(dossier, nom);
        const [largeur, hauteur] = execFileSync("magick", ["identify", "-format", "%w %h", chemin]).toString().split(" ").map(Number);
        return { numero, png: fs.readFileSync(chemin), largeur, hauteur };
      });
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}
