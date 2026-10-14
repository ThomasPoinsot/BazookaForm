# Cahier des charges fonctionnel

**Projet :** outil de remplissage et de signature autonome de formulaires administratifs pour utilisateur aveugle
**Nom de travail :** Bazookaform
**Version :** 1.1 — décisions de cadrage

---

## 0. En résumé

Bazookaform est une **application web de lecture et d'édition de PDF conçue pour une personne aveugle**. Elle permet d'ouvrir un formulaire, de se le faire décrire, de le remplir par dialogue, de le signer et de l'**enregistrer**. Elle s'utilise dans Safari sur macOS avec VoiceOver et peut s'installer comme une application.

État d'esprit : on part de rien. Tout ce que l'outil apporte à l'utilisateur est un gain. On privilégie la solution simple qui rend service tout de suite, plutôt qu'une exigence lourde qui retarde le projet.

Démarche : **1. on innove, 2. on sécurise, 3. on corrige.** On essaie, on fait tester, on améliore. Les exigences de ce document sont des objectifs et des priorités, pas des conditions bloquantes : aucune n'est non négociable.

---

## 1. Contexte et justification

### 1.1 Situation

Une personne aveugle, autonome dans son usage informatique quotidien avec un lecteur d'écran, ne peut pas remplir ni signer seule un formulaire administratif reçu sous forme de document électronique. Elle doit systématiquement recourir à un tiers voyant.

Cette dépendance porte sur des domaines sensibles : fiscalité, santé, banque, état civil, emploi, logement. Elle suppose de confier à un tiers des informations personnelles, de s'aligner sur sa disponibilité, et de renoncer à la confidentialité de ses démarches.

### 1.2 Origine du blocage

Les documents administratifs sont très majoritairement conçus pour un usage visuel. Les zones à renseigner n'ont pas d'existence logique : elles ne sont ni annoncées, ni atteignables au clavier, ni associées à leur libellé. Lorsqu'un outil permet d'écrire sur le document, il demande de désigner l'emplacement à la souris — ce qui est inaccessible par nature.

### 1.3 Pourquoi un outil côté usager

L'accessibilité native des démarches administratives reste très largement en défaut malgré les obligations légales et les engagements publics. Attendre la mise en conformité des émetteurs n'est pas une stratégie exploitable à l'échelle d'un utilisateur. L'outil visé agit en aval, sur le document tel qu'il est reçu.

---

## 2. Utilisateur cible

**Utilisateur principal :** personne aveugle, utilisatrice confirmée d'un lecteur d'écran (VoiceOver sur macOS), autonome sur ses outils numériques quotidiens, sans compétence de développement requise.

**Utilisateurs secondaires envisagés :** personnes malvoyantes, personnes en situation de handicap moteur empêchant l'écriture manuscrite, et plus largement toute personne confrontée à des documents mal conçus.

**Non visé :** l'émetteur du document. L'outil ne cherche pas à corriger les formulaires à la source.

---

## 3. Objectif

Permettre à l'utilisateur de **recevoir un formulaire administratif, le comprendre, le renseigner, le signer et l'enregistrer, seul et sans assistance d'un tiers**.

### 3.1 Critère de réussite

> L'information demandée figure lisiblement sur le document, à un emplacement correct, sans masquer d'élément imprimé — **et l'utilisateur sait précisément ce qui a été inscrit et où**.

### 3.2 Niveau d'exigence de référence

Le document produit doit être équivalent à ce qu'obtient une personne voyante remplissant le même document avec les outils courants : emplacements approximatifs mais corrects, mise en forme irrégulière, lisibilité assurée. La perfection typographique n'est pas un objectif.

### 3.3 Principe directeur

L'outil cherche à tenir l'utilisateur informé de l'état réel du document. Quand il a un doute, il le dit.

---

## 4. Exigences fonctionnelles

### 4.1 Prise en charge des documents

