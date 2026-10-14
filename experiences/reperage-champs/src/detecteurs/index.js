import OpenAI from "openai";
import { detecteurClaude } from "./claude.js";
import { detecteurOpenAI } from "./openai.js";

export const MODELES_CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

/** Détecteur selon le fournisseur du modèle. */
export function creerDetecteur({ modele, effort }) {
  return modele.startsWith("claude-") ? detecteurClaude({ modele, effort }) : detecteurOpenAI({ modele, effort });
}

/**
 * Modèles OpenAI proposés : ceux du compte qui lisent les images et suivent un format JSON
 * (familles gpt-5 et suivantes, o3, o4), sans les versions datées ni spécialisées. Vide sans clé.
 */
export async function modelesOpenAI() {
  if (!process.env.OPENAI_API_KEY) return [];
  const ids = [];
  for await (const m of new OpenAI().models.list()) ids.push(m.id);

  return ids
    .filter((id) => /^(gpt-[5-9]|o3|o4)/.test(id) && !/audio|realtime|tts|transcribe|search|image|codex|cyber|chat-latest|-pro|\d{4}-\d\d-\d\d/.test(id))
    .sort();
}
