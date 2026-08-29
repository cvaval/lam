# AVENANT AU RELEVÉ — LA LOI-MÈRE EST ARRIVÉE (27 août 2026, 22 h 51)

Me Vaval a fourni les deux pièces qui manquaient au corpus :
- `~/Downloads/LoiMarchesPublics_10juin2009.docx` → `loi-2009.txt` (491 ¶, **179 têtes d'article**)
- `~/Downloads/TABLE DES MATIÈRES_loi sur la passassion.docx` → `loi-2009-tdm.txt` (57 ¶)

## 1. IDENTIFICATION EXACTE (lue du corps, pas du nom de fichier)

**Loi n° CL 06 2009-009 fixant les règles générales relatives aux Marchés Publics et aux
Conventions de Concession d'Ouvrage de Service Public.**

⚠️ **LA PIÈCE FOURNIE EST UNE REPRODUCTION**, et elle le dit : *Moniteur* **n° 78 du mardi
28 juillet 2009**, « (Reproduction pour erreurs matérielles) — Voir Le Moniteur No. 60 du
vendredi 12 juin 2009 ». La publication d'origine est donc le **n° 60 du 12 juin 2009** ;
celle-ci la corrige. Conséquence pour la fiche : `publicationDate` et `moniteurRef` à trancher
(question à Me Vaval — la reproduction rectificative fait-elle foi ?), et les DEUX références
doivent figurer sur la fiche.

## 2. LES DATES (règle de Me Vaval du 27 août : la dernière entité d'adoption)

- Sénat : **4 juin 2009** · Chambre des Députés : **10 juin 2009**
- Promulgation présidentielle (René PRÉVAL) : **« Donnée au Palais National … le 12 juin 2009 »**
⇒ **`adoptionDate = 2009-06-12`** (la présidence est la dernière entité).
⚠️ **Le texte est donc usuellement cité « loi du 10 juin 2009 » — date du vote de la Chambre —
alors que sa promulgation est du 12 juin.** Même configuration que la loi CEC (26 juin/10
juillet) : le bloc parlementaire tranche, et la note de la fiche doit porter les trois dates.

## 3. ⚠️ CORRECTION D'UNE HYPOTHÈSE DE TRAVAIL — LE DÉCRET « DU 14 FÉVRIER 2005 » N'EXISTE PAS

Le fichier `Decret_14_fevrier_2005_Marches_Publics_Transcription.docx` est le *Moniteur*
**n° 12 du lundi 14 février 2005** — c'est la date de PUBLICATION. Le décret lui-même est
**« Donné au Palais National … le 3 décembre 2004 »** (Boniface Alexandre, 117 articles).
**C'est le DÉCRET DU 3 DÉCEMBRE 2004**, et il faut le nommer ainsi partout (règle
adoptionDate + règle « référence = titre complet »).

## 4. LA CLAUSE D'ABROGATION, CITÉE (art. 99 de la loi)

> « La présente Loi abroge toutes Lois ou dispositions de Lois, tous Décrets ou dispositions de
> Décrets, tous Décrets-Lois ou dispositions de Décrets-Lois qui lui sont contraires, **notamment
> la Loi du 16 septembre 1953 sur l'adjudication, le Décret du 3 décembre 2004 fixant la
> réglementation des Marchés Publics de services, de fournitures et de travaux et l'Arrêté du
> 4 décembre 2006 révisant les seuils de Passation des Marchés Publics** … »

⇒ **Abrogation NOMMÉE, dans le dispositif** — pas un considérant. Trois arêtes fermes du graphe :
1. loi 2009 **ABROGE** décret du 3 décembre 2004 (dans le lot → pastille « abrogé » + repli) ;
2. loi 2009 **ABROGE** loi du 16 septembre 1953 sur l'adjudication (au corpus ? à chercher) ;
3. loi 2009 **ABROGE** arrêté du 4 décembre 2006 sur les seuils (hors lot — à signaler).
Le considérant (l. 41) nomme lui aussi le décret de 2004 : c'est le MOTIF, l'article 99 est
l'ACTE. Le `kind` ABROGE est fondé sur l'article 99, jamais sur le considérant (§ 6.4).

## 5. LA TABLE DES MATIÈRES

Structure à quatre niveaux (TITRE / CHAPITRE / Section / articles) — c'est le sommaire du
lecteur annoté de la loi. À confronter au corps avant de servir de `toc` (mêmes gardes que la
loi CEC : plages en assertions, libellés lus du corps, jamais de la table).

## 6. CE QUE ÇA CHANGE POUR LE PROMPT

- La section n'est plus « des arrêtés d'application orphelins » : **la loi-mère est la tête de
  corpus**, les 20+ arrêtés s'y rattachent par des renvois d'application.
- Le décret de 2004 entre **abrogé d'emblée**, avec sa pastille et son texte en repli — c'est
  la première paire pastille/repli du lot, prouvée par l'article 99.
- La question « verser sans la loi ? » **TOMBE**. Reste : la double publication (n° 60 / n° 78),
  et l'usage « loi du 10 juin » contre la promulgation du 12 juin.
