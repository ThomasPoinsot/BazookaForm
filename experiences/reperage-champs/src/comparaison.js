import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { champs as champsDe, informations } from "./elements.js";
import { pages } from "./pages.js";
import { pdfControle } from "./pdf-controle.js";
import { apparier } from "./score.js";
import { champsIntegres } from "./verite.js";

const CORPUS = path.resolve(import.meta.dirname, "../../../Formulaires PDF de test");

/**
 * Page de comparaison d'un lancement (`dossier`/comparaison/index.html) : pour chaque page, les deux
 * premiers modèles côte à côte, différences de champs mises en évidence (zones vues par un seul modèle,
 * type ou marque différents), informations en gris, référence AcroForm quand il y en a une ; puis le
 * document simplifié de chaque modèle ; et un PDF de contrôle par modèle (zones replacées sur le vrai PDF).
 *
 * @return {string} chemin de la page
 */
export async function comparer(dossier, journal = console.log) {
  const sortie = path.join(dossier, "comparaison");
  fs.mkdirSync(path.join(sortie, "pages"), { recursive: true });

  const detecteurs = sousDossiers(dossier).filter((d) => !["reference", "comparaison"].includes(d));
  const [A, B] = detecteurs;
  const sources = sourcesDe(dossier);
  const documents = [...new Set(detecteurs.flatMap((d) => sousDossiers(path.join(dossier, d))))].sort();

  const sections = [];
  const sommaire = [];
  for (const [k, doc] of documents.entries()) {
    const source = sources.get(doc);
    if (!source) {
      journal(`${doc} : source introuvable, ignoré`);
      continue;
    }
    journal(`${doc} : comparaison`);
    const images = pages(source);
    const reference = await champsIntegres(source).catch(() => null);

    // Champs de chaque modèle, par page, et PDF de contrôle.
    const champs = {};
    const liens = [];
    const echecs = [];
    for (const d of detecteurs) {
      champs[d] = new Map(images.map((p) => [p.numero, lirePage(path.join(dossier, d, doc, `page-${p.numero}.json`))]));
      const fichier = path.join("pdf", d, `${doc}.pdf`);
      fs.mkdirSync(path.join(sortie, "pdf", d), { recursive: true });
      fs.writeFileSync(path.join(sortie, fichier), await pdfControle(source, new Map([...champs[d]].map(([n, c]) => [n, c?.champs ?? []]))));
      liens.push(`<a href="${encodeURI(fichier)}" target="_blank">PDF de contrôle ${echapper(d)}</a>`);
      const erreur = path.join(dossier, d, doc, "erreur.txt");
      if (fs.existsSync(erreur)) echecs.push(`${d} : ${fs.readFileSync(erreur, "utf8").split("\n")[0]}`);
    }

    let accords = 0;
    let ecarts = 0;
    const blocs = [];
    for (const page of images) {
      const image = path.join("pages", `${k + 1}-p${page.numero}.jpg`);
      execFileSync("magick", ["png:-", "-quality", "80", path.join(sortie, image)], { input: page.png });

      const ref = reference?.get(page.numero) ?? [];
      const a = champs[A]?.get(page.numero);
      const b = B ? champs[B]?.get(page.numero) : null;
      const ca = a?.champs ?? [];
      const cb = b?.champs ?? [];
      const paires = B ? apparier(ca, cb) : [];
      const pairDeA = new Map(paires.map((p) => [p.i, p]));
      const pairDeB = new Map(paires.map((p) => [p.j, p]));
      const differe = (p) => ca[p.i].type !== cb[p.j].type || (ca[p.i].marque ?? null) !== (cb[p.j].marque ?? null);
      const seulsA = ca.map((_, i) => i).filter((i) => !pairDeA.has(i));
      const seulsB = cb.map((_, j) => j).filter((j) => !pairDeB.has(j));
      const typesDiff = paires.filter(differe);
      accords += paires.length - typesDiff.length;
      ecarts += seulsA.length + seulsB.length + typesDiff.length;

      const colonne = (d, analyse, liste, pairDe, autre) => {
        const infos = (analyse?.infos ?? []).map((e) => zone(e, "z info", `${e.importance === "essentielle" ? "Information essentielle" : "Information"} : ${e.texte}`));
        const manques = new Set(ref.map((_, i) => i));
        for (const p of apparier(ref, liste)) manques.delete(p.i);
        const zones = liste.map((c, i) => {
          const p = pairDe.get(i);
          const etat = !B ? "commun" : !p ? "seul" : differe(p) ? "diff" : "commun";
          const id = p ? `${k}-${page.numero}-${p.i}` : "";
          return zone(c, `z ${etat} t-${c.type}`, `${i + 1}. ${c.libelle} (${c.type}${c.marque ? `, ${c.marque}` : ""}, confiance ${c.confiance})${c.recale ? " — recalé sur les pointillés" : ""}${etat === "seul" ? ` — absent chez ${autre}` : ""}`, i + 1, id);
        });
        // Zone d'origine de l'IA, pour les champs recalés (cachée par défaut).
        const avant = liste.filter((c) => c.recale && c.zone_ia).map((c) => zone(c.zone_ia, "z ia", `Zone de l'IA avant recalage : ${c.libelle}`));
        const refs = ref.map((r, i) => zone(r, `z ref${manques.has(i) ? " manque" : ""}`, `Référence : ${r.libelle}${manques.has(i) ? " — non trouvé" : ""}`));

        return `<div class="col">
          <h4>${echapper(d)} <small>${analyse ? `${liste.length} champs${liste.some((c) => c.recale) ? `, dont ${liste.filter((c) => c.recale).length} recalés` : ""}` : "échec"}${ref.length ? ` · référence ${ref.length - manques.size} / ${ref.length}` : ""}</small></h4>
          <div class="page"><img src="${encodeURI(image)}" loading="lazy" alt="">${infos.join("")}${refs.join("")}${avant.join("")}${zones.join("")}</div>
          ${analyse ? `<p class="desc">${echapper(analyse.description)}</p>${analyse.non_traites?.length ? `<ul class="nt">${analyse.non_traites.map((t) => `<li>${echapper(t)}</li>`).join("")}</ul>` : ""}` : `<p class="erreur">Pas de résultat pour cette page.</p>`}
        </div>`;
      };

      const lignes = [
        ...seulsA.map((i) => [`<b>${i + 1}</b>. ${echapper(ca[i].libelle)} <i>${ca[i].type}</i>`, `<span class="absent">absent</span>`, "seul"]),
        ...seulsB.map((j) => [`<span class="absent">absent</span>`, `<b>${j + 1}</b>. ${echapper(cb[j].libelle)} <i>${cb[j].type}</i>`, "seul"]),
        ...paires.sort((p, q) => p.i - q.i).map((p) => [
          `<b>${p.i + 1}</b>. ${echapper(ca[p.i].libelle)} <i>${ca[p.i].type}${ca[p.i].marque ? ` ${ca[p.i].marque}` : ""}</i>`,
          `<b>${p.j + 1}</b>. ${echapper(cb[p.j].libelle)} <i>${cb[p.j].type}${cb[p.j].marque ? ` ${cb[p.j].marque}` : ""}</i>`,
          differe(p) ? "diff" : "commun",
        ]),
      ];

      blocs.push(`<section class="p">
        <h3>${echapper(doc)} — page ${page.numero}${B ? ` <span class="badge ${seulsA.length + seulsB.length + typesDiff.length ? "rouge" : "vert"}">${paires.length - typesDiff.length} en accord · ${seulsA.length} seulement ${echapper(A)} · ${seulsB.length} seulement ${echapper(B)} · ${typesDiff.length} type différent</span>` : ""}</h3>
        <div class="cols">${colonne(A, a, ca, pairDeA, B)}${B ? colonne(B, b, cb, pairDeB, A) : ""}</div>
        ${B ? `<details${seulsA.length + seulsB.length + typesDiff.length ? " open" : ""}><summary>Champs comparés (${lignes.length})</summary>
          <table><thead><tr><th>${echapper(A)}</th><th>${echapper(B)}</th></tr></thead><tbody>
          ${lignes.map(([x, y, etat]) => `<tr class="${etat}"><td>${x}</td><td>${y}</td></tr>`).join("")}
          </tbody></table></details>` : ""}
      </section>`);
    }

    const ancre = `doc-${k + 1}`;
    sommaire.push(`<li><a href="#${ancre}">${echapper(doc)}</a> <small>${images.length} p. · ${accords} en accord · ${ecarts} écarts</small></li>`);
    const simplifies = detecteurs.slice(0, 2).map((d) => documentSimplifie(d, lireJson(path.join(dossier, d, doc, "document.json")), champs[d]));
    sections.push(`<article id="${ancre}"><h2>${echapper(doc)}</h2><p class="liens">${liens.join(" · ")}</p>
    ${echecs.map((e) => `<p class="echec">Échec ${echapper(e)}</p>`).join("")}
      ${simplifies.some(Boolean) ? `<section class="p"><h3>Document simplifié, tel qu'il serait présenté à l'utilisateur</h3><div class="cols">${simplifies.map((s, i) => `<div class="col"><h4>${echapper(detecteurs[i])}</h4>${s ?? `<p class="erreur">Pas de document simplifié.</p>`}</div>`).join("")}</div></section>` : ""}
      ${blocs.join("")}</article>`);
  }

  const page = path.join(sortie, "index.html");
  fs.writeFileSync(page, html(A, B, sommaire, sections));

  return page;
}

