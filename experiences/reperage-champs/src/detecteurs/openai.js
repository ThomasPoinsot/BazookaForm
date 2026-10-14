import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { CONSIGNES, SYNTHESE } from "../consignes.js";
import { Document, Page } from "../schema.js";

/**
 * Analyse d'un document par un modèle OpenAI (API Responses), avec les mêmes consignes et le même
 * format que Claude : une conversation par document, une page par tour, puis le document simplifié.
 * L'historique est gardé par OpenAI (previous_response_id) ; les consignes sont renvoyées à chaque tour.
 * Le coût n'est pas calculé (pas de grille de prix ici) : seuls les jetons sont comptés.
 */
export function detecteurOpenAI({ modele, effort = "high" }) {
  const client = new OpenAI();

  return {
    nom: `${modele}-${effort}`,

    /**
     * @param {{numero: number, png: Buffer, largeur: number, hauteur: number}[]} pages
     * @param {(page: object, analyse: object) => void} parPage  appelé après chaque page
     */
    async analyserDocument(pages, parPage = () => {}) {
      const cout = { entree: 0, sortie: 0, dollars: null };
      let precedente = null;

      const tour = async (contenu, format, nom) => {
        const reponse = await client.responses.parse({
          model: modele,
          instructions: CONSIGNES,
          input: [{ role: "user", content: contenu }],
          previous_response_id: precedente,
          reasoning: { effort },
          text: { format: zodTextFormat(format, nom) },
          max_output_tokens: 40000,
        });

        if (reponse.status === "incomplete") {
          throw new Error(`Réponse incomplète (${reponse.incomplete_details?.reason ?? "raison inconnue"})`);
        }
        if (!reponse.output_parsed) {
          throw new Error("Réponse illisible ou refusée");
        }
        precedente = reponse.id;
        cout.entree += reponse.usage?.input_tokens ?? 0;
        cout.sortie += reponse.usage?.output_tokens ?? 0;

        return reponse.output_parsed;
      };

      const analyses = [];
      for (const page of pages) {
        const analyse = await tour([
          { type: "input_image", image_url: `data:image/png;base64,${page.png.toString("base64")}`, detail: "high" },
          { type: "input_text", text: `Page ${page.numero} sur ${pages.length}. Image de ${page.largeur} × ${page.hauteur} pixels.` },
        ], Page, "page");
        analyses.push(analyse);
        parPage(page, analyse);
      }
      const document = await tour([{ type: "input_text", text: SYNTHESE }], Document, "document");

      return { pages: analyses, document, cout };
    },
  };
}
