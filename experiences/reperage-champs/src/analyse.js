import fs from "node:fs";
import path from "node:path";
import { creerDetecteur } from "./detecteurs/index.js";
import { champs, enFractions } from "./elements.js";
import { pages } from "./pages.js";
import { pointilles, recaler } from "./recalage.js";
import { noter } from "./score.js";
import { superposer } from "./superposition.js";
import { champsIntegres } from "./verite.js";

/**
 * Analyse des documents par chaque modèle : une conversation par document et par modèle, une page
 * par tour, puis le document simplifié. Écrit dans `sortie` :
 *   <modele>-<effort>/<document>/page-N.{json,png}, document.json ;
 *   reference/<document>/page-N.png (champs intégrés du PDF) ;
 *   sources.json (document → fichier source) et rapport.md.
 *
 * @param {{modele: string, effort: string}[]} configurations  un détecteur par configuration
 * @param {boolean} recalage  recaler les champs « texte » sur les pointillés du PDF (voir recalage.js)
 * @param {(ligne: string) => void} journal  suivi de l'avancement
 */
export async function analyser({ fichiers, configurations, sortie, parallele = 1, recalage = true, journal = console.log }) {
  const detecteurs = configurations.map(creerDetecteur);
  fs.mkdirSync(sortie, { recursive: true });

  const travaux = [];
  const sources = {};
  for (const fichier of fichiers) {
    const nom = path.basename(fichier).replace(/\.[^.]+$/, "");
    sources[nom] = fichier;
    journal(`${nom} : préparation des pages`);
    const images = pages(fichier);
    const traits = recalage ? pointilles(fichier) : new Map();
    if (recalage) journal(`${nom} : ${[...traits.values()].reduce((s, t) => s + t.length, 0)} séries de pointillés trouvées dans le PDF pour le recalage`);
    const reference = await champsIntegres(fichier).catch(() => null);

    if (reference) {
      const dossier = path.join(sortie, "reference", nom);
      fs.mkdirSync(dossier, { recursive: true });
      for (const page of images) superposer(page, [], reference.get(page.numero) ?? [], path.join(dossier, `page-${page.numero}.png`));
    }
    for (const detecteur of detecteurs) travaux.push({ nom, images, reference, traits, detecteur });
  }
  fs.writeFileSync(path.join(sortie, "sources.json"), JSON.stringify(sources, null, 2));

  const lignes = await enParallele(travaux, parallele, async ({ nom, images, reference, traits, detecteur }) => {
    const dossier = path.join(sortie, detecteur.nom, nom);
    fs.mkdirSync(dossier, { recursive: true });
    const debut = Date.now();
    const notes = [];
    let nbChamps = 0;
    let nbInfos = 0;
    journal(`${nom} · ${detecteur.nom} : début (${images.length} pages)`);

    try {
      const { document, cout } = await detecteur.analyserDocument(images, (page, analyse) => {
        const elements = recaler(analyse.elements.map((e) => enFractions(e, page)), traits.get(page.numero) ?? []);
        const liste = champs(elements);
        const recales = liste.filter((c) => c.recale).length;
        nbChamps += liste.length;
        nbInfos += elements.length - liste.length;
        fs.writeFileSync(path.join(dossier, `page-${page.numero}.json`), JSON.stringify({ ...analyse, elements }, null, 2));
        superposer(page, elements, reference?.get(page.numero), path.join(dossier, `page-${page.numero}.png`));
        if (reference) notes.push(noter(liste, reference.get(page.numero) ?? []));
        journal(`${nom} · ${detecteur.nom} · page ${page.numero} / ${images.length} : ${liste.length} champs (${recales} recalés sur les pointillés), ${elements.length - liste.length} informations`);
      });
      fs.writeFileSync(path.join(dossier, "document.json"), JSON.stringify(document, null, 2));
      journal(`${nom} · ${detecteur.nom} : document simplifié (${document.sections.length} sections), ${prix(cout)}`);

      return { nom, detecteur: detecteur.nom, pages: images.length, nbChamps, nbInfos, notes, cout, duree: (Date.now() - debut) / 1000 };
    } catch (erreur) {
      journal(`${nom} · ${detecteur.nom} : ÉCHEC ${expliquer(erreur)}`);
      fs.writeFileSync(path.join(dossier, "erreur.txt"), `${expliquer(erreur)}\n\n${erreur.stack ?? erreur}`);

      return { nom, detecteur: detecteur.nom, pages: images.length, nbChamps, nbInfos, notes, erreur: expliquer(erreur), duree: (Date.now() - debut) / 1000 };
    }
  });

  fs.writeFileSync(path.join(sortie, "rapport.md"), rapport(lignes));

  return lignes;
}

