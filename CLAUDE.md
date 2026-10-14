# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The functional spec `cahier-des-charges.md` (in French, v1.1) is the source of truth. No app code yet; the only code is the form-analysis experiment in `experiences/reperage-champs/` (Node ESM, plain JS, see its README). The root `package.json` forwards its scripts, so they run from the repo root too:

- `npm run banc` — local web test bench on http://localhost:4410: upload a PDF/photo, pick model A (+ effort) and optionally model B (default "Aucun" = single-model test); two models run in parallel; then the results page opens
- `npm run reperer -- "<file>"` — same analysis from the CLI, exactly one document (Opus 5.5 by default, `--modeles` takes one or two)
- `npm run comparer [-- resultats/<run>]` — rebuild the comparison page and control PDFs for the latest or given run
- `npm run recaler [-- resultats/<run>]` — re-apply snapping to an existing run (free, no AI call) and rebuild its page

**Never launch paid analyses yourself (no batch over the corpus, no test runs): the user runs every test from the bench.** Batch sending was removed on purpose.

Claude models offered: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` (tiered price: $0.10/$0.50 per MTok up to 100k input tokens, $0.50/$2.50 above; pricing table in `src/detecteurs/claude.js`). OpenAI models were tried and placed fields poorly; they stay selectable.

Needs `ANTHROPIC_API_KEY` (and optionally `OPENAI_API_KEY`, which adds the account's OpenAI models to the bench) in `experiences/reperage-champs/.env` (gitignored), plus `pdftoppm` and `magick` on the system. Outputs go to `resultats/<run>/` (gitignored).

How the analysis works: one Claude conversation per document; one turn per page (page image only, structured output `Page` in `src/schema.js`: reading-order list of `information` and `champ` elements with ids like `p2-c5`); a final turn produces the simplified document (`Document`: summary, things to prepare, deadlines, sections mixing useful text and field ids). The simplified document is what the blind user will be shown; on save, each value is written back into its field's zone on the real PDF. A detector is `{ nom, analyserDocument(pages, parPage) }` in `src/detecteurs/` (Claude via `beta.messages.parse`, OpenAI via the Responses API with `previous_response_id`); prompts shared in `src/consignes.js`, provider chosen in `src/detecteurs/index.js`.

Development may start right away (the old "no development before P-01" lock was removed in v1.1). Milestones: J1 read & describe a document → J2 fill + verify + save (V1) → J3 signature. Each milestone must be useful on its own and tried by the user.

## What Bazookaform is

A **local web app that reads and edits PDFs, built for a blind user**: open an administrative form (native PDF, scan, or photo), have it described, fill it in through dialogue, sign it, and **save** it. Target: Safari on **macOS with VoiceOver**, installable as an app on macOS. Output is always a filled PDF plus a plain-text summary readable by a screen reader (F-34).

Guiding attitude: we start from nothing, and anything that helps the user is a win. The approach is **1. innovate, 2. secure, 3. fix**: try things, get them tested by the user, improve. Spec requirements are goals and priorities, not hard gates — none is non-negotiable. Prefer the simple solution that delivers value now over heavy requirements (no certified e-signature, no strict on-device-only processing, no blocking prerequisites).

## Decisions that shape the architecture

Requirement IDs (F-xx, NF-xx, C-xx, R-xx) come from the spec; cite them in code, commits and discussions.

- **Two processing paths (F-05).** (a) PDFs with built-in form fields (e.g. Cerfa): fill those fields directly, checkboxes included. (b) Flat or scanned documents: place text by page analysis. In V1, checkboxes on flat/scanned documents, character-by-character boxes, tables and attachments are not handled but **must be detected and reported** (§7.2, F-13).
- **Remote AI is allowed (NF-11)** to understand documents (e.g. a vision model such as Claude). The user must be told in plain language whenever a document leaves the machine.
- **Persistence is required.** Forms in progress (F-24) and the personal profile used for pre-filling (F-21) are stored. Saving writes a new file and keeps the original (F-32, NF-21).
- **Signature = paste a pre-recorded PNG (F-51)**, placed without pointing at the screen (F-50). No eIDAS / certified signature.
- **Verification (F-40–F-46).** After producing the document, check what can be checked (value present, legible, not overlapping printed content) and tell the user, value by value, what was written, where, and what was or wasn't verified. Uncertain cases go to the user (F-44). Checking that a value is in the *right* field (F-46) is desirable.
- **Try every document (F-04).** Return a usable result or explain what's blocking. If placement is unreliable, still produce the PDF along with the text summary (F-33).
- **Screen-reader first (NF-01–NF-04).** No information conveyed only by position, color or visuals. No step requires pointing at the screen. Waits are announced in a non-visual way (NF-31). Messages are written to be heard.
- **Stack: JavaScript running locally, remote AI called only when needed.** No server-side language for the user to install.
- **Snapping onto the PDF's dotted lines (`src/recalage.js`, on by default).** Vision models place zones a few characters off, which overwrites printed text on small blanks. For native PDFs, `pdftotext -bbox` gives exact boxes of dot runs (`……`, `…/…/……`, `____`, also glued to a short label like `à………`); each `texte` field takes the dot runs it overlaps on its line, the AI zone is kept in `zone_ia`. Scans/photos keep the AI zone. A date with printed slashes (`…/…/……`) stays one field (format JJ/MM/AAAA, one zone); when filling the PDF, split the value and write day/month/year into each dotted segment between the printed slashes (segment positions can be derived from the dot-run text, as `src/recalage.js` already estimates character widths).
- **Field detection is an experiment, not a settled design.** The AI defines each field's zone and writes a summary of the expected information (its label). Two strategies are to be tried and compared: (1) AI-only boxes, (2) AI boxes then algorithmic snapping onto lines/rectangles found on the page (the user doubts (2) is easy to debug). Several AI models are to be tried too, so detection strategy and model must be pluggable and their outputs comparable on the same documents.
- **Test corpus: `Formulaires PDF de test/`** (local only, gitignored; see its README). Root files were provided by the user — don't modify them. `cerfa/` holds official Cerfa downloads (AcroForm, XFA, flat); `degrades/` holds generated photo variants (simulated tilted scans were removed at the user's request).
- **Field format** (`src/schema.js`): page, x/y/l/h as page fractions from the top-left, libelle, type texte|multiligne|case|cases|image, marque croix|coche|puce|entoure|barre|raye (entoure/barre = circle/strike the chosen term, raye = strike the other options), groupe/choix_unique/obligatoire for choice questions, colonnes/lignes for letter-per-box grids. Filling should overlay text on the original pages, shrink the font to fit, lay out letter-per-box grids word by word, and phrase rules and grid occupancy for the screen reader (« un seul choix, obligatoire », « Tient sur 3 lignes sur 6 »).
- **Local-only, never committed (gitignored):** `Formulaires PDF de test/` (test forms, some are private documents).
- **Replaceable components (NF-42).** Keep OCR/vision, PDF filling, placement and verification behind clear boundaries so each can be swapped.
