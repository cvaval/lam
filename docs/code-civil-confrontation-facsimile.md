# Code civil — confrontation au fac-similé (édition Zémès, 2011)

**31 juillet 2026.** Comparaison article par article du Code civil en base avec le PDF
fourni (`Code Civil.pdf`, 481 pages, Patrick Pierre-Louis, éditions Zémès, 2011).

## 1. Méthode

La page du livre superpose trois strates que le flux texte d'un PDF ne sépare pas : le
**texte officiel** (pleine justification), l'**appareil de l'éditeur** (notes de
jurisprudence, deux colonnes, petit corps) et les **titres courants**. La couche texte du
PDF est elle-même océrisée et fautive (« Lol du 12 np&ernbre 1961 », « c. ctv. » pour
« C. civ. ») : elle ne peut donc pas servir de référence au mot près, seulement de
référence de STRUCTURE.

Le discriminant retenu n'est pas la taille de police — la dernière ligne de chaque note
est composée en 8,6 pt, à portée du texte de loi — mais la **mise en colonnes** : le texte
officiel traverse la gouttière (x ≈ 190-195), l'appareil jamais.

## 2. Ce qui a été corrigé (fait, en base)

| Article | Défaut | Correction | Preuve |
|---|---|---|---|
| **165** | `- © civ, 134, 155, 185, 904 et s` | `- C. civ., 134, 155, 185, 904 et s` | p. 58 du livre : « c. civ., 134, 155, 185, 904 et s » |
| **1643** | `simple prêt. © ct, 1600 et suivants` | `simple prêt.- C. civ., 1600 et suivants` | p. 338 : « simple pret.- c. ctv., 1600 et sutvants » |
| **157** | 510 caractères d'une **note de jurisprudence** recollés au texte officiel | note retirée du texte de loi et **rattachée aux annotations** de l'article (`sec-25\|art-157`) | p. 57 : la note est composée sous l'article, en deux colonnes |

Rien n'a été supprimé : la note du 157 (« Ne sera point valable, le mariage contracté en
pays étranger… Cass., 6 mars 1900. ») s'affiche désormais dans le pliable « Annotations »
de l'article, à sa place. Corps : 711 224 → 710 719 caractères. Opération journalisée
(`ARTICLE_AMENDED`), script rejouable : `scripts/fix-code-civil-appareil.ts`.

## 3. Ce que la confrontation a révélé — 53 articles restants

Le même défaut qu'à l'article 157 touche **53 autres articles** : une note de l'éditeur,
reconnaissable à sa référence d'arrêt (« Cass., 6 mars 1900 »), a été absorbée dans le
texte officiel lors de la saisie.

**Une partie d'entre eux demande un arbitrage éditorial** : sur plusieurs pages, les deux
colonnes de l'appareil ont été lues EN TRAVERS, si bien que le passage recollé est
lui-même entrelacé — « il répond de sa part dans les dettes héréditaires, non seulement
sur les biens de la suc- **reçoit: c'est une conséquence de la conf**… » (art. 701). On ne
peut pas le remettre en note tel quel : il faudrait le recomposer depuis le fac-similé.
C'est pourquoi ces 53 articles ne sont pas traités d'office.

