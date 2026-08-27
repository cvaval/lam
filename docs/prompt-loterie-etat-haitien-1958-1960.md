# Prompt — Verser la Loterie de l'État Haïtien : loi organique de 1958, sa réforme, l'arrêté de 1960

## Ce qui est demandé

Verser en **Législation annotée → Droit économique › Jeux de hasard et d'argent › Loterie de
l'État & casinos** les textes fondateurs que visent les trois décrets de 2026.

Neuf fichiers dans `~/Downloads/`. **Ils ne recouvrent pas ce qui était attendu — lire le §1
avant tout.**

---

## §1 — ⚠️ CE QUE LA LIVRAISON CONTIENT, ET CE QU'ELLE NE CONTIENT PAS

### Le décret du 20 octobre 1960 sur les CASINOS n'y est pas

Vérifié sur les trois transcriptions : **zéro occurrence du mot « casino »**, zéro mention
du 20 octobre 1960. Le texte de 1960 fourni est un autre acte — l'**Arrêté du 8 mars 1960
définissant le statut du Personnel de la L.E.H.**, publié au Moniteur n° 30 du 28 mars.

> ⚠️ Les trois décrets de 2026 visent **trois** textes antérieurs. Deux arrivent ici ; le
> troisième — « Décret du 20 octobre 1960 réservant exclusivement à l'État le droit
> d'établir et d'exploiter les casinos et autres maisons de jeux de grand luxe » — **reste à
> demander**. Ses neuf visas resteront du texte inerte tant qu'il manquera.

### La loi du 2 septembre 1958 n'a ni sommaire ni index

Les deux fichiers nommés pour le 4 septembre — `Sommaire_Decret_Balance_Communes_4_sept_1958`
et `Index_Mots_Cles_Decret_4_sept_1958` — portent sur le **Décret Balance disponible des
Communes**, l'autre texte du même fascicule, **étranger à la loterie**.

| Texte | Transcription | Sommaire | Index |
| --- | --- | --- | --- |
| Loi organique L.E.H. (1958) | ✔ n° 47 | ✔ | ✔ |
| **Loi du 2 sept. 1958 (réforme)** | ✔ n° 101 | ✗ | ✗ |
| Arrêté du 8 mars 1960 (personnel) | ✔ n° 30 | ✔ | ✔ |
| Décret Balance des Communes | ✔ n° 101 | ✔ | ✔ |

> ⚠️ **Le Décret Balance des Communes n'a rien à voir avec les jeux.** Il met à la
> disposition du Département de l'Intérieur la balance disponible des Communes. Son appareil
> est bien fait ; il relève d'une autre matière — Collectivités territoriales / Finances
> publiques. Ne pas le verser sous « Jeux de hasard » par commodité.

---

## §2 — ⚠️ TROIS ACTES PAR FASCICULE, ET LE FICHIER LES DONNE TOUS

Chaque `.docx` est la transcription du **fascicule entier**, pas du seul texte visé.

| Fascicule | Actes annoncés au sommaire | Le texte voulu |
| --- | --- | --- |
| n° 47 — 14 avril 1958 | **9** | Loi organique de la Loterie — **lignes 55 à 125** |
| n° 101 — 4 sept. 1958 | **8** | Loi modifiant la Loi organique — **lignes 42 à 93** |
| n° 30 — 28 mars 1960 | **4** | Arrêté statut du Personnel — 33 articles |

Le n° 47 contient aussi un arrêté sur le chômage du Jour Panaméricain, deux crédits
extraordinaires, une émission de timbres Sylvio Cator, trois commissions communales, un
procès-verbal de la Chambre de 1949 et un extrait du registre des marques. Le n° 101, un
lycée à l'Arcahaie, un Service des Pêcheries, deux mises à la retraite et deux émissions de
timbres.

> ⚠️ **L'ARTICLE 1er REVIENT À CHAQUE ACTE.** Le n° 47 compte **neuf séries** d'articles qui
> repartent de « Article 1er », le n° 101 **huit**. Un analyseur qui lit le fichier d'un bloc
> produira un texte de 55 articles où le 1er apparaît neuf fois. **La borne est le retour à
> l'article 1er**, pas la fin du fichier.

---