| Réf. | Exigence | Priorité |
|---|---|---|
| F-01 | Accepter les formats de document administratif courants, y compris documents électroniques natifs, documents numérisés et photographies de documents | Prioritaire |
| F-02 | Traiter des documents de qualité dégradée : numérisation ancienne, document penché, contraste faible, bruit, photographie prise à main levée | Prioritaire |
| F-03 | Traiter des documents multipages dont les pages peuvent être de natures différentes | Prioritaire |
| F-04 | Tenter de traiter tout document soumis : produire un résultat exploitable, ou expliquer ce qui bloque | Prioritaire |
| F-05 | Distinguer deux voies de traitement : **(a)** PDF comportant des champs de formulaire intégrés, remplis directement dans ces champs ; **(b)** document « plat » ou numérisé, sur lequel les informations sont placées par analyse de la page | Prioritaire |

### 4.2 Compréhension du document

| Réf. | Exigence | Priorité |
|---|---|---|
| F-10 | Décrire à l'utilisateur la nature du document et ce qu'il demande, avant toute saisie | Prioritaire |
| F-11 | Énumérer les informations à fournir dans un ordre logique de lecture | Prioritaire |
| F-12 | Signaler les informations obligatoires et, lorsque c'est déterminable, le format attendu | Souhaitable |
| F-13 | Signaler explicitement les éléments identifiés mais non traités par l'outil | Prioritaire |

### 4.3 Saisie

| Réf. | Exigence | Priorité |
|---|---|---|
| F-20 | Permettre la saisie de chaque information par dialogue, sans manipulation de l'emplacement | Prioritaire |
| F-21 | Pré-renseigner les informations récurrentes à partir d'un profil personnel constitué par l'utilisateur | Prioritaire |
| F-22 | Permettre la correction d'une information déjà saisie avant production du document | Prioritaire |
| F-23 | Regrouper les demandes de précision plutôt que de les poser une par une | Souhaitable |
| F-24 | Enregistrer un formulaire commencé et permettre de le reprendre plus tard sans tout ressaisir | Prioritaire |

### 4.4 Production du document

