import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COULEURS = { texte: rgb(0.8, 0, 0), multiligne: rgb(0.88, 0.44, 0), case: rgb(0, 0.31, 0.82), cases: rgb(0.5, 0, 0.75), image: rgb(0, 0.5, 0.38) };

/**
 * PDF de contrôle : le vrai document, avec chaque zone repérée replacée dessus (cadre, numéro)
 * et son libellé écrit dedans comme une valeur saisie, pour voir si l'on tombe en face.
 * Une photo devient une page PDF à sa taille. Les pages tournées (/Rotate) ne sont pas encore gérées.
 *
 * @param {Map<number, object[]>} champsParPage
 */
export async function pdfControle(source, champsParPage) {
  let pdf;
  if (source.toLowerCase().endsWith(".pdf")) {
    pdf = await PDFDocument.load(fs.readFileSync(source), { ignoreEncryption: true, updateMetadata: false });
  } else {
    pdf = await PDFDocument.create();
    const image = await pdf.embedJpg(fs.readFileSync(source));
    pdf.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const police = await pdf.embedFont(StandardFonts.Helvetica);

  for (const [i, page] of pdf.getPages().entries()) {
    // Les fractions se rapportent à la zone affichée (CropBox), comme le rendu envoyé à l'IA.
    const boite = page.getCropBox();
    for (const [n, c] of (champsParPage.get(i + 1) ?? []).entries()) {
      const couleur = COULEURS[c.type] ?? COULEURS.texte;
      const l = c.l * boite.width;
      const h = c.h * boite.height;
      const x = boite.x + c.x * boite.width;
      const y = boite.y + (1 - c.y - c.h) * boite.height;

      page.drawRectangle({ x, y, width: l, height: h, borderColor: couleur, borderWidth: 0.6, opacity: 0, borderOpacity: 0.9 });
      page.drawText(String(n + 1), { x: x + 0.5, y: y + h + 0.8, size: 5, font: police, color: couleur });

      if (c.type === "case") {
        page.drawText("X", { x: x + l / 2 - 0.3 * Math.min(l, h), y: y + h / 2 - 0.35 * Math.min(l, h), size: Math.min(l, h), font: police, color: couleur });
      } else if (c.type !== "image") {
        // Libellé à la place de la valeur, réduit pour tenir dans la largeur.
        const texte = lisible(police, c.libelle);
        const taille = Math.max(3, Math.min(9, h * 0.7, (9 * (l - 2)) / Math.max(1, police.widthOfTextAtSize(texte, 9))));
        page.drawText(texte, { x: x + 1, y: y + Math.max(0.5, (h - taille) / 2 + taille * 0.2), size: taille, font: police, color: couleur, opacity: 0.85 });
      }
    }
  }

  return pdf.save();
}

/** Retire les caractères que la police standard ne sait pas écrire. */
function lisible(police, texte) {
  return [...texte].filter((car) => {
    try {
      police.encodeText(car);
      return true;
    } catch {
      return false;
    }
  }).join("");
}
