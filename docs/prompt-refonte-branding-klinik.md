# Refonte de marque « Klinik » — cahier des charges

Réf. **LAM-BRAND-2026-08-V2** · remplace intégralement le système *Lam Veritab* v1.0
Sources : `Logo/Lam Branding (Aug 2026)/` · `Logo/Lam Palette tokens (Aug 2026)/`

---

## 0. Ce que la refonte change vraiment

Ce n'est pas un changement de couleurs. C'est un **changement de principe**.

Le système v1.0 **naviguait par la couleur** : chaque type de document portait sa teinte
(Lank pour Le Moniteur, Solèy pour les circulaires BRH, Brim pour la jurisprudence…), et
`src/lib/brand.ts` le dit en toutes lettres — « *la navigation par couleur traverse toute la
plateforme : tuiles du tableau de bord, filtres, badges de résultats, admin* ».

Le système Klinik **supprime ce codage** et le remplace par un codage **typographique** :
des pastilles uniformes (fond Pil, bordure `#C7C6C1`, texte Chabon) portant un code en
IBM Plex Mono — LÉG, BRH, JUR, DOC, FIN, MRK.

**La couleur cesse d'être un langage ; elle devient un fond.** Toute la charge de
distinction passe sur le mot. Il faut donc traiter la refonte comme une refonte de
navigation, pas comme un habillage : partout où une teinte portait un sens, ce sens doit
être rendu par le texte, la position ou la forme.

Une seule couleur reste signifiante : **Wouj `#D21034`**, rationnée à **une occurrence par
écran**.

---

## 1. Périmètre mesuré

