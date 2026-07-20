# Note de livraison — Décret réformant le Droit des Sûretés

**Date** : 20 juillet 2026 · **Référence** : Décret du 9 avril 2020 réformant le Droit des Sûretés, *Le Moniteur*, Spécial N° 7 du **14 mai 2020**.
**Source** : docx officiel du Moniteur (`Officiel_Decret_Reformant_le_Droit_des_Suretes_2020-04-09.docx`).
**Pièces** : parseur `scripts/data/decret-suretes/parse_ds.py` (+ `bodyOriginal.txt`, `annotations.json`) ; import `scripts/_import-decret-suretes.ts` ; application au Code civil `scripts/_apply-decret-suretes-cc.ts` ; sauvegarde intégrale pré-opération `scripts/data/decret-suretes/backup-before-suretes.json`.

## a) Le décret téléversé (« Législation annotée » → Droit privé → Obligations, biens & sûretés)

Document `DECRET_SURETES`, lecteur annoté complet : **sommaire** hiérarchique (DÉCRÈTE ; 3 TITRES ; 6 CHAPITRES ; 12 Sections — libellés verbatim, intitulés gras multi-lignes joints « — ») ; **104 ancres** (21 articles du décret + 83 articles cités in extenso) ; **index alphabétique** de 22 sujets (agent des sûretés, garantie autonome, lettre de confort, gage, nantissement de créance, réserve de propriété, antichrèse, Registre des Sûretés Mobilières…) ; **renvois inline** « article N » (anti-lien-mort). Préambule (20 visas, 4 considérants), signatures Moïse/Jouthe.

## b) Application au Code civil (TITRE PREMIER du décret)

