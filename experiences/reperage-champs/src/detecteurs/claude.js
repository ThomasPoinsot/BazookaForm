import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CONSIGNES, SYNTHESE } from "../consignes.js";
import { Document, Page } from "../schema.js";

/**
 * Prix en dollars par million de jetons : entrée, sortie, et lecture en cache (fraction du prix d'entrée ;
 * l'écriture en cache coûte ×1,25). Haiku 5.5 a deux paliers : au-delà de 100 000 jetons envoyés, le palier haut.
 */
const PRIX = {
  "claude-opus-5-5": { entree: 4, sortie: 20, cache: 0.05 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10, cache: 0.05 },
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5, cache: 0.1, auDela: { seuil: 100_000, entree: 0.5, sortie: 2.5 } },
};
/** Modèles qui acceptent le repli serveur `fallbacks: "default"`. */
const AVEC_REPLI = ["claude-opus-5-5", "claude-sonnet-5-5"];

/**
 * Analyse d'un document par un modèle Claude : une conversation par document, une page par tour,
 * puis un dernier tour pour le document simplifié. Les tours précédents restent dans l'historique
 * (mis en cache), pour que le modèle relie les pages entre elles.
 */
export function detecteurClaude({ modele, effort = "high" }) {
  const client = new Anthropic();
  const prix = PRIX[modele] ?? null;

  return {
    nom: `${modele}-${effort}`,

    /**
     * @param {{numero: number, png: Buffer, largeur: number, hauteur: number}[]} pages
     * @param {(page: object, analyse: object) => void} parPage  appelé après chaque page
     */
    async analyserDocument(pages, parPage = () => {}) {
      const messages = [];
      const cout = { entree: 0, sortie: 0, dollars: prix ? 0 : null };

      const tour = async (contenu, format) => {
        messages.push({ role: "user", content: contenu });
        const reponse = await client.beta.messages.parse({
          model: modele,
          max_tokens: 20000,
          ...(AVEC_REPLI.includes(modele) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
          cache_control: { type: "ephemeral" },
          output_config: { effort, format: betaZodOutputFormat(format) },
          system: CONSIGNES,
          messages,
        });

        if (reponse.stop_reason === "refusal") {
          throw new Error(`Refus du modèle (${reponse.stop_details?.category ?? "sans catégorie"})`);
        }
        if (!reponse.parsed_output) {
          throw new Error(`Réponse illisible (arrêt : ${reponse.stop_reason})`);
        }

        // Réponse renvoyée telle quelle au tour suivant (réflexion comprise), sans le champ ajouté par le SDK.
        messages.push({ role: "assistant", content: reponse.content.map(({ parsed_output, ...bloc }) => bloc) });

        const u = reponse.usage;
        const entree = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        cout.entree += entree;
        cout.sortie += u.output_tokens;
        if (prix) {
          const palier = prix.auDela && entree > prix.auDela.seuil ? { ...prix, ...prix.auDela } : prix;
          cout.dollars += (u.input_tokens * palier.entree + (u.cache_creation_input_tokens ?? 0) * palier.entree * 1.25
            + (u.cache_read_input_tokens ?? 0) * palier.entree * prix.cache + u.output_tokens * palier.sortie) / 1e6;
        }

        return reponse.parsed_output;
      };

      const analyses = [];
      for (const page of pages) {
        const analyse = await tour([
          { type: "image", source: { type: "base64", media_type: "image/png", data: page.png.toString("base64") } },
          { type: "text", text: `Page ${page.numero} sur ${pages.length}. Image de ${page.largeur} × ${page.hauteur} pixels.` },
        ], Page);
        analyses.push(analyse);
        parPage(page, analyse);
      }
      const document = await tour(SYNTHESE, Document);

      return { pages: analyses, document, cout };
    },
  };
}
