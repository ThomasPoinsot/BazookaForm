/**
 * Page de comparaison d'un lancement (voir src/comparaison.js).
 *
 *   npm run comparer -- [resultats/<date>]     (par défaut : le lancement le plus récent)
 */
import fs from "node:fs";
import path from "node:path";
import { comparer } from "./src/comparaison.js";

const RESULTATS = path.join(import.meta.dirname, "resultats");
const dossier = path.resolve(process.argv[2] ?? path.join(RESULTATS, fs.readdirSync(RESULTATS).sort().at(-1)));

console.log(`\nOuvrir : ${await comparer(dossier)}`);