/** Document simplifié rendu comme l'utilisateur le parcourrait : texte utile et champs, dans l'ordre. */
function documentSimplifie(d, doc, pagesAnalysees) {
  if (!doc) return null;
  const tous = new Map([...pagesAnalysees.values()].flatMap((a) => a?.champs ?? []).map((c) => [c.id, c]));
  const cites = new Set();
  const liste = (titre, l) => l?.length ? `<h5>${titre}</h5><ul>${l.map((t) => `<li>${echapper(t)}</li>`).join("")}</ul>` : "";

  const sections = doc.sections.map((s) => `<h5>${echapper(s.titre)}</h5>${s.contenu.map((c) => {
    if (c.nature === "texte") return `<p>${echapper(c.texte)}</p>`;
    const champ = tous.get(c.champ);
    cites.add(c.champ);
    if (!champ) return `<p class="champ inconnu">Champ ${echapper(c.champ)} introuvable dans les pages</p>`;
    const details = [champ.type, champ.marque, champ.format, champ.obligatoire ? "obligatoire" : null, champ.groupe ? `question : ${champ.groupe}` : null].filter(Boolean).join(", ");
    return `<p class="champ t-${champ.type}"><span class="id">${echapper(champ.id)}</span> ${echapper(champ.libelle)} <small>(${echapper(details)}, page ${champ.page})</small></p>`;
  }).join("")}`).join("");
  const oublies = [...tous.values()].filter((c) => !cites.has(c.id));

  return `<div class="simplifie">
    <h4>${echapper(doc.titre)}</h4>
    <p>${echapper(doc.resume)}</p>
    ${liste("À préparer", doc.a_preparer)}${liste("Échéances et retour", doc.echeances)}
    ${sections}
    <p class="omis">Laissé de côté : ${echapper(doc.omis)}</p>
    ${oublies.length ? `<p class="erreur">${oublies.length} champ(s) repéré(s) mais absent(s) du document simplifié : ${oublies.map((c) => echapper(`${c.id} ${c.libelle}`)).join(" ; ")}</p>` : `<p class="ok">Tous les champs repérés figurent dans le document simplifié.</p>`}
  </div>`;
}

