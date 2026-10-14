/**
 * Recale un lancement déjà fait sur les pointillés du PDF (voir src/recalage.js), sans rappeler l'IA,
 * puis régénère sa page de résultats. Repart toujours de la zone d'origine de l'IA : on peut le relancer.
 *
 *   npm run recaler -- [resultats/<lancement>]     (par défaut : le lancement le plus récent)
 */
import fs from "node:fs";
import path from "node:path";
import { comparer } from "./src/comparaison.js";
import { pointilles, recaler } from "./src/recalage.js";
import { superposer } from "./src/superposition.js";
import { pages } from "./src/pages.js";

const RESULTATS = path.join(import.meta.dirname, "resultats");
const dossier = path.resolve(process.argv[2] ?? path.join(RESULTATS, fs.readdirSync(RESULTATS).sort().at(-1)));
const sources = JSON.parse(fs.readFileSync(path.join(dossier, "sources.json"), "utf8"));

for (const [nom, source] of Object.entries(sources)) {
  const traits = pointilles(source);
  const images = pages(source);
  for (const detecteur of fs.readdirSync(dossier).filter((d) => fs.existsSync(path.join(dossier, d, nom)))) {
    for (const page of images) {
      const fichier = path.join(dossier, detecteur, nom, `page-${page.numero}.json`);
      if (!fs.existsSync(fichier)) continue;
      const analyse = JSON.parse(fs.readFileSync(fichier, "utf8"));
      if (!analyse.elements) continue; // ancien format, sans informations
      const origine = analyse.elements.map((e) => (e.zone_ia ? { ...e, ...e.zone_ia } : e));
      const elements = recaler(origine, traits.get(page.numero) ?? []);
      fs.writeFileSync(fichier, JSON.stringify({ ...analyse, elements }, null, 2));
      superposer(page, elements, null, fichier.replace(/\.json$/, ".png"));
      const champs = elements.filter((e) => e.nature === "champ");
      console.log(`${nom} · ${detecteur} · page ${page.numero} : ${champs.filter((c) => c.recale).length} recalés sur ${champs.length} champs`);
    }
  }
}

console.log(`\nOuvrir : ${await comparer(dossier, () => {})}`);
