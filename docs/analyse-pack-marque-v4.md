# Pack de marque Klinik — dossier v4, analyse

`Logo/Logo Aug 2026_v4/` — **dossier de référence du branding à compter du 16 août 2026.**
Il remplace `Logo Aug 2026/` (v3) et `Logo Aug 2026_v2/`.

---

## 1. Ce que le dossier contient de nouveau

Le pack lui-même est le même qu'en v3 — `Officiel_Lam_Pack-Marque_Klinik_v3-0`, charte gelée
`LAM-BRAND-2026-08-V3`. Trois choses s'y ajoutent :

| | |
|---|---|
| `05_Avenants/AV-02_Inversion-Accents.md` | **L'inversion des deux accents**, datée du 11 août |
| `05_Avenants/AV-02bis_Trait-Wouj-Confirme.md` | **Rectificatif** : le logotype garde son trait Wouj |
| `06_Prototypes/…_Prototype-Accueil_v4_Carte-Juridictionnelle.html` | Le **prototype d'accueil v4**, 383 lignes |

Les deux avenants portent la date du **11 août 2026** : ils existaient depuis le gel de la charte
et n'avaient pas été transmis. La doctrine appliquée au code depuis cette date était donc
l'ancienne.

## 2. AV-02 — l'inversion des accents

> **Sitwon #FDD228** devient le **trait du certificateur** : statut « Abrogé » (pastille fond
> Sitwon, texte Chabon — 7,08:1), alerte de certification. Rationné à une occurrence d'interface
> par écran. **Jamais fond de page, jamais couleur de texte.**
>
> **Wouj #D21034** devient la **couleur de l'usage** : CTA principal (fond Wouj, **texte Blan** —
> 5,43:1), badge « Dokiman verifye », surlignage du terme exact, soulignement de navigation
> active.

**Wouj Pal `#FCE1E4`** est créé et **remplace Sitwon Pal `#FFF3C6`** : surlignage étendu et fonds
de sélection, texte Ank (8,41:1, AAA).

Le couple à luminance quasi identique (1,05:1) devient **usage / succès** — Wouj et Vèt. Le
libellé textuel demeure un **critère bloquant** sur tout état.

### AV-02bis — le logotype garde son trait Wouj

L'article 3 de l'AV-02 faisait passer le trait diagonal du logotype en Sitwon (suite L5). Le
rectificatif l'annule : la suite **L4 est définitive**, trait Wouj.

L'articulation est explicite et lève la réserve que je soulevais le 16 août — le trait Wouj du
logotype est le **sceau historique du certificateur**, hors décompte, et le logotype ne porte pas
Sitwon. Dans l'interface, en revanche, le certificateur s'exprime en Sitwon.

## 3. Écart entre le pack et la plateforme

**Un seul jeton diffère.** Les douze valeurs du pack ont été comparées à
`src/lib/brand-colors.ts` :

| | Pack v4 | Installé |
|---|---|---|
| dérivé pâle | `wouj-pal` **#FCE1E4** | `sitwonPal` **#FFF3C6** |

Tout le reste est identique. La plateforme porte trois jetons de plus, qui lui sont propres et
que le pack ne connaît pas : `ble #00209F` (Cour de cassation), `inverse #EDEDEB`,
`badgeBorder #C7C6C1`.

⚠️ Bonne nouvelle pour la bascule : **`sitwon-pal` n'est employé nulle part** dans le code. Le
remplacement est un simple renommage de jeton, sans un seul usage à migrer.

**Les logotypes installés sont déjà les bons.** Les neuf SVG de `public/brand/` portent tous le
trait Wouj `#D21034` et **aucun** ne porte Sitwon ; les trois principaux sont **identiques octet
pour octet** à ceux du pack v4. L'AV-02bis a rétabli ce qui était déjà en place : rien à
réinstaller.

## 4. Le prototype d'accueil v4

**Il applique déjà l'AV-02, à la lettre.** Onze emplois de Wouj, tous d'usage : soulignement de
navigation active, `<mark>` du titre (fond Wouj, texte blanc), bouton de recherche, bouton d'appel
à l'action du panneau, pastille « nouveau », badge « vérifié », terme surligné dans le texte lu.
Deux emplois de Sitwon, tous deux de certification. Deux emplois de Wouj Pal : survol de marqueur
et encadré de résumé. **Vèt : zéro emploi.**

### Le modèle chromatique de sa carte — il diffère du nôtre

| Degré | Remplissage | Contour | Sélection |
|---|---|---|---|
| Première instance | **Blan** | Chabon 2,5 px | fond **Wouj** ; survol **Wouj Pal** |
| Cour d'appel | **Chabon** | — | fond **Wouj** |
| Cassation | **Chabon** | **Sitwon 3 px** | — |

Deux partis s'en dégagent, tous deux différents de ce que fait la plateforme :

1. **Aucun codage chromatique par degré.** Le type se lit à la forme et à la valeur — du blanc au
   Chabon, du plus commun au plus élevé. La couleur est réservée à l'**état** : Wouj quand c'est
   sélectionné, Wouj Pal au survol. C'est exactement le principe typographique de la v3.0,
   transposé à la carte.