/** Fichier source de chaque document : sources.json du lancement, sinon le corpus de test. */
function sourcesDe(dossier) {
  const fichier = path.join(dossier, "sources.json");
  if (fs.existsSync(fichier)) return new Map(Object.entries(JSON.parse(fs.readFileSync(fichier, "utf8"))));

  return new Map(fs.readdirSync(CORPUS, { recursive: true })
    .filter((f) => /\.(pdf|jpe?g|png)$/i.test(f))
    .map((f) => [path.basename(f).replace(/\.[^.]+$/, ""), path.join(CORPUS, f)]));
}

function zone(c, classe, titre, numero = "", id = "") {
  const style = `left:${(c.x * 100).toFixed(2)}%;top:${(c.y * 100).toFixed(2)}%;width:${(c.l * 100).toFixed(2)}%;height:${(c.h * 100).toFixed(2)}%`;

  return `<div class="${classe}" style="${style}" title="${echapper(titre)}"${id ? ` data-paire="${id}"` : ""}>${numero ? `<span>${numero}</span>` : ""}</div>`;
}

function lireJson(fichier) {
  return fs.existsSync(fichier) ? JSON.parse(fs.readFileSync(fichier, "utf8")) : null;
}

/** Analyse d'une page : champs et informations ; accepte l'ancien format (champs seuls). */
function lirePage(fichier) {
  const analyse = lireJson(fichier);
  if (!analyse) return null;
  const elements = analyse.elements ?? analyse.champs.map((c) => ({ ...c, nature: "champ", texte: c.libelle }));

  return { ...analyse, champs: champsDe(elements), infos: informations(elements) };
}

function sousDossiers(d) {
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
}