| Article | Page du livre | Fin du passage recollé |
|---:|---:|---|
| 97 | 48 | …e de ses héritiers est compétent pour le règlement des questions de succession. Cass., 25 mai 1893, Aff. McGuf |
| 106 | 50 | …alablement fourni caution pour la sûreté et garantie des droits des héritiers absents. Cass., 11 janvier 1899. |
| 180 | 60 | …i aurait dû être constaté, à sa date, dans les registres inexistants ou perdus. Cass., 25 mars 1927, Aff. Jn-B |
| 195 | ? | …s que dans le cas où la garde de ces derniers lui a été confiée par autorité de justice. Cass., 25 avril 1989. |
| 255 | ? | …oit fait au plus grand l'autre époux et même à une tierce personne. avantage des enfants. Cass., 11 mars 1985. |
| 348 | 99 | … le texte de procédure dans ses prévisions relatives aux nominations de tuteur- Cass., 17 janvier 1929, Aff. A |
| 354 | 100 | …, 355, 356, 405, 416. Si un incapable est nommé tuteur, c'est au de l'incapable. Cass., 17 novembre 1924, Aff. |
| 369 | 103 | …ion grâcieuse, il n'a pas le caractère définitif pouvant donner ouverture à cassation. Cass., 25 juillet 1912. |
| 372 | 103 | …torisation ne peut être, pour la première fois, opposée devant le tribunal de cassation. Cass., 10 avril 1913. |
| 379 | 105 | …e sont soumis qu'à un simple même s'agissant d'erreurs, commissions, faux redressement. Cass., 9 janvier 1894. |
| 429 | 113 | …iv. quandil autorise le demandeur à établir par enquête son droit de propriété. Cass., 19 mai 1915. la questio |
| 443 | 114 | …e par l'autorité les rivages de la mer ne sont pas susceptibles administrative, Cass., 14 mars 1905. de propri |
| 455 | 116 | …rait donner ouverture à cassation. l'assignation à lui signifiée en nullité d'icelui, les Cass., 29 juin 1911. |
| 675 | 152 | …87, 1996, 2030. au mérite d'un acte réunissant les caractères légaux du partage. Cass., 26 avril 1906. 1.1 n'y |
| 678 | 152 | …int partage, parce qu'il ne s'y trouve ni formation de lots ni attribution de parts. Cass., 18 juillet 1901 2. |
| 682 | 153 | …tage judiciaire, du tirage au sort et de la délivrance des lots par le notaire. Cass., 15 juin 1928, Aff. Salo |
| 688 | 154 | …et constatées simplement par les lettres de reproche que ce fils recevait de son père. Cass., 18 juillet 1859. |
| 701 | 156 | …core sur ses biens personnels et même au-delà de ce qu'il continue la personne. Cass., 11 octobre 1922, Aff. B |
| 724 | 161 | …s s'y trouvent, par conséquent avec les charges dont elles étaient grevées avant le décès. Cass., 17 mai 1915. |
| 846 | 180 | … est conditionnel si, dans l'intention du testateur, un legs subor- ou à terme. Cass., 16 juin 1896, Aff. Ribo |
| 847 | 180 | … et transmissible à ses héritiers. ment à la mort d'une personne déterminée est Cass., 16 juin 1896, Aff. Ribo |
| 848 | 181 | …itue un fait, loin d'être défendue, est permise en matière de legs indéterminé. Cass., 20 juillet 1948, Gaz. N |
| 905 | 189 | … en est l'objet. À cet égard, les appré- ciations des premiers juges sont souveraines. Cass., 25 janvier 1900. |
| 914 | 191 | …écuter les condamnations prononcées contre le propriétaire de l'immeuble vendu. Cass., 4 mai 1893, Aff. Bijou. |
| 920 | 192 | …ntient les éléments nécessaires pour fixer la quotité à laquelle a droit le créancier Cass., 27 novembre 1911. |
| 938 | 198 | …acle à des formalités pour lesquelles un délai rigou- l'exécution des contrats. Cass., 26 avril 1944, reux est |
| 1029 | 216 | …se, aucun tribunal ne peut prononcer une condamnation en une monnaie étrangère. Cass., 7 mars 1919, Gaz. No 19 |
| 1035 | 218 | …urs, même d'attaquer en cassation un jugement rendu contre le cédant avant la cession. Cass., 30 octobre 1843. |
| 1044 | 222 | …sine qua non d'être prononcées ou accompagnées d'un récolement ou vérification. Cass., 26 juillet 1918, Gaz. N |
| 1053 | 224 | … C. civ., 925. Une clause par laquelle les parties convien- contraire à la loi. Cass., 28 mai 1956, Déb. No ne |
| 1075 | 228 | …r obtenir la réduction de la créance, n'est pas un obstacle légal à son examen. Cass., 9 novembre 1921, Aff. D |
| 1106 | 237 | …réciation des faits qui donnent lieu à une condamnation à des dommages intérêts. Cass., 30 janvier 1911, Bull, |
| 1115 | 241 | …ire naître de fortes présomptions en faveur de la réalité de ladite convention. Cass., 6 mai 1909. invoquée pa |
| 1119 | 241 | …mme au cas où lesdits titres se trouveraient entre les mains d'un fonctionnaire étranger. Cass., 13 juin 1911. |
| 1128 | 245 | … de délicatesse professionnelle d'un médecin) de se procurer une preuve écrite. Cass., 29 janvier 1950, Gaz. N |
| 1130 | 245 | …tant la preuve testimoniale pour les choses excédant la somme de seize gourdes. Cass., 11 juin 1929, Aff. Loui |
| 1155 | 255 | …aire n'habilite pas le juge à en tirer effet quant à la fixation de ce salaire. Cass., 22 juillet 1927, Aff. A |
| 1381 | 294 | … d'en réparer le vice, de la part de celui qui aurait intérêt à s'en prévaloir. Cass., 30 juin 1926, Aff. Gédé |
| 1673 | 341 | …e constituer sieurs termes, il est de principe que les intérêts le débiteur en demeure. Cass., 5 juillet 1915. |
| 1675 | 341 | …roisse par l'art. 1675 stipulés dans un billet courent tout le temps du C. civ. Cass., 4 juin 1895, Aff. Gache |
| 1727 | 348 | …'il y aurait cause légitime l'autorisant à se décharger en partie de son dépôt. Cass., 7 mars 1924, Aff. Giord |
| 1750 | 355 | … et de l'intention des parties contractan- tes est du domaine exclusif des juges du fait. Cass., 12 juin 1906. |
| 1752 | 355 | …ns que l'existence de ce mandat résulte des faits et circonstances de la cause. Cass., 23 janvier 1929, Aff.J. |
| 1756 | 356 | …ur sa demande, être mis hors de cause et non pas être personnellement condamné. Cass., 8 octobre 1895, Aff. De |
| 1768 | 360 | …sa procuration mandat ne sera révoqué que dans les condi- quand bon lui semble. Cass., 26 mars 1915. tions d'a |
| 1775 | 361 | …ps pour le recouvrement de la dette qui est due de ce chef commet un excès de pouvoir. Cass., 13 janvier 1912. |
| 1780 | 361 | …présume pas, n'a prescrit une forme et des termes sacramentels pour l'établir validement.- Cass., 4 mars 1890. |
| 1818 | 367 | …osition pour pouvoir exécuter prononcées par un jugement par défaut ne sontitre. Cass., 11 mai 1928, Aff. West |
| 1843 | 371 | …i bien que le détenteur convenu, n'étant pas propriétaire du gage, est créance. Cass., 28 janvier 1929, Aff. R |
| 1860 | 375 | …ge qui prescrit le nouveau de la dette, cumuler deux voies d'exécution. mode d'exécution. Cass., 23 mars 1914. |
| 1862 | ? | …t jamais de l'intérêt indivi- dans la volonté des parties; ils ne peuvent duel. Cass., 11 avril 1893, Aff. Déb |
| 2000 | 404 | …imple tolérance, et une pareille possession ne fait pas courir la prescription. Cass., 8 octobre 1928, Aff. Co |
| 2016 | 406 | …e cription non acquise qui court à partir de la date de la prescription interrompue. Cass., 26 septembre 1893. |

