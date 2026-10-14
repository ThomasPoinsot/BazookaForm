/**
 * Analyse d'un seul document en ligne de commande (voir src/analyse.js). Pas d'envoi par lot :
 * les tests se lancent un document à la fois, de préférence depuis le banc d'essai (npm run banc).
 *
 *   npm run reperer -- [--modeles claude-opus-5-5[,claude-sonnet-5-5]] [--effort high] <fichier>
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { analyser } from "./src/analyse.js";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    modeles: { type: "string", default: "claude-opus-5-5" },
    effort: { type: "string", default: "high" },
  },
});

if (positionals.length !== 1) {
  console.error("Indiquer un seul document : npm run reperer -- <fichier>");
  process.exit(1);
}

const fichier = path.resolve(positionals[0]);
const nom = path.basename(fichier).replace(/\.[^.]+$/, "");
const sortie = path.resolve(import.meta.dirname, "resultats", `${new Date().toISOString().slice(0, 19).replace(/:/g, "-")} ${nom}`);
const configurations = options.modeles.split(",").map((modele) => ({ modele, effort: options.effort }));

await analyser({ fichiers: [fichier], configurations, sortie, parallele: configurations.length });
console.log(`\nRapport : ${path.join(sortie, "rapport.md")}`);