function echapper(t) {
  return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function html(A, B, sommaire, sections) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparaison du repérage</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 0; background: #f4f4f2; color: #1d1d1b; }
  header { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid #ccc; padding: 8px 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  header h1 { font-size: 16px; margin: 0; }
  main { padding: 16px; max-width: 1800px; margin: auto; }
  nav ul { columns: 2; padding-left: 18px; }
  article { margin-top: 32px; }
  section.p { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin: 12px 0; }
  h3 { font-size: 15px; margin: 0 0 8px; }
  .badge { font-size: 12px; font-weight: normal; padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
  .badge.vert { background: #dff3e3; } .badge.rouge { background: #fde2e2; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
  .page { position: relative; border: 1px solid #bbb; }
  .page img { display: block; width: 100%; }
  .z { position: absolute; box-sizing: border-box; border: 1.5px solid; }
  .z span { position: absolute; top: -13px; left: 0; font-size: 10px; font-weight: bold; }
  .t-texte { border-color: #d00000; color: #d00000; } .t-multiligne { border-color: #e07000; color: #e07000; }
  .t-case { border-color: #0050d0; color: #0050d0; } .t-cases { border-color: #8000c0; color: #8000c0; } .t-image { border-color: #008060; color: #008060; }
  .z.commun { opacity: .55; }
  .z.seul { border: 3px solid #ff00b4; background: rgba(255, 0, 180, .18); color: #c00090; }
  .z.diff { border: 3px dashed #ff8c00; background: rgba(255, 140, 0, .15); }
  .z.ref { border: 1.5px dashed #00a000; }
  .z.info { border: 1px dashed #888; background: rgba(128, 128, 128, .08); }
  body.sans-info .z.info { display: none; }
  .z.ia { border: 1.5px dotted #000; background: rgba(0, 0, 0, .06); display: none; }
  body.avant .z.ia { display: block; }
  .simplifie h5 { margin: 14px 0 4px; font-size: 14px; }
  .simplifie p { margin: 4px 0; }
  .champ { border-left: 4px solid; padding-left: 8px; background: #fafafa; }
  .champ .id { font-family: monospace; font-size: 11px; color: #666; }
  .champ.inconnu { border-color: #c00; color: #c00; }
  .echec { background: #fde2e2; border: 1px solid #e0a0a0; border-radius: 6px; padding: 8px 12px; }
  .omis { color: #666; font-style: italic; } .ok { color: #070; }
  .z.ref.manque { border: 2.5px dashed #00a000; background: rgba(0, 160, 0, .2); }
  .z.actif { outline: 3px solid #000; opacity: 1; z-index: 2; }
  body.ecarts .z.commun { display: none; }
  body.sans-ref .z.ref { display: none; }
  body.sans-num .z span { display: none; }
  .desc { color: #444; } .nt { color: #7a4b00; } .erreur { color: #c00; }
  table { border-collapse: collapse; width: 100%; margin-top: 6px; }
  td, th { border: 1px solid #ddd; padding: 3px 6px; vertical-align: top; text-align: left; width: 50%; }
  tr.seul { background: #ffe6f6; } tr.diff { background: #fff1dd; }
  body.ecarts tr.commun { display: none; }
  .absent { color: #c00090; font-style: italic; }
  .legende span { display: inline-block; padding: 0 6px; margin-right: 4px; border-radius: 3px; font-size: 12px; }
</style></head>
<body>
<header>
  <h1>Repérage : ${echapper(A)}${B ? ` / ${echapper(B)}` : ""}</h1>
  <label><input type="checkbox" id="ecarts"> Seulement les écarts</label>
  <label><input type="checkbox" id="ref" checked> Référence AcroForm</label>
  <label><input type="checkbox" id="num" checked> Numéros</label>
  <label><input type="checkbox" id="info" checked> Informations</label>
  <label><input type="checkbox" id="avant"> Zones de l'IA avant recalage</label>
  <span class="legende"><span style="background:rgba(255,0,180,.25)">vu par un seul modèle</span><span style="background:rgba(255,140,0,.25)">type ou marque différent</span><span style="background:rgba(0,160,0,.25)">référence non trouvée</span><span style="background:rgba(128,128,128,.2)">information</span></span>
</header>
<main>
  <p>Survoler une zone affiche son libellé ; cliquer met en valeur la zone correspondante chez l'autre modèle. Les PDF de contrôle replacent les zones sur le vrai document, libellé écrit dedans.</p>
  <nav><ul>${sommaire.join("")}</ul></nav>
  ${sections.join("")}
</main>
<script>
  const bascule = (id, classe, inverse) => {
    const c = document.getElementById(id);
    const maj = () => document.body.classList.toggle(classe, inverse ? !c.checked : c.checked);
    c.addEventListener("change", maj); maj();
  };
  bascule("ecarts", "ecarts"); bascule("ref", "sans-ref", true); bascule("num", "sans-num", true); bascule("info", "sans-info", true); bascule("avant", "avant");
  document.addEventListener("click", (e) => {
    const z = e.target.closest(".z[data-paire]");
    document.querySelectorAll(".z.actif").forEach((x) => x.classList.remove("actif"));
    if (z) document.querySelectorAll('.z[data-paire="' + z.dataset.paire + '"]').forEach((x) => x.classList.add("actif"));
  });
</script>
</body></html>`;
}
