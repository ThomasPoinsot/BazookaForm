/**
 * Banc d'essai dans le navigateur : on dépose un PDF ou une photo, on choisit un ou deux modèles, l'analyse
 * tourne (les deux en même temps s'il y en a deux), l'avancement s'affiche, puis la page de comparaison s'ouvre.
 *
 *   npm run banc     puis ouvrir http://localhost:4410
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { analyser, expliquer } from "./src/analyse.js";
import { comparer } from "./src/comparaison.js";
import { MODELES_CLAUDE, modelesOpenAI } from "./src/detecteurs/index.js";

const PORT = Number(process.env.PORT ?? 4410);
const RESULTATS = path.join(import.meta.dirname, "resultats");
/** Modèles proposés : Claude, et ceux du compte OpenAI s'il y a une clé (lus au démarrage). */
const OPENAI = await modelesOpenAI().catch((erreur) => {
  console.log(`Modèles OpenAI indisponibles : ${erreur.message}`);
  return [];
});
const MODELES = [...MODELES_CLAUDE, ...OPENAI];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

/** Analyses en cours ou finies depuis le démarrage : id → { lignes, abonnes, fin }. */
const analyses = new Map();

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return envoyer(res, 200, TYPES[".html"], accueil());
    if (req.method === "POST" && url.pathname === "/analyser") return await lancer(req, res, url);
    if (req.method === "GET" && url.pathname.startsWith("/suivi/")) return suivre(res, decodeURIComponent(url.pathname.slice(7)));
    if (req.method === "GET" && url.pathname.startsWith("/resultats/")) return fichier(res, decodeURIComponent(url.pathname.slice(11)));
    envoyer(res, 404, "text/plain; charset=utf-8", "Introuvable");
  } catch (erreur) {
    envoyer(res, 500, "text/plain; charset=utf-8", erreur.message);
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Banc d'essai : http://localhost:${PORT}`));

/** Reçoit le fichier (corps brut), crée le dossier du lancement et démarre l'analyse. */
async function lancer(req, res, url) {
  const nom = path.basename(url.searchParams.get("nom") ?? "");
  // Modèle B facultatif : « aucun » pour un test sur un seul modèle.
  const configurations = ["a", "b"]
    .map((k) => ({ modele: url.searchParams.get(`modele_${k}`), effort: url.searchParams.get(`effort_${k}`) }))
    .filter((c, i) => i === 0 || c.modele !== "aucun");
  if (!/\.(pdf|jpe?g|png)$/i.test(nom)) return envoyer(res, 400, "text/plain; charset=utf-8", "Fichier PDF, JPEG ou PNG attendu.");
  if (configurations.some((c) => !MODELES.includes(c.modele) || !EFFORTS.includes(c.effort))) return envoyer(res, 400, "text/plain; charset=utf-8", "Modèle ou effort inconnu.");
  if (configurations.length === 2 && configurations[0].modele === configurations[1].modele && configurations[0].effort === configurations[1].effort) {
    return envoyer(res, 400, "text/plain; charset=utf-8", "Choisissez deux configurations différentes.");
  }

  const recalage = url.searchParams.get("recalage") !== "0";
  const id = `${new Date().toISOString().slice(0, 19).replace(/:/g, "-")} ${nom.replace(/\.[^.]+$/, "")}`;
  const dossier = path.join(RESULTATS, id);
  const source = path.join(dossier, "source", nom);
  fs.mkdirSync(path.dirname(source), { recursive: true });
  const morceaux = [];
  for await (const morceau of req) morceaux.push(morceau);
  fs.writeFileSync(source, Buffer.concat(morceaux));

  const suivi = { lignes: [], abonnes: new Set(), fin: null };
  analyses.set(id, suivi);
  const journal = (ligne) => {
    suivi.lignes.push(ligne);
    for (const abonne of suivi.abonnes) abonne.write(`data: ${JSON.stringify(ligne)}\n\n`);
  };
  const terminer = (fin) => {
    suivi.fin = fin;
    for (const abonne of suivi.abonnes) abonne.end(`event: fin\ndata: ${JSON.stringify(fin)}\n\n`);
  };

  // Un ou deux modèles (en même temps), sur ce seul document.
  analyser({ fichiers: [source], configurations, sortie: dossier, parallele: 2, recalage, journal })
    .then(async (lignes) => {
      await comparer(dossier, journal);
      const echecs = lignes.filter((l) => l.erreur).map((l) => `${l.detecteur} : ${l.erreur}`);
      terminer({ page: `/resultats/${encodeURIComponent(id)}/comparaison/index.html`, echecs, reussis: lignes.length - echecs.length });
    })
    .catch((erreur) => {
      journal(`ÉCHEC : ${expliquer(erreur)}`);
      terminer({ erreur: expliquer(erreur) });
    });

  envoyer(res, 200, "application/json", JSON.stringify({ id }));
}

/** Avancement d'une analyse, en flux (Server-Sent Events). */
function suivre(res, id) {
  const suivi = analyses.get(id);
  if (!suivi) return envoyer(res, 404, "text/plain; charset=utf-8", "Analyse inconnue");
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  for (const ligne of suivi.lignes) res.write(`data: ${JSON.stringify(ligne)}\n\n`);
  if (suivi.fin) return res.end(`event: fin\ndata: ${JSON.stringify(suivi.fin)}\n\n`);
  suivi.abonnes.add(res);
  res.on("close", () => suivi.abonnes.delete(res));
}

/** Fichiers des résultats, sans sortir du dossier. */
function fichier(res, chemin) {
  const complet = path.resolve(RESULTATS, chemin);
  if (!complet.startsWith(RESULTATS + path.sep) || !fs.existsSync(complet) || !fs.statSync(complet).isFile()) {
    return envoyer(res, 404, "text/plain; charset=utf-8", "Introuvable");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(complet).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(complet).pipe(res);
}

function envoyer(res, statut, type, corps) {
  res.writeHead(statut, { "Content-Type": type });
  res.end(corps);
}

function accueil() {
  const precedents = fs.existsSync(RESULTATS)
    ? fs.readdirSync(RESULTATS).filter((d) => fs.existsSync(path.join(RESULTATS, d, "comparaison", "index.html"))).sort().reverse()
    : [];
  const options = (liste, defaut) => liste.map((v) => `<option${v === defaut ? " selected" : ""}>${v}</option>`).join("");
  const choix = (nom, liste, defaut) => `<select name="${nom}" id="${nom}">${options(liste, defaut)}</select>`;
  const modele = (nom, defaut, facultatif = false) => `<select name="${nom}" id="${nom}">${facultatif ? `<option value="aucun"${defaut === "aucun" ? " selected" : ""}>Aucun (test sur le modèle A seul)</option>` : ""}<optgroup label="Anthropic">${options(MODELES_CLAUDE, defaut)}</optgroup>${OPENAI.length ? `<optgroup label="OpenAI">${options(OPENAI, defaut)}</optgroup>` : ""}</select>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Banc d'essai Bazookaform</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 860px; margin: 24px auto; padding: 0 16px; color: #1d1d1b; background: #f4f4f2; }
  form, .bloc { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  fieldset { border: 1px solid #ddd; border-radius: 6px; margin: 12px 0; }
  label { display: inline-block; margin: 4px 12px 4px 0; }
  button { font-size: 16px; padding: 8px 20px; }
  .echecs { background: #fde2e2; border: 1px solid #e0a0a0; border-radius: 6px; padding: 8px 12px; }
  .echecs li { margin: 4px 0; }
  #journal { font: 13px/1.5 ui-monospace, monospace; white-space: pre-wrap; max-height: 50vh; overflow: auto; background: #111; color: #e6e6e6; padding: 12px; border-radius: 6px; }
  .erreur { color: #b00; }
</style></head>
<body>
<h1>Banc d'essai : analyse d'un formulaire</h1>
<form id="formulaire">
  <p><label for="document">Document (PDF, JPEG ou PNG)</label><br><input type="file" id="document" accept=".pdf,.jpg,.jpeg,.png" required></p>
  <fieldset><legend>Modèle A</legend>
    <label>Modèle ${modele("modele_a", "claude-opus-5-5")}</label>
    <label>Effort ${choix("effort_a", EFFORTS, "high")}</label>
  </fieldset>
  <fieldset><legend>Modèle B (facultatif)</legend>
    <label>Modèle ${modele("modele_b", "aucun", true)}</label>
    <label>Effort ${choix("effort_b", EFFORTS, "high")}</label>
  </fieldset>
  <p><label><input type="checkbox" id="recalage" checked> Recaler les champs sur les pointillés du PDF (PDF natifs seulement ; la zone d'origine de l'IA reste visible dans les résultats)</label></p>
  <p>Les pages sont envoyées à l'API du fournisseur choisi (Anthropic ou OpenAI). Avec Claude, compter environ 0,15 $ par page pour Opus en effort high, moitié moins pour Sonnet, et environ 40 fois moins pour Haiku 5.5 ; pour OpenAI, seuls les jetons sont comptés.</p>
  ${OPENAI.length ? "" : "<p>Aucun modèle OpenAI : clé absente de .env ou liste des modèles inaccessible.</p>"}
  <button type="submit">Analyser</button>
</form>
<div class="bloc" id="suivi" hidden>
  <h2>Avancement</h2>
  <p id="etat" role="status" aria-live="polite"></p>
  <div id="journal"></div>
</div>
${precedents.length ? `<div class="bloc"><h2>Analyses précédentes</h2><ul>${precedents.map((d) => `<li><a href="/resultats/${encodeURIComponent(d)}/comparaison/index.html">${d.replace(/[&<>]/g, "")}</a></li>`).join("")}</ul></div>` : ""}
<script>
  const formulaire = document.getElementById("formulaire");
  const journal = document.getElementById("journal");
  const etat = document.getElementById("etat");
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fichier = document.getElementById("document").files[0];
    const params = new URLSearchParams({ nom: fichier.name });
    for (const nom of ["modele_a", "effort_a", "modele_b", "effort_b"]) params.set(nom, document.getElementById(nom).value);
    params.set("recalage", document.getElementById("recalage").checked ? "1" : "0");
    formulaire.querySelector("button").disabled = true;
    document.getElementById("suivi").hidden = false;
    journal.textContent = "";
    etat.textContent = "Envoi du document…";

    const reponse = await fetch("/analyser?" + params, { method: "POST", body: fichier });
    if (!reponse.ok) {
      etat.innerHTML = '<span class="erreur">' + (await reponse.text()) + "</span>";
      formulaire.querySelector("button").disabled = false;
      return;
    }
    const { id } = await reponse.json();
    etat.textContent = document.getElementById("modele_b").value === "aucun" ? "Analyse en cours." : "Analyse en cours, avec les deux modèles en même temps.";
    const flux = new EventSource("/suivi/" + encodeURIComponent(id));
    flux.onmessage = (m) => { journal.textContent += JSON.parse(m.data) + "\\n"; journal.scrollTop = journal.scrollHeight; };
    flux.addEventListener("fin", (m) => {
      flux.close();
      const fin = JSON.parse(m.data);
      formulaire.querySelector("button").disabled = false;
      // Les résultats ne s'ouvrent pas d'eux-mêmes : le journal reste lisible, et le lien est là.
      etat.replaceChildren();
      if (fin.erreur) {
        etat.append(Object.assign(document.createElement("span"), { className: "erreur", textContent: "Échec : " + fin.erreur }));
        return;
      }
      const titre = document.createElement("p");
      titre.textContent = fin.echecs.length ? (fin.reussis ? "Terminé, avec des échecs." : "Échec : aucun modèle n'a abouti.") : "Terminé.";
      etat.append(titre);
      if (fin.echecs.length) {
        const liste = document.createElement("ul");
        liste.className = "echecs";
        for (const e of fin.echecs) liste.append(Object.assign(document.createElement("li"), { textContent: e }));
        etat.append(liste);
      }
      const lien = Object.assign(document.createElement("a"), { href: fin.page, target: "_blank", textContent: "Ouvrir les résultats dans un nouvel onglet" });
      etat.append(lien);
    });
  });
</script>
</body></html>`;
}