| Réf. | Exigence | Priorité |
|---|---|---|
| F-30 | Produire un document conforme aux usages administratifs, acceptable par l'organisme destinataire | Prioritaire |
| F-31 | Éviter de masquer ou de dégrader un élément préexistant du document | Prioritaire |
| F-32 | Conserver le document original intact | Prioritaire |
| F-33 | Lorsqu'une information ne peut être placée de façon fiable, produire néanmoins un document exploitable accompagné d'un récapitulatif lisible des informations fournies | Prioritaire |
| F-34 | Produire systématiquement un PDF rempli (y compris à partir d'une photographie), accompagné d'un récapitulatif texte restituable par lecteur d'écran | Prioritaire |

### 4.5 Vérification

| Réf. | Exigence | Priorité |
|---|---|---|
| F-40 | Vérifier, après production, que chaque information inscrite est effectivement présente et lisible sur le document | Prioritaire |
| F-41 | Détecter tout recouvrement d'un élément imprimé par une information ajoutée | Prioritaire |
| F-42 | Restituer à l'utilisateur un compte rendu de ce qui a été inscrit, information par information, et de son emplacement | Prioritaire |
| F-43 | Distinguer clairement les informations vérifiées de celles dont le placement reste incertain | Prioritaire |
| F-44 | Solliciter l'arbitrage de l'utilisateur sur les cas incertains, en langage naturel | Prioritaire |
| F-45 | Indiquer à l'utilisateur ce qui a été vérifié et ce qui ne l'a pas été | Prioritaire |
| F-46 | Vérifier que chaque information est placée dans le bon champ, c'est-à-dire associée au bon libellé | Souhaitable |

### 4.6 Signature

| Réf. | Exigence | Priorité |
|---|---|---|
| F-50 | Permettre de signer un document sans désignation visuelle d'emplacement | Prioritaire |
| F-51 | La signature consiste à apposer une image de signature (PNG) préenregistrée par l'utilisateur. Aucune signature électronique certifiée n'est visée | Prioritaire |

### 4.7 Mise en service et maintien en condition

| Réf. | Exigence | Priorité |
|---|---|---|
| F-60 | Permettre l'installation complète par l'utilisateur lui-même, sans assistance visuelle | Prioritaire |
| F-61 | Permettre la mise à jour et la réinstallation dans les mêmes conditions | Prioritaire |
| F-62 | Fournir un diagnostic énonçant en clair ce qui manque ou dysfonctionne, et la marche à suivre | Prioritaire |
| F-63 | Fonctionner de façon identique après changement de machine | Souhaitable |

---

## 5. Exigences non fonctionnelles

### 5.1 Accessibilité

| Réf. | Exigence |
|---|---|
| NF-01 | Toute sortie de l'outil doit être intégralement restituable par un lecteur d'écran, sans élément de mise en forme interférant avec la vocalisation |
| NF-02 | Aucune information ne doit être portée exclusivement par un élément visuel, une position ou une couleur |
| NF-03 | Aucune étape du parcours utilisateur ne doit nécessiter de désigner un point à l'écran |
| NF-04 | Les messages doivent être rédigés pour être entendus, non pour être lus en diagonale |

### 5.2 Confidentialité

| Réf. | Exigence |
|---|---|
| NF-10 | Les documents traités contiennent des données personnelles sensibles : leur traitement ne doit pas exposer l'utilisateur à une divulgation au-delà de ce qui est annoncé |
| NF-11 | L'analyse des documents peut faire appel à un modèle d'IA distant. L'utilisateur est informé, en clair, lorsqu'un document quitte sa machine |
| NF-12 | Les formulaires commencés et le profil personnel sont conservés afin de permettre la reprise (F-24) et le pré-remplissage (F-21). Aucune donnée n'est réutilisée à d'autres fins |

### 5.3 Sécurité

| Réf. | Exigence |
|---|---|
| NF-20 | L'outil ne doit pouvoir agir que sur les documents que l'utilisateur lui soumet |
| NF-21 | L'enregistrement crée un nouveau fichier ; l'original est conservé |
| NF-22 | Les actions irréversibles demandent une confirmation |

### 5.4 Performance perçue

| Réf. | Exigence |
|---|---|
| NF-30 | Le temps de traitement doit rester compatible avec une démarche administrative courante |
| NF-31 | L'attente doit être annoncée et son avancement perceptible autrement que visuellement |
| NF-32 | Le nombre d'allers-retours demandés à l'utilisateur doit rester proportionné au nombre d'informations à fournir |

### 5.5 Pérennité

| Réf. | Exigence |
|---|---|
| NF-40 | L'outil ne doit pas dépendre du maintien en activité d'une seule personne |
| NF-41 | Le code et la documentation doivent permettre une reprise par un tiers |
| NF-42 | Les choix d'implémentation doivent pouvoir être remplacés sans refonte de l'ensemble |

---

## 6. Contraintes

| Réf. | Contrainte |
|---|---|
| C-01 | L'outil s'intègre dans l'environnement de travail existant de l'utilisateur : **macOS avec VoiceOver**, sans imposer un changement d'équipement |
| C-02 | L'outil ne modifie pas le document original et ne dépend d'aucune action de l'émetteur |
| C-03 | Le document produit vise à être accepté par les administrations destinataires |
| C-04 | Le coût d'usage doit rester supportable pour un particulier |
| C-05 | L'outil doit rester utilisable si l'utilisateur change de matériel ou de version de système |
| C-06 | L'outil est une **application web locale**, utilisable dans Safari et installable sur macOS comme une application |

---

## 7. Périmètre

### 7.1 Inclus en version 1

- Champs de texte libre, sur les deux voies (F-05)
- Cases à cocher et choix multiples, sur la voie des PDF à champs intégrés
- Documents natifs comme documents numérisés
- Signature par image préenregistrée
- Constitution et réutilisation d'un profil d'informations personnelles
- Enregistrement et reprise d'un formulaire commencé
- Compte rendu de vérification

### 7.2 Exclu de la version 1, mais devant être signalé

Les éléments suivants ne sont pas traités en version 1. L'outil doit néanmoins **détecter leur présence et en informer l'utilisateur**, afin qu'il ne retourne pas un document incomplet sans le savoir :

- Cases à cocher et choix multiples sur les documents plats ou numérisés
- Zones de saisie caractère par caractère
- Tableaux à remplir
- Documents nécessitant l'ajout de pièces jointes

### 7.3 Hors périmètre

- La correction du document à la source
- La transmission du document à l'organisme destinataire
- Le conseil sur le contenu à déclarer
- La gestion documentaire et l'archivage
- La signature électronique certifiée

---

## 8. Objectifs de la version 1

Ce que l'on cherche à atteindre, mesuré en essayant l'outil sur des documents réellement reçus par l'utilisateur. Ce sont des repères pour s'améliorer, pas des conditions de validation :

| Réf. | Critère |
|---|---|
| R-01 | L'utilisateur mène la totalité du parcours seul, sans assistance visuelle |
| R-02 | Aucune information renseignée n'est absente, tronquée ou illisible sur le document produit |
| R-03 | Aucun élément imprimé du document n'est masqué |
| R-04 | Toute incertitude de placement a été signalée à l'utilisateur avant production |
| R-05 | Aucun document n'a été déclaré complet alors qu'il ne l'était pas |
| R-06 | Les documents produits ont été acceptés par les organismes destinataires |
| R-07 | L'utilisateur a installé et mis à jour l'outil sans assistance |

---

## 9. Hypothèses à vérifier en cours de route

Ces hypothèses ne bloquent pas le développement. Elles sont vérifiées en faisant essayer l'outil à l'utilisateur au fil des versions.

| Réf. | Hypothèse | Conséquence si non vérifiée |
|---|---|---|
| P-01 | L'utilisateur adhère durablement à un mode d'interaction entièrement non visuel et y revient spontanément après une première période d'usage | Réexamen du mode d'interaction |
| P-02 | Les documents réellement reçus par l'utilisateur sont majoritairement traitables | Révision du périmètre |
| P-03 | La part de documents récurrents dans ses démarches est connue | Détermine le niveau d'automatisation atteignable |

---

## 10. Jalons

| Jalon | Contenu | Sortie attendue |
|---|---|---|
| J1 | Lecture et description de document | Fonction utile en l'état, sans risque |
| J2 | Remplissage avec vérification et enregistrement | Version 1 soumise à recette |
| J3 | Signature | Parcours complet |

Chaque jalon doit apporter un bénéfice immédiat à l'utilisateur, indépendamment de la suite, et lui être soumis à l'essai.

---

## 11. Risques identifiés

| Risque | Effet | Traitement |
|---|---|---|
| Résultat erroné non détecté | Démarche administrative compromise, perte de confiance définitive | Vérification systématique et signalement de toute incertitude |
| Rejet du mode d'interaction par l'utilisateur | Outil jamais utilisé | Essais par l'utilisateur à chaque jalon |
| Dépendance à un mainteneur unique | Outil inutilisable à la première évolution du système | Ouverture du code, documentation, diffusion |
| Mise en service inaccessible | Autonomie remplacée par une autre dépendance | Exigences F-60 à F-63 |
| Couverture insuffisante des documents réels | Outil partiellement utile, recours au tiers maintenu | Essais sur documents réels à chaque jalon |
| Évolution des fonctions d'accessibilité natives des équipements | Recouvrement partiel du besoin, projet en partie redondant | Réexamen du périmètre avant chaque jalon |

---

## 12. Bénéficiaires au-delà de l'utilisateur initial

Le besoin n'est pas individuel. Il concerne l'ensemble des personnes déficientes visuelles confrontées aux démarches administratives, dans un contexte où l'accessibilité native reste très largement défaillante.

Le projet doit donc être conçu dès l'origine pour être diffusable : documenté, ouvert, et validé auprès d'utilisateurs autres que l'utilisateur initial. Les enseignements du domaine convergent sur un point — les outils conçus sans association réelle des personnes concernées échouent.
