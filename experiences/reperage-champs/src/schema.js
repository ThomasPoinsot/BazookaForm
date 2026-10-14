import { z } from "zod";

/**
 * Élément d'une page, dans l'ordre de lecture : une information utile à l'usager, ou un champ à remplir.
 * Les positions sont en pixels de l'image envoyée ; elles sont converties en fractions de page
 * (x, y depuis le haut à gauche).
 */
export const Element = z.object({
  id: z.string().describe("Identifiant unique dans le document : « p2-c5 » pour le 5e champ de la page 2, « p2-i3 » pour la 3e information"),
  nature: z.enum(["information", "champ"]),
  texte: z.string().describe("Information : son contenu reformulé simplement, pour être entendu. Champ : résumé de l'information attendue (« Date de naissance du demandeur »)"),
  importance: z.enum(["essentielle", "utile"]).nullable().describe("Pour une information. Null pour un champ"),
  x: z.number().describe("Bord gauche de la zone, en pixels : pour un champ, l'endroit où écrire ; pour une information, le texte imprimé"),
  y: z.number().describe("Bord haut, en pixels"),
  l: z.number().describe("Largeur, en pixels"),
  h: z.number().describe("Hauteur, en pixels"),
  type: z.enum(["texte", "multiligne", "case", "cases", "image"]).nullable().describe("Pour un champ. Null pour une information"),
  marque: z.enum(["croix", "coche", "puce", "entoure", "barre", "raye"]).nullable()
    .describe("Pour une case : comment marquer le choix. Null sinon"),
  groupe: z.string().nullable().describe("Pour une case : la question qui réunit les cases d'un même choix"),
  choix_unique: z.boolean().nullable(),
  obligatoire: z.boolean().nullable(),
  colonnes: z.number().int().nullable().describe("Pour « cases » : nombre de cases par ligne"),
  lignes: z.number().int().nullable().describe("Pour « cases » : nombre de lignes de cases"),
  format: z.string().nullable().describe("Format attendu s'il est indiqué : « JJ/MM/AAAA », « 14 chiffres »…"),
  confiance: z.enum(["faible", "moyenne", "forte"]),
});

export const Page = z.object({
  description: z.string().describe("Ce qu'est cette page et ce qu'elle demande, en deux ou trois phrases"),
  elements: z.array(Element),
  non_traites: z.array(z.string())
    .describe("Éléments à signaler à l'usager mais non décrits comme champs : tableau à remplir, pièce jointe demandée…"),
});

/** Document simplifié, rédigé une fois toutes les pages vues. */
export const Document = z.object({
  titre: z.string().describe("Nom clair du document"),
  resume: z.string().describe("Ce qu'est ce document, qui l'envoie, à quoi il sert, qui doit le remplir et ce qu'il faut en faire, dit comme un voyant le décrirait à voix haute"),
  a_preparer: z.array(z.string()).describe("Informations et pièces à avoir sous la main avant de commencer"),
  echeances: z.array(z.string()).describe("Dates limites, délais, lieu ou adresse de retour"),
  sections: z.array(z.object({
    titre: z.string(),
    contenu: z.array(z.object({
      nature: z.enum(["texte", "champ"]),
      texte: z.string().nullable().describe("Pour « texte » : ce qu'il faut savoir à cet endroit, reformulé. Null pour un champ"),
      champ: z.string().nullable().describe("Pour « champ » : l'identifiant du champ (« p2-c5 »). Null pour un texte"),
    })),
  })).describe("Le formulaire réorganisé pour être parcouru à l'oreille : chaque champ du document apparaît une fois, avec juste le texte utile autour"),
  omis: z.string().describe("En une ou deux phrases, ce qui a été volontairement laissé de côté (mentions légales, cadres réservés à l'administration…)"),
});
