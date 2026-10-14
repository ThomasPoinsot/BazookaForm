# Expérience : analyse des formulaires par l'IA

Chaque document est montré à l'IA page par page, dans une même conversation. Pour chaque page, elle rend
dans l'ordre de lecture les **informations** utiles (reformulées pour être entendues) et les **champs** à remplir
(libellé, type, zone, marque…, voir `src/schema.js`), avec un identifiant (`p2-c5`). Une fois toutes les pages vues,
elle rédige le **document simplifié** : résumé, ce qu'il faut préparer, échéances, puis le formulaire réorganisé
en sections où le texte utile et les champs (cités par identifiant) alternent. C'est ce document qui sera présenté
à l'utilisateur ; à l'enregistrement, chaque valeur est réécrite dans la zone de son champ sur le vrai PDF.

## Banc d'essai dans le navigateur

1. Mettre les clés dans `.env` (copie de `.env.example`) : `ANTHROPIC_API_KEY=…`, et `OPENAI_API_KEY=…` pour proposer aussi les modèles OpenAI du compte
2. `npm install`
3. `npm run banc` (aussi depuis la racine du projet), puis ouvrir http://localhost:4410
4. Déposer un PDF ou une photo, choisir le modèle A et son effort, et si on veut comparer, un modèle B
   (« Aucun » par défaut : test sur un seul modèle), puis « Analyser ». Avec deux modèles, ils tournent en même temps ;
   l'avancement s'affiche, puis la page de résultats s'ouvre.

Modèles Claude proposés : Opus 5.5, Sonnet 5.5, Haiku 5.5 (le moins cher, environ 40 fois moins qu'Opus).

Le serveur n'écoute que sur la machine locale. Prérequis système : `pdftoppm` (poppler) et `magick` (ImageMagick).

## Recalage sur les pointillés du PDF

L'IA place les zones à quelques caractères près : sur les petits blancs (« …/…/…… », « + ….. personnes »), ça suffit
à écrire sur le texte imprimé. Pour un PDF natif, la couche texte donne la position exacte de chaque série de
pointillés (`pdftotext -bbox`) : chaque champ « texte » prend la place des pointillés qu'il recouvre sur sa ligne
(`src/recalage.js`). Sans couche texte (scan, photo) ou sans pointillés sous la zone, la zone de l'IA est gardée.

- Case « Recaler les champs sur les pointillés du PDF » dans le banc (cochée par défaut) ;
- dans les résultats : nombre de champs recalés par page, survol « recalé sur les pointillés »,
  case « Zones de l'IA avant recalage » pour voir la zone d'origine (gardée dans `zone_ia`) ;
- `npm run recaler -- [resultats/<lancement>]` : applique le recalage à un lancement déjà fait, sans rappeler l'IA (gratuit).

## En ligne de commande

- `npm run reperer -- "<fichier>"` : un seul document, Opus 5.5 en effort high. Pas d'envoi par lot : un fichier, et un seul, est exigé.
- options : `--modeles claude-opus-5-5,claude-haiku-5-5` (un ou deux), `--effort low|medium|high|xhigh|max`
- `npm run comparer -- [resultats/<lancement>]` : régénère la page de comparaison (par défaut le dernier lancement)

## Résultats

`resultats/<lancement>/` (non versionné) :
- `<modele>-<effort>/<document>/page-N.json` : description, éléments (positions en fractions de page), éléments non traités ;
- `page-N.png` : éléments numérotés dans l'ordre de lecture ; rouge texte, orange multiligne, bleu case,
  violet cases lettre par lettre, vert foncé image, gris information ; référence AcroForm en vert pointillé ;
- `document.json` : le document simplifié ;
- `rapport.md` : par document et par modèle, champs, informations, part de la référence retrouvée, coût, durée ;
- `comparaison/index.html` :
  - document simplifié de chaque modèle, tel qu'il serait présenté, avec les champs oubliés signalés ;
  - chaque page avec les deux modèles côte à côte : en rose les champs vus par un seul modèle, en orange ceux
    dont le type ou la marque diffère, en gris les informations, en vert la référence (plein si non trouvée) ;
  - survol : libellé ; clic : champ correspondant chez l'autre modèle ;
  - liens vers les **PDF de contrôle** : le vrai PDF, zones replacées dessus, libellé écrit à la place de la valeur.

## Ajouter un modèle ou une stratégie

Un détecteur est un objet `{ nom, analyserDocument(pages, parPage) }` qui rend `{ pages, document, cout }`
(voir `src/detecteurs/claude.js`, `src/detecteurs/openai.js`, `src/schema.js`). Les consignes, communes à tous les modèles,
sont dans `src/consignes.js` ; `src/detecteurs/index.js` choisit le fournisseur d'après le nom du modèle.
Pour OpenAI, le coût n'est pas calculé (pas de grille de prix) : le rapport donne les jetons.