| Surface | Volume constaté |
|---|---|
| Classes Tailwind de marque dans `src/` | **1 819 occurrences · 92 fichiers** |
| Jetons à retirer | `lank` (1 228), `sitwon` (137), `soley` (105), `paper` (90), `cream` (71), `fey` (59), `lagon` (41), `endeks` (38), `kannel` (35), `brim` (15) |
| Valeurs hex en dur | ~45, dont `#BEF264` (9), `#1C1B3A` (8), `#7C6F9B` (5), `#F4A823` (4), `#F6F4EE` (3) |
| Types de documents à repastiller | **8** (voir §7 — la charte n'en code que 6) |
| Documents générés | sceau PDF (`src/lib/pdf/seal.ts`), annexes Word/Excel (`src/lib/annexes/generate.ts`), filigrane `public/brand/Lam_Watermark.png` |
| Pages institutionnelles | accueil, `cgu`, `mentions-legales`, `confidentialite`, `publications`, `juridictions` |
| Logotypes en place | 9 SVG + 1 PNG dans `public/brand/` |

Points favorables : **aucun mode sombre**, **aucun noir pur**, et « Veritab » ne subsiste
que dans un fichier de test.

---

## 2. Nouveaux jetons

Reprendre `lamklinik-colors.css` **tel quel** (il porte déjà les rôles sémantiques) et
`lamklinik-tailwind.js` pour l'extension Tailwind.

| Jeton | Hex | Rôle |
|---|---|---|
| `chabon` | `#414042` | Sombre de référence · bandeaux · wordmark · boutons primaires |
| `adwaz` | `#3E4A4D` | Héros · bannières · surfaces institutionnelles |
| `koton` | `#EAE9E5` | Fond de page universel |
| `blan` | `#FFFFFF` | Surfaces de lecture · cartes · modales |
| `grafit` | `#55565A` | Texte d'interface |
| `wouj` | `#D21034` | **Accent unique — rationné** |
| `ank` | `#3F4043` | Texte juridique long |
| `liy` | `#D8D7D2` | Filets · bordures · séparateurs |
| `pil` | `#F2F1EE` | Pilules · contrôles secondaires |
| `vet` | `#3E5E46` | Succès (fonctionnel, hors marque) |

### Les trois règles d'or, non négociables

1. **Wouj est rationné** — une occurrence par écran au maximum (montant critique, statut
   « Abrogé », alerte de certification, trait de la feuille du logo). **Jamais en fond,
   jamais en texte courant.**
2. **Tout texte juridique se lit sur Blan.** Koton n'accueille jamais plus de deux lignes
   de texte continu.
3. **Noir pur `#000000` interdit** — les bornes sombres sont Chabon et Ank.

### Correspondance de reprise

Cette table sert à convertir les 1 819 occurrences. Elle est indicative : chaque conversion
doit être **vérifiée à l'écran**, la sémantique changeant (voir §0).

| Ancien | Nouveau | Réserve |
|---|---|---|
| `lank` (texte) | `grafit` en interface, `ank` en texte juridique long | distinguer les deux emplois |
| `lank` (fond sombre) | `chabon` ; `adwaz` pour héros et bannières | |
| `paper` (fond de page) | `koton` | |
| `cream` | `koton` sur fond sombre, `blan` en surface de lecture | |
| `sitwon` (anneau de focus) | `chabon` (`--lam-focus`) | l'anneau ne peut pas être Wouj |
| `sitwon` (surlignage de recherche) | `pil` avec texte `chabon` | **voir §6** |
| `soley`, `brim`, `lagon`, `fey`, `endeks`, `kannel` | *supprimés* | leur sens passe au code du §3 |
| succès / validé | `vet` | seul emploi de `vet` |
| erreur / danger | `wouj` | **compte dans le rationnement** |

---

## 3. Pastilles de type — le cœur de la refonte

`src/lib/brand.ts` porte aujourd'hui `COLOR_CLASSES`, huit entrées `{dot, badge, ring, text}`
qui teintent tout. **Remplacer ce registre par une pastille unique** :

```
fond      var(--lam-pil)      #F2F1EE
bordure   #C7C6C1             (1 px)
texte     var(--lam-chabon)   #414042
police    IBM Plex Mono, approche +14 %
```

Codes : **LÉG** · **BRH** · **JUR** · **DOC** · **FIN** · **MRK**

Conséquences à traiter, et non à subir :

- **Le tableau de bord** distingue ses tuiles par la couleur. Sans elle, prévoir un autre
  ordre de lecture : code en tête, intitulé en gras, description en Grafit.
- **Les filtres et les badges de résultats** deviennent monochromes : la sélection doit se
  marquer autrement (fond Chabon + texte inverse, ou bordure épaissie).
- **`ring`** n'a plus de sens par type ; l'anneau de focus devient uniforme (Chabon).
- Vérifier le contraste du texte Chabon sur Pil : **AA à 4,5:1 minimum** pour un corps de
  10–11 px. Si le rapport est insuffisant à cette taille, remonter le texte à Ank.

**IBM Plex Mono doit être embarqué** (auto-hébergé, `next/font/local`) : la police n'est
pas au système et le code de type est un élément de marque, non un détail typographique.

---

## 4. Logotypes, favicon, manifeste

Déposer dans `public/brand/` les 9 SVG et 7 PNG du dossier `svg/` et `png/`, et à la racine
de `public/` les fichiers de `favicon/`. Les noms de fichiers sont **inchangés** : la
substitution est un remplacement à l'identique, sauf pour les deux nouveautés
`Lam_Marque_Klinik.svg` et `Lam_AppIcon_Klinik.svg`.

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/Lam_Marque_Klinik.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#414042">
```

```json
{ "name": "Lam — Le fruit du savoir", "short_name": "Lam",
  "icons": [ { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" } ],
  "theme_color": "#414042", "background_color": "#EAE9E5", "display": "standalone" }
```

`src/app/layout.tsx` ne déclare aujourd'hui que `icons: { icon: '/favicon.svg' }` : à
compléter, et à supprimer `public/favicon.svg` (ancienne marque).

> ⚠️ **Réserve du concepteur, à arbitrer.** Le fruit recoloré en Koton **disparaît sur le
> fond Koton de page**. Le logo doit être posé sur surface **Blan** (en-tête, cartes) ou en
> version **FondFonce**. Vérifier chaque emplacement du logotype avant de livrer ; si le
> résultat déplaît, demander une variante à fruit plus contrasté.

---

## 5. Documents générés — la marque hors écran

C'est la partie la plus facile à oublier et la plus visible chez le client.

- **`src/lib/brand-colors.ts`** — source unique, consommée par Tailwind, le logo et le
  sceau PDF. Y remplacer `lank`/`sitwon`/`cream` par les jetons Klinik. Conserver
  `hexToRgb01`.
- **`src/lib/pdf/seal.ts`** — `LANK` et `SITWON` deviennent Chabon et… **rien**. Le sceau
  ne peut plus s'appuyer sur un accent vert. Proposer : bandeau Chabon, texte Koton, et
  **le trait Wouj comme unique signe** (c'est l'occurrence autorisée pour la page).
  Attention `rgb(0.1, 0.12, 0.16)` en dur ligne 137 → Ank.
- **`src/lib/annexes/generate.ts`** — `LANK` et `SITWON` en hex nus (lignes 48–49) ;
  filigrane `public/brand/Lam_Watermark.png` **à régénérer** dans la nouvelle marque.
- Vérifier le rendu **imprimé** : Koton sur papier blanc est presque invisible, Pil encore
  plus. Les pastilles de type doivent rester lisibles à l'impression noir et blanc — c'est
  précisément l'avantage du codage typographique, à condition que la bordure tienne.

---

## 6. Surlignage des résultats de recherche

Aujourd'hui `globals.css` surligne en `#e3f3c6` (dérivé Sitwon) et `#ffe9a8` (dérivé Solèy).
Ces deux teintes sortent de la palette Klinik, qui n'offre **aucune couleur de surlignage** :
Wouj est interdit en fond, Vet est réservé au succès.

**À décider** (proposition) : surlignage en **Pil** avec **soulignement Wouj de 2 px** —
le rouge y est un trait, non un fond, ce qui respecte la règle. Une seule occurrence par
écran étant impossible à tenir sur une page de résultats, **demander l'arbitrage** : soit
le surlignage échappe au rationnement (il est fonctionnel, non décoratif), soit il se fait
en Liy sans rouge.

---

## 7. Les deux types que la charte ne code pas

La plateforme sert **huit** rubriques ; `lamklinik-colors.json` n'en code que six.

| # | Rubrique | Jeton v1 | Code Klinik |
|---|---|---|---|
| 1 | Éditions Le Moniteur | Lank | LÉG |
| 2 | Circulaires BRH | Solèy | BRH |
| 3 | Recueil de jurisprudence | Brim | JUR |
| 4 | Doctrine | Lagon | DOC |
| 5 | Lois de finances | Fèy | FIN |
| 6 | Marques de commerce | Sitwon | MRK |
| 7 | **Index du Moniteur** | Endèks | **manquant** |
| 8 | **Tarifs douaniers** | Kannèl | **manquant** |

**Ne pas inventer ces deux codes sans validation.** Proposer `IDX` et `TAR` (trois lettres,
sans accent, cohérents avec les six autres) et attendre l'accord. Noter que le code `LÉG`
porte un accent quand les autres n'en ont pas : le vérifier en Plex Mono à 10 px.

---

## 8. Pages institutionnelles

Reprendre une à une, **en lisant le texte** et pas seulement les classes :

- **Accueil** — le héros passe en Adwaz (rôle explicite : « héros · bannières »). Le
  carrousel à deux diapositives et l'illustration de carte judiciaire portent des couleurs
  v1 à convertir.
- **CGU**, **Mentions légales**, **Politique de confidentialité** — texte juridique long :
  fond **Blan**, texte **Ank**. Vérifier qu'aucune mention « Lam Veritab » ne subsiste dans
  le corps (le nom commercial est **Lam**, la baseline **Le fruit du savoir**).
- **Connexion / création de compte** — bouton primaire Chabon, pas d'accent coloré.
- **Tableau de bord** — voir §3.

---

## 9. Ordre d'exécution

1. **Jetons** — `tailwind.config.ts`, `src/lib/brand-colors.ts`, `globals.css`. Garder
   temporairement les anciens jetons en alias pour que rien ne casse.
2. **Pastilles** — `src/lib/brand.ts` + `src/components/TypeBadge.tsx` + police Plex Mono.
3. **Actifs** — logos, favicons, manifeste, `layout.tsx`.
4. **Balayage** — les 1 819 occurrences, fichier par fichier, en suivant §2.
5. **Documents générés** — sceau, annexes, filigrane.
6. **Pages institutionnelles**.
7. **Retrait des alias** de l'étape 1 ; `grep` de contrôle : plus aucune occurrence de
   `lank|sitwon|soley|brim|lagon|fey|endeks|kannel|paper|cream`, ni des hex v1
   (`#1C1B3A`, `#BEF264`, `#F6F4EE`, `#F4A823`, `#7C6F9B`, `#B5651D`, `#9ADCDC`, `#3A5505`).

## 10. Contrôles de livraison

- [ ] `npm run build:check` passe (⚠️ **pas** `npm run build` si un serveur de dev tourne).
- [ ] Zéro occurrence des jetons et hex v1 (grep de l'étape 7).
- [ ] Zéro `#000000`.
- [ ] **Wouj** : recenser ses occurrences écran par écran et prouver la règle d'une seule.
- [ ] Contraste **AA** vérifié sur : pastille (Chabon/Pil), texte d'interface (Grafit/Koton),
      texte juridique (Ank/Blan), texte inversé (`#EDEDEB`/Chabon).
- [ ] Le logo ne repose jamais sur Koton (§4).
- [ ] Un PDF et un fichier d'annexes générés, ouverts et **imprimés en noir et blanc**.
- [ ] Les 8 pastilles lisibles à 10 px.
- [ ] Aucune régression de navigation : chaque endroit où la couleur portait un sens en
      porte un autre (§0).

---

## Questions à trancher avant de commencer

1. **Codes des types 7 et 8** (Index du Moniteur, Tarifs douaniers) — §7.
2. **Surlignage de recherche** — §6, la palette n'en prévoit pas.
3. **Fruit Koton sur fond Koton** — réserve du concepteur, §4.
4. **Perte de la navigation par couleur** — changement voulu, mais il faut confirmer que
   le tableau de bord et les filtres restent lisibles sans elle (§0, §3).