function rapport(lignes) {
  const texte = ["# Analyse des formulaires", "", `Référence : champs intégrés du PDF quand il y en a (recouvrement ≥ 0,3).`, "",
    "| Document | Modèle | Pages | Résultat | Champs | Informations | Référence trouvée | Recouvrement moyen | Jetons entrée / sortie | Coût | Durée |",
    "|---|---|---|---|---|---|---|---|---|---|---|"];
  const totaux = {};

  for (const l of lignes) {
    const ref = l.notes.reduce((s, n) => s + n.reference, 0);
    const trouves = l.notes.reduce((s, n) => s + n.trouves, 0);
    const iou = trouves ? l.notes.reduce((s, n) => s + n.iouMoyen * n.trouves, 0) / trouves : 0;

    texte.push(`| ${l.nom} | ${l.detecteur} | ${l.pages} | ${l.erreur ? `échec : ${l.erreur.slice(0, 80)}` : "ok"} | ${l.nbChamps} | ${l.nbInfos} | ${ref ? `${trouves} / ${ref}` : "—"} | ${ref ? iou.toFixed(2) : "—"} | ${l.cout ? `${l.cout.entree} / ${l.cout.sortie}` : "—"} | ${l.cout ? prix(l.cout) : "—"} | ${l.duree.toFixed(0)} s |`);
    totaux[l.detecteur] = (totaux[l.detecteur] ?? 0) + (l.cout?.dollars ?? 0);
  }
  texte.push("", ...Object.entries(totaux).map(([d, c]) => `- Coût total ${d} : ${c.toFixed(2)} $ (hors documents en échec)`), "");

  return texte.join("\n");
}

/** Message d'erreur en clair, suivi du message d'origine pour les cas connus. */
export function expliquer(erreur) {
  const message = erreur?.error?.error?.message ?? erreur?.message ?? String(erreur);
  if (/credit balance is too low|insufficient_quota|exceeded your current quota/i.test(message)) {
    return `Crédit épuisé chez le fournisseur : recharger le compte (console.anthropic.com, Plans & Billing, ou platform.openai.com, Billing). (${message})`;
  }
  if (erreur?.status === 401 || /invalid x-api-key|incorrect api key|authentication/i.test(message)) {
    return `Clé API refusée : vérifier la clé dans .env puis relancer le banc. (${message})`;
  }
  if (erreur?.status === 404 || /model.*not found|does not exist/i.test(message)) return `Modèle inconnu ou non accessible avec cette clé. (${message})`;
  if (erreur?.status === 429) return `Trop de requêtes : attendre un peu et relancer. (${message})`;

  return message;
}

/** Coût lisible ; les modèles sans grille de prix n'ont que leurs jetons. */
function prix(cout) {
  return cout.dollars === null ? `${cout.entree + cout.sortie} jetons (prix non calculé)` : `${cout.dollars.toFixed(3)} $`;
}

async function enParallele(elements, limite, traiter) {
  const resultats = new Array(elements.length);
  let suivant = 0;
  await Promise.all(Array.from({ length: Math.min(limite, elements.length) }, async () => {
    while (suivant < elements.length) {
      const i = suivant++;
      resultats[i] = await traiter(elements[i]);
    }
  }));

  return resultats;
}