2. **Sitwon marque la seule Cour de cassation** — la juridiction qui certifie. L'accent du
   certificateur va au sommet, pas à la base.
3. **Les tribunaux de paix ne figurent pas.** La légende n'a que trois entrées. Le prototype
   règle la surcharge en ne montrant pas les 185 points à ce niveau de zoom.

### ⚠️ Conséquence pour le changement du 16 août

La rotation appliquée ce jour — tribunaux de paix en Sitwon, cours d'appel en Wouj — atteint bien
l'objectif : les 185 points s'effacent, les 5 cours d'appel ressortent. Mais elle **contredit le
prototype sur lequel le front-end va être bâti**, et sur deux points de doctrine :

- elle dépense l'accent du **certificateur** sur les 185 juridictions les plus nombreuses et les
  moins élevées, alors que l'AV-02 le rationne à une occurrence par écran ;
- elle emploie Wouj pour marquer un **type**, alors que le prototype le réserve à l'**état
  sélectionné** — les deux se confondraient sur la carte.

Le parti du prototype atteint le même but — une carte moins chargée — en supprimant le codage par
couleur plutôt qu'en le redistribuant. **À trancher.** La rotation est en place et se défait en
une ligne.

## 5. Ce que le prototype introduit hors jetons

Quatre gris qui ne sont dans aucun fichier de jetons :

| Valeur | Emploi dans le prototype |
|---|---|
| `#8A8B8E` | libellés mono de faible emphase, pieds de carte |
| `#B9BABC` | clés de panneau, indications, texte de pied de page |
| `#EDF1F1` | texte sur le panneau sombre Adwaz |
| `#D5DBDC` | paragraphe secondaire sur fond sombre |

Ce sont des gris de **hiérarchie basse** et de **texte sur fond sombre**. La plateforme n'a que
`grafit #55565A` et `inverse #EDEDEB` pour cet office. Il faut soit les faire entrer au jeu de
jetons par avenant, soit les ramener aux deux existants — c'est une question à poser au
concepteur avant le build, faute de quoi ils entreront dans le code comme des valeurs en dur.

## 6. Conséquences sur la série d'avenants

**Collision de numérotation, corrigée.** J'avais rédigé le 16 août un avenant AV-02 sur les
icônes ; le numéro était pris depuis le 11. La série est rectifiée :

| Réf. | Objet | Auteur | Statut |
|---|---|---|---|
| AV-01 | Huit types (IDX, TAR) | Cabinet Salès | en vigueur — *ma copie a été supprimée, l'originale du pack fait foi* |
| AV-02 | Inversion des accents | Cabinet Salès | en vigueur |
| AV-02bis | Trait Wouj du logotype confirmé | Cabinet Salès | en vigueur |
| **AV-03** | **Bibliothèque d'icônes** | moi | validé — *renuméroté* |
| **AV-04** | **Quota des accents** | moi | ⚠️ **à reprendre** |

**AV-04 doit être réécrit.** Il a été rédigé sous le récit d'origine. Les mesures restent bonnes —
223 occurrences, 47 fichiers, le socle partagé de trois composants — mais les **qualifications
s'inversent** :

- les **32 boutons en fond Wouj deviennent conformes** : c'est le CTA de l'AV-02. Le lot que je
  soumettais à décision est **sans objet** ;
- les **5 boutons en fond Sitwon** deviennent les seuls non conformes ;
- le rationnement porte désormais sur **Sitwon**, pas sur Wouj ;
- restent fautifs, sous l'un comme l'autre récit : les **55 `ring-wouj`** (le focus est Chabon,
  `globals.css:44-49`) et les **36 `hover:text-wouj`** — un survol de lien n'est ni un usage ni
  une certification ;
- `AdminNav` (`border-wouj` sur la navigation active) devient **conforme** : l'AV-02 attribue à
  Wouj le soulignement de navigation active ;
- `LocaleSwitcher` (`bg-wouj text-white` sur la langue active) devient **conforme** aussi — l'état
  actif est un usage, et le texte y est bien Blan.

L'article 1 de l'AV-01 est par ailleurs partiellement dépassé : il réservait Sitwon au badge
« Dokiman verifye », que l'AV-02 fait passer en Wouj.

## 7. À faire

1. **Jeton** : `sitwonPal #FFF3C6` → `woujPal #FCE1E4` dans `src/lib/brand-colors.ts` et
   `tailwind.config.ts`. Zéro usage à migrer.
2. **Cinq boutons** en `bg-sitwon` → `bg-wouj text-white`.
3. **55 `ring-wouj`** supprimés ; **36 `hover:text-wouj`** ramenés à Chabon.
4. **Statut « Abrogé »** → pastille fond Sitwon, texte Chabon.
5. **Badge « Dokiman verifye »** → fond Wouj, texte Blan.
6. **AV-04 réécrit** sous le récit inversé.
7. **Trancher** le modèle chromatique de la carte judiciaire (§4).
8. **Poser au concepteur** la question des quatre gris (§5).

Les points 1 à 3 sont mécaniques et sans risque. Le 4 et le 5 changent ce que le lecteur voit sur
chaque fiche de document.