53 articles

*(« ? » : article dont l'extracteur n'a pas retrouvé la page — numérotation océrisée.)*

## 4. Réserves de méthode, dites franchement

- **Les articles amendés depuis 2011 diffèrent légitimement du livre** : 278 articles
  portent un statut (140 modifiés, 68 abrogés, 60 nouveaux, 10 partiellement abrogés) au
  titre de la loi Filiation (2014), du décret Régimes matrimoniaux et du décret Sûretés
  (2020). Les compter comme des écarts de saisie aurait produit un rapport alarmiste et faux.
- **L'extracteur de PDF n'est pas parfait** : sur les pages très chargées en notes
  (art. 2 à 9), des lignes d'appareil traversent la gouttière et sont prises pour du texte
  de loi. Les écarts qu'il signale sur ces pages sont des artefacts, pas des défauts de la
  base — c'est pourquoi le présent rapport s'appuie sur le signal INTERNE (la référence
  d'arrêt dans le texte officiel), vérifié ensuite page par page sur le fac-similé.
- Les **sauts de page** n'ont pas révélé de troncature : aucun article de la base ne
  s'interrompt là où le livre change de page.

## 5. Renvois croisés

Le Code civil cite deux autres codes. Les deux sont désormais cliquables — l'abréviation
mène au code, chaque numéro à son article, et un numéro que la cible ne porte pas reste du
texte plutôt que de devenir un lien mort.

| Code cité | Abréviations | Liens d'article (corps) | Liens d'article (annotations) |
|---|---:|---:|---:|
| Code de procédure civile | 321 | 578 | 77 |
| **Code pénal** | **66** | **99** | **8** |

Le Code pénal n'est pas continu : 422 ancres, articles 1 à 413, mais sept numéros n'ont
pas d'article (12, 13, 14, 160, 161, 222, 355). Une simple borne y aurait fabriqué sept
liens morts — d'où la liste explicite, revérifiée par `scripts/verify-code-articles.ts`.

Contrôle d'intégrité : sur le document entier, le texte visible est **rigoureusement
identique** avec et sans les liens.