## §3 — ⚠️ LE TIRET CADRATIN : « Article 1er.— », ET NON « .- »

Ces textes de 1958-1960 écrivent leurs têtes d'article avec un **tiret cadratin** :

```
Article 1er.—  La Loterie, sous toutes ses formes, est une entreprise que seul l'État…
```

Les décrets de 2005, 2016 et 2026 écrivent `Article 1er.-` avec un trait d'union ordinaire.
**Un analyseur calé sur le trait d'union ne trouve ici AUCUN article** — mon premier relevé
en a compté zéro sur les trois fichiers, et c'est la seule raison.

L'expression doit accepter les deux, et le demi-cadratin par prudence :
`/^Article\s+(\d+(?:er)?)\s*\.\s*[—–-]/`

---

## §4 — Les trois textes, mesurés

| | Loi organique 1958 | Loi du 2 sept. 1958 | Arrêté 8 mars 1960 |
| --- | --- | --- | --- |
| **Articles** | **35** | **17** | **33** |
| Divisions | 6 CHAPITRE, sous TITRE I | aucune | aucune |
| Visas | 5 | 2 | à relever |
| Clause d'abrogation | art. 35 (balai) | art. 17 (balai) | art. 33 |

### Les dates : quatre pour un seul texte

La loi organique porte **quatre dates**, et chacune est citée quelque part :

| | |
| --- | --- |
| Votée à la Chambre des Députés | **12 mars 1958** |
| Votée au Sénat | **21 mars 1958** ← c'est la date que citent les décrets de 2026 |
| Sanctionnée | **24 mars 1958** |
| Publiée au Moniteur n° 47 | **14 avril 1958** ← c'est la date que cite la loi de septembre |

> ✅ **TRANCHÉ : LA DATE EST LE 24 MARS 1958.** Décision de la rédaction, 27 août — conforme
> à la règle du corpus : `adoptionDate` porte la **dernière entité d'adoption**, la sanction
> présidentielle quand elle existe, jamais la publication.
>
> | Champ | Valeur |
> | --- | --- |
> | Le texte s'appelle | **Loi du 24 mars 1958** portant organisation de la Loterie de l'État Haïtien |
> | `adoptionDate` | **1958-03-24** (sanction) |
> | `publicationDate` | 1958-04-14 (Moniteur n° 47) |
>
> ⚠️ **MAIS LES DEUX AUTRES GRAPHIES DOIVENT RESTER TROUVABLES.** Aucune des sources
> existantes n'emploie le 24 mars : les trois décrets de 2026 visent « la Loi organique du
> **21 mars 1958** » (vote au Sénat), et la loi de septembre 1958 dit **dix fois** « la loi
> du **14 Avril 1958** » (parution). Un lecteur venu de l'un ou de l'autre doit atteindre la
> fiche — porter les trois dates dans le corps, et prévoir que le rapprochement des visas
> de 2026 se fasse sur le TEXTE visé, non sur sa date.

---

## §5 — La réforme de septembre 1958, article par article

Relevé exhaustif de ses 17 articles : **douze touchent la loi organique**, cinq disposent
en propre.

### RÉÉCRIVENT un article nommé (10)

| Article de 1958-09 | Réécrit l'article… |
| --- | --- |
| 1er | **3** |
| 2 | **4** |
| 3 | **5** (premier alinéa seulement) |
| 4 | **6** |
| 5 | **8** (son 1°) seulement) |
| 6 | **14** |
| 7 | **15** |
| 9 | **19** |
| 10 | **24** |
| 11 | **28** |

### ABROGENT un article nommé (2)

| Article de 1958-09 | Abroge l'article… |
| --- | --- |
| 8 | **17** |
| 12 | **29** |

### Disposent en propre (5)

Articles **13 à 17** : contrats du Directeur Général, loteries sous contrôle d'une Section
de la L.E.H., contenu et durée des contrats (dix ans renouvelables), clause abrogatoire.

> ⚠️ **DEUX MODIFICATIONS SONT PARTIELLES**, et le distinguer change ce qui s'affiche :
> l'article 3 ne réécrit que le **premier alinéa** de l'article 5, et l'article 5 ne réécrit
> que le **1°** de l'article 8. Remplacer l'article entier ferait disparaître ce que la
> réforme n'a pas touché.

