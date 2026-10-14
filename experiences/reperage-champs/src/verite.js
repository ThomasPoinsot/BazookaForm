import fs from "node:fs";
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFSignature } from "pdf-lib";

/**
 * Champs intégrés d'un PDF (AcroForm), servant de référence pour noter le repérage.
 * Positions en fractions de page, depuis le haut à gauche. Null si le PDF n'a pas de champs.
 *
 * @return {Map<number, {libelle: string, type: string, x: number, y: number, l: number, h: number}[]> | null}
 */
export async function champsIntegres(fichier) {
  if (!fichier.toLowerCase().endsWith(".pdf")) return null;

  const pdf = await PDFDocument.load(fs.readFileSync(fichier), { ignoreEncryption: true, updateMetadata: false });
  const champs = pdf.getForm().getFields();
  if (champs.length === 0) return null;

  const pages = pdf.getPages();
  const parPage = new Map();
  for (const champ of champs) {
    const type = champ instanceof PDFCheckBox || champ instanceof PDFRadioGroup ? "case"
      : champ instanceof PDFSignature ? "image" : "texte";
    for (const widget of champ.acroField.getWidgets()) {
      const numero = pages.findIndex((p) => p.ref === widget.P()) + 1 || 1;
      const { width, height } = pages[numero - 1].getSize();
      const r = widget.getRectangle();
      if (r.width <= 0 || r.height <= 0) continue; // champ caché
      if (!parPage.has(numero)) parPage.set(numero, []);
      parPage.get(numero).push({
        libelle: champ.getName(),
        type,
        x: r.x / width,
        y: 1 - (r.y + r.height) / height,
        l: r.width / width,
        h: r.height / height,
      });
    }
  }

  return parPage;
}
