# Code civil — audit : sauts de ligne, appareil, séquelles d'OCR

**31 juillet 2026.** Audit du document en base (3 306 lignes, 711 Ko de texte, 823 Ko
d'annotations), confronté au fac-similé de l'édition Zémès 2011 (`Code Civil.pdf`).

Outil rejouable : `npx tsx scripts/audit-code-civil.ts [--detail]` (lecture seule).
Corrections : `scripts/fix-code-civil-ocr.ts` et `scripts/fix-code-civil-appareil.ts`,
simulation par défaut, écriture transactionnelle et journalisée.

## 1. Corrigé

| Défaut | Nombre | Correction | Vérification |
|---|---:|---|---|
| Sigle « **€** » lu pour « C. » dans un renvoi | 5 | `€. tv, 1222…` → `C. civ., 1222…` | **image** des pages 98, 207, 257, 265, 362 — une par une |
| « **C. dv** » pour « C. civ. » | 26 | `C. dv, 189, 190` → `C. civ., 189, 190` | le recueil imprime « C. civ. » (p. 153 notamment) |
| **Césures** de fin de ligne non recousues | 27 | `communi- cation` → `communication` | garde-fou : recousu seulement si le mot obtenu **existe ailleurs dans le corpus** |
| Espace parasite avant une **virgule** | 4 | `section , seront` → `section, seront` | — |
| Sigle « © » (art. 165 et 1643) | 2 | `© civ,` → `C. civ.,` | fac-similé p. 58 et 338 |
| Note de jurisprudence recollée (art. 157) | 1 | note ventilée vers les annotations | fac-similé p. 57 |

Les 26 renvois « C. dv » n'étaient **ni lisibles ni cliquables** : ils rejoignent
maintenant les renvois internes du Code.

**Ce que je n'ai PAS corrigé, exprès :** l'article 2 se termine par « …969, 2046 ;
C. pén., » — sans numéro. L'image de la page 23 montre que **le livre lui-même** s'arrête
là. Inventer un numéro aurait fabriqué une citation ; le défaut est celui de l'édition.

## 2. Ce qui reste — le gros morceau : 61 notes recollées

**61 lignes** du texte officiel portent une référence d'arrêt (« Cass., 6 mars 1900 ») :
c'est la signature d'une note de l'éditeur absorbée par le texte de loi lors de la saisie.
Elles touchent **53 articles**, listés avec leur page dans
[`code-civil-confrontation-facsimile.md`](code-civil-confrontation-facsimile.md).

Une partie demande un **arbitrage éditorial** et non une transformation mécanique : sur
plusieurs pages, les deux colonnes de l'appareil ont été lues **en travers**. Le passage
recollé est alors entrelacé, et les césures qui l'accompagnent le montrent bien — ce sont
exactement les **17 césures laissées** par le correctif :

> art. 398 : « des actes de la vie civile dont il n'a que la **jouis- ne lui est pas
> ouvert** » · art. 701 : « sur les biens de la **suc- reçoit: c'est une conséquence** » ·
> art. 846 : « un legs **subor- ou à terme** »

Recoudre donnerait « jouisne », « sucreçoit », « suborou ». Il faut recomposer depuis le
fac-similé, article par article.

## 3. Autres constats, tous instruits

| Constat | Nombre | Analyse |
|---|---:|---|
| Même note rattachée à **deux** articles | 3 | art. 921/926 et 933/974. À trancher sur le livre : l'éditeur répète parfois une note sous deux articles voisins — ce n'est pas nécessairement un doublon. |
| **Intertitre collé** au texte | 1 | art. 269 |
| **Deux articles sur une ligne** | 1 | l. 481 : le texte de l'art. 329 est suivi, sur la même ligne, du « Décret du 8 octobre 1982, Art. 16 » (majorité à 18 ans) — un texte connexe qui mériterait sa propre unité. |
| « © » résiduel | 1 | art. 1860 : il marque le début d'une note recollée (cf. § 2), pas une faute de caractère. |
| Mots mal océrisés (`jutn`, `jutllet`, `préctté`) | 15 | Presque tous dans des **dates d'arrêts**, donc dans l'appareil. Corrigeables, mais sans effet sur le texte de loi. |
| « l: » / « t: » pour « L' » | 1 | dans une note. |

**Aucun défaut structurel** par ailleurs : pas de numéro d'article en double (les
« 1181-1 » du décret de 2020 sont des articles à part entière), pas d'article hors
séquence, pas d'en-tête sans texte, **aucune annotation rattachée à un article
inexistant**, aucune ancienne rédaction orpheline.

Sur les **sauts de page** du livre : aucune troncature. Aucun article de la base ne
s'interrompt là où le fac-similé change de page.

## 4. Faux positifs écartés en cours d'audit

Un détecteur qui crie au loup masque les vrais défauts. Trois ont été corrigés :

- **l'espace avant « ; » et « : » est correct** en typographie française — ne restaient
  fautifs que les espaces avant virgule et point ;
- **« Art. 1181-1 » n'est pas une seconde occurrence de l'article 1181** : le suffixe
  décimal fait partie du numéro (décret du 13 mai 2020) ;
- **« . 683 L'estimation des immeubles… »** ressemblait à un en-tête perdu. L'image de la
  page 153 montre que l'article 683 a bien son « Art. » — et la base aussi, ligne 1052.
  Ce que j'avais pris pour un titre manquant est un **fragment dupliqué** à l'intérieur de
  la note recollée de l'article 682.