| Opération | Nombre | Détail |
|---|---|---|
| **LOI Nº 28-1 créée** — « Sur les sûretés en général » | 2 chapitres, **10 articles nouveaux** | 1774-1 à 1774-3 (sûretés), 1774-4 à 1774-10 (agent des sûretés) — insérée entre les Lois 28 et 29 |
| **LOI 29 re-titrée** « Sur les sûretés personnelles » | 2 réécrits + **10 nouveaux** | chap. Ier « Sur le cautionnement » (les 4 anciens chapitres deviennent ses sections, intitulés conservés — art. 5) ; arts. **1780** et **1782** réécrits ; chap. II « Sur la garantie autonome » (**1809-1 à 1809-9**, avec ses 3 sections prescrites par l'art. 6) ; chap. III « Sur la lettre de confort » (**1809-10**) |
| **LOI 32 re-titrée** « Sur les sûretés mobilières » | 21 réécrits + **24 nouveaux** | **1838, 1839** et **1840-1858** réécrits ; **1849-1, 1849-2, 1851-1** intercalés ; chap. II « Du nantissement de meubles incorporels » (**1858-1 à 1858-12**) et chap. III « De la propriété retenue à titre de garantie » (**1858-13 à 1858-21**) ; l'ancien chapitre « De l'antichrèse » disparaît de la Loi 32 |
| **LOI 33 re-titrée** « Sur les privilèges et les sûretés immobilières » | **13 nouveaux** | **1859-1** (droit de rétention) ; sous-section « Du classement des privilèges » (**1869-1 à 1869-3**) ; chap. XI « De l'antichrèse » (**1970-1 à 1970-9**). Chapitres III à X (1881-1970) **inchangés** (art. 15) — les effets du Décret régimes matrimoniaux sur 1902…1962 sont **préservés** |

**Bilan Code civil : 23 articles réécrits (pastille « modifié », ancienne version + jurisprudence d'époque repliées) et 57 articles nouveaux (pastille « nouveau ») → le Code passe de 2 050 à 2 107 articles.** Chaque article porte une note connexe **cliquable vers le décret, à l'ancre de l'article cité homonyme**. Sommaire du Code : 342 → **353 en-têtes**. Index du Code : **+11 sujets** sûretés (1 481 → 1 492… mesuré 1 481 avant tri ; voir audit).

## c) Audit adversarial AVANT livraison (exigé) — 5 défauts trouvés, tous corrigés

Revue par 3 relecteurs indépendants + contestation adversariale de chaque constat (11 agents), après des contrôles mécaniques qui étaient **tous au vert** — l'audit a précisément trouvé ce que les contrôles ne pouvaient pas voir :

1. **[bloquant] 4 articles insérés tronqués** (1809-2, 1809-9, 1849-1, 1849-2 — 18 lignes normatives perdues, dont les 9 mentions « à peine de nullité » de la garantie autonome). Cause : règle d'extraction trop stricte (seuls « … » et 1) retenus ; items a)–i) et alinéas nus perdus) — et ma vérification de fidélité était **circulaire** (même extraction des deux côtés). Corrigé : règle « défaut-inclure jusqu'à borne structurelle » + **sentinelles indépendantes** ; l'item « i) L'impossibilité… » a d'ailleurs fait tomber une première version du correctif (discriminateur narration trop large) — preuve que les sentinelles mordent.
2. **[majeur] Sections du chapitre garantie autonome manquantes** (art. 6 : « De la nature / De la formation / Des effets de la garantie autonome ») — ajoutées (corps + sommaire).
3. **[majeur] Signatures du décret perdues** (« Le Président Jovenel MOÏSE », « Le Premier Ministre Joseph JOUTHE ») — piège docx : le `<w:tabs>` d'alignement faisait jeter les 2 paragraphes par le parseur. Corrigé (retrait du pPr avant extraction), décret ré-importé.
4. **[mineur] Vestige « DE L'ANTICHRÈSE »** (doublon hors-sommaire de l'édition source, resté entre 1855 et 1856) — retiré.
5. **[mineur] Vestige « DE L'EXTINCTION DU CAUTIONNEMENT »** (artefact préexistant entre 1794 et 1795, visible du lecteur) — retiré.

Procédure : **restauration complète depuis la sauvegarde puis ré-application en un seul passage propre** du script corrigé. Contre-vérification mécanique (non circulaire) : 6 sentinelles de contenu ✓, 3 sections ✓ (corps + sommaire), 0 vestige ✓, signatures ✓, segmentation **353/353**, **2 107 ancres**, 0 orphelin, 0 renvoi d'index mort, pastilles exactes (modifié 136 · nouveau 60 · abrogé 68 · partiellement abrogé 10), rendu de 1809-2 avec ses 9 mentions ✓. Contre-audit adversarial final : voir résultat en annexe du commit.

## d) Réserves et suites

1. **TITRE II (Code de commerce)** : arts. **1611-1** (remplace l'art. 91), **1611-2** (remplace 93-95), **92 abrogé**, **600 al. 3-5 réécrits** — le Code de commerce n'est pas encore sur la plateforme ; ces amendements seront portés lors de son intégration (annoncée — il ira dans Droit économique & des affaires → Commerce & industrie).
2. **TITRE III** : art. 20 — la **Loi du 27 novembre 2008 sur le gage sans dépossession est abrogée** ; ce texte n'est pas sur la plateforme (rien à faire ; à marquer si un jour il y entre).
3. Anomalie de source préservée : art. 4 du décret dit que le chap. Ier de la Loi 29 « comprend les articles **1776** à 1809 » alors que l'art. 5 fait commencer la section Ière à **1775** — sans effet (1775 inchangé dans les deux lectures).
4. Style : les intitulés prescrits en casse mixte par le décret sont portés au style des en-têtes du Code (« SECTION PREMIÈRE — De la nature… ») ; la sous-section « Du classement des privilèges » est numérotée « III — » au style de ses sœurs (« 1er — », « II — »).

*Rappel du disclaimer Lam : reproduction fidèle, non officielle ; en cas de divergence, la version publiée au Moniteur prévaut.*
