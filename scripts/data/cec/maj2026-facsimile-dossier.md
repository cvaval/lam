# Fac-similé du Moniteur n° 54 (loi CEC 2002) — dossier d'attache (§ 7.3, question § 13.3 OUVERTE)

**Préparé le 27 août 2026. Rien n'a été attaché : la question § 13.3 appartient à Me Vaval.**
L'attache est prête dans `maj2026-attacher-facsimile.ts`, derrière un DOUBLE drapeau : sans
`--facsimile`, le script refuse même la simulation ; sans `--apply`, il n'écrit rien.

## 1. Les trois copies, vérifiées à l'octet le 27 août 2026

| Copie | Octets | md5 (fichier) | Détail |
|---|---|---|---|
| **`/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Loi sur les cooperatives Epargne et credit.pdf`** | **600 029** | **`0fef82932aca681a2137201e97010020`** | autonome, 15 pages — **le candidat retenu** |
| `…/Moniteur/Lois_18_20/2002.pdf` | 25 853 271 | `7e4e5b86daf88eaf3b644264c719f431` | volume annuel (658 p., fichier de 2009) ; n° 54 aux pages PDF 644-658 |
| `…/Moniteur/Patrick Tardieu/Moniteur 1915-x/2002.pdf` | 39 085 158 | `d990fe356a050977f2e7e7d786a53de6` | volume annuel (658 p., fichier de 2013) ; n° 54 aux pages PDF 644-658 |

**Comparaison à l'octet des planches** (flux d'image bruts embarqués, md5 par page) :

- PDF autonome pages 1-15 **≡ Tardieu pages 644-658, 15/15 pages identiques à l'octet**
  (mêmes flux d'image, md5 par flux) — le PDF autonome est une extraction de la
  numérisation Tardieu, celle que le relevé du 27 août créditait du meilleur OCR. Rien
  n'est perdu à choisir le fichier autonome.
- `Lois_18_20/2002.pdf` : **autre numérisation des mêmes planches** (rendu de la p. 6 à
  paramètres identiques : contenu concordant, octets différents). Même lacune.

Le candidat retenu est donc bien le PDF autonome (précédent : Décret IMF 2020, premier
fac-similé attaché de la plateforme) : mêmes planches que la meilleure copie, à l'octet,
600 Ko au lieu de 39 Mo, périmètre exact du fascicule.

## 2. La lacune, mesurée page à page

Correspondance pages PDF → pages imprimées, vérifiée sur les bandeaux (découpes dans
`maj2026-verif-chapitre-facsimile/entete2-auto-p12.png` et `entete2-auto-p14.png`) et sur la
couche texte (têtes d'article par page) :

| Pages PDF | Pages imprimées | Contenu (têtes d'article relevées sur la couche texte) |
|---|---|---|
| 1-11 | 1-11 | couverture + préambule + articles 1 à 44 |
| 12-13 | **14-15** | articles 55 à 64 |
| 14-15 | **31-32** | articles 147 à 151 + blocs de dates (Sénat 20 juin, Chambre 26 juin, promulgation 9 juillet 2002) |

**Manquent les pages imprimées 12-13 et 16 à 30 — 17 des 32 pages — dans les trois copies.**
Les têtes des articles 45 à 54 et 65 à 146 sont sur ces pages manquantes ; un article en
frontière de page (44, 64) peut être tronqué.

## 3. La mention de lacune — OBLIGATOIRE (§ 12.19), écrite par le script

Portée à l'appareil de la fiche (entrée `crossRefs` ancrée `sec-1`, le canal de la note de
provenance de l'IR 2005), en même temps que `sourcePdfUrl` :

> Le fac-similé du Journal officiel joint à cette fiche — Le Moniteur, 157ᵉ année, n° 54,
> mercredi 10 juillet 2002, numéro extraordinaire — est PARTIEL. La numérisation conservée
> (exemplaire au tampon de la Bibliothèque de l’Université Quisqueya) ne comporte que 15 des
> 32 pages du fascicule : les pages 1 à 11, 14, 15, 31 et 32 ; les pages 12, 13 et 16 à 30
> manquent. Les pages présentes portent le préambule, les articles 1 à 44 et 55 à 64 — un
> article en frontière de page pouvant y être tronqué —, les articles 147 à 151, ainsi que
> les dates du Sénat (20 juin 2002), de la Chambre des Députés (26 juin 2002) et de la
> promulgation (9 juillet 2002). Les articles 45 à 54 et 65 à 146 sont sur les pages
> manquantes : pour eux, cette pièce ne fait pas foi.

## 4. La mécanique (reprise du modèle `scripts/attacher-facsimile-ir-2005.ts`)

- store Vercel Blob PRIVÉ « lam-pdfs », chemin déterministe
  `source-pdf/legislation/cms8jhhz700004szrkm41yahg.pdf` (`allowOverwrite`, pas de suffixe) ;
- `BLOB_READ_WRITE_TOKEN` passé EXPLICITEMENT depuis `.env` (piège du jeton OIDC) ;
- lecture par la route authentifiée `/api/doc/[id]/pdf` (bouton « PDF source », visible
  sous `canSeeSourcePdf`) — l'URL Blob n'est jamais exposée ;
- le script assert l'empreinte du fichier (octets, md5, 15 pages, en-tête `%PDF`) avant de
  téléverser : un autre fichier sous le même nom est refusé ;
- état antérieur (`sourcePdfUrl`, `annotationsJson`, empreinte du corps) écrit dans un
  fichier horodaté de ce dossier AVANT la transaction ; audit `DOC_PUBLISHED` recompté
  après ; `reindexDocument` hors transaction.

## 5. Ce qui reste ouvert (§ 13.3, à trancher par Me Vaval)

1. **Attacher, ou pas ?** Le scan est authentique mais lacunaire ; la mention ci-dessus
   accompagne l'attache. (Le script n'exécute qu'avec `--facsimile`.)
2. **Quelle pièce ?** Le dossier retient le PDF autonome. `lois_cec.pdf` (37 p., couche
   texte, complet) n'est PAS retenu : le 27 août, sa page 6 s'est révélée en divergence
   avec le scan sur une page présente (« CHAPITRE II » là où les trois copies du scan
   impriment « CHAPITRE III », et un « est » manquant à l'article 18) — voir
   `maj2026-dossier-chapitre-titre2.md`. Ce n'est donc pas une numérisation du même tirage
   mais vraisemblablement une recomposition : l'attacher présenterait comme fac-similé une
   pièce qui ne reproduit pas le fascicule.
3. **Chercher un scan complet des pages 12-13 et 16-30 ?** Il arbitrerait les 77 écarts
   présumés pro-base, l'article 110 (« le non du représentant ») et confirmerait ou non le
   sic « article 146 » de l'article 144 — que seule `lois_cec.pdf` atteste aujourd'hui, et
   dont l'autorité vient d'être affaiblie.