### C'est le cas d'école de la règle du corpus

La loi organique s'affiche donc **dans sa rédaction de septembre 1958** pour ses dix articles
réécrits ; l'ancienne rédaction se replie ; les articles 17 et 29 restent visibles, barrés et
datés. `ArticleVersion` porte les trois états — `EN_VIGUEUR`, `MODIFIE`, `ABROGE` —, et
`applyAmendments` fait le reste.

**Douze `ArticleVersion` à écrire**, sur les 35 articles de la loi organique.

---

## §6 — Ce qu'il faut écrire

| Champ | Loi organique | Loi de septembre | Arrêté 1960 |
| --- | --- | --- | --- |
| `source` | `LOI_LOTERIE_LEH_1958` | `LOI_LOTERIE_LEH_REFORME_1958` | `ARRETE_LEH_PERSONNEL_1960` |
| `adoptionDate` | **1958-03-24** (sanction) | 1958-09-02 (Sénat) | 1960-03-08 |
| `publicationDate` | 1958-04-14 | 1958-09-04 | 1960-03-28 |
| `moniteurRef` | Le Moniteur, 113ᵉ Année, n° 47, lundi 14 avril 1958 | …, n° 101, jeudi 4 septembre 1958 | …, 115ᵉ Année, n° 30, lundi 28 mars 1960 |
| `status` | `EN_VIGUEUR` | `EN_VIGUEUR` | `EN_VIGUEUR` |
| Thème | `jeux-loterie-casinos` | idem | idem |

⚠️ **`number` = LE TITRE COMPLET** (règle du 26 août). Sans quoi les deux lois de 1958 se
présenteraient toutes deux sous « Loi de 1958 ».

⚠️ **Le statut `EN_VIGUEUR` est à VÉRIFIER, non à supposer.** Les décrets de 2026 les visent
sans les abroger nommément — leur clause est un balai. Savoir si la loi organique de 1958
survit à la réforme de 2026 est une question de droit, pas de catalogage : **à trancher par
la rédaction**.

---

## §7 — Renvois croisés à poser

- Loi de septembre 1958 → loi organique : `MODIFIE` (10 articles), `ABROGE` (art. 17 et 29).
- Arrêté de 1960 → loi organique : `CITE` (il applique l'art. 34, qui annonce des
  « règlements généraux pris par Arrêté du Président »).
- Les trois → les décrets de 2026 : `CITE`, dans le sens 2026 → 1958/1960, par les visas.

⚠️ Le `kind` affirme quelque chose : `ABROGE` ne se pose que sur les articles 17 et 29.

---

## §8 — Contrôles avant de déclarer le travail fini

1. **35 + 17 + 33 articles**, chacun extrait de **son** acte — aucun article des huit autres
   textes du fascicule n'a suivi.
2. Aucun « Article 1er » en double dans un même texte (§2).
3. Les têtes au **tiret cadratin** sont toutes reconnues (§3).
4. **Douze `ArticleVersion`** sur la loi organique : 10 `MODIFIE`, 2 `ABROGE`.
5. Les **deux modifications partielles** (art. 5 al. 1ᵉʳ, art. 8 1°) ne remplacent pas
   l'article entier.
6. Les articles 17 et 29 sont **visibles et barrés**, non supprimés.
7. Les trois références portent le titre complet et sont distinctes.
8. La loi organique est datée du **24 mars 1958** (`adoptionDate`), et ses trois autres
   dates figurent au corps : « 21 mars » et « 14 avril » doivent la retrouver.
9. Le Décret Balance des Communes n'est **pas** classé sous les jeux (§1).
10. `npm test` vert, contrôle visuel fait.

---

## §9 — Ce que ce prompt ne tranche pas

1. **Le décret du 20 octobre 1960 sur les casinos** — à demander à l'archiviste (§1).
2. **Le sort du Décret Balance des Communes** — le verser ailleurs, ou le laisser ?
3. **Le statut de ces textes après 2026** — en vigueur, ou implicitement abrogés (§6) ?
4. **Le sommaire et l'index de la loi du 2 septembre 1958** — en commander, ou verser sans ?
