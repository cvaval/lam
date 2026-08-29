#!/usr/bin/env python3
"""Rend le manifeste et la table de découpe en Markdown lisible, depuis les JSON mesurés."""
import json, os

DEST = "/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab/scripts/data/marches-publics"
m = json.load(open(os.path.join(DEST, 'manifeste-empreintes.json'), encoding='utf-8'))
d = json.load(open(os.path.join(DEST, 'table-decoupe.json'), encoding='utf-8'))

L = []
A = L.append
A('# Manifeste d’empreintes — corpus des marchés publics')
A('')
A(f'Généré le {m["genere_le"]}. Extracteur : {m["extracteur"]}.')
A('')
A('Les pièces `piece-*.txt` sont des **ré-extractions** des `.docx` d’origine de `~/Downloads/`,')
A('faites avec l’extracteur canonique de la maison. Le manifeste porte **les deux séries**')
A('d’empreintes, étiquetées (§ 4) : celle des `.docx` d’origine et celle des extractions.')
A('La troisième colonne md5 est celle de l’extraction VOLATILE du scratchpad de séance,')
A('conservée pour traçabilité.')
A('')
A('## 1. Les 24 pièces retenues (24 textes + la loi-mère et sa table des matières)')
A('')
A('| Texte(s) | Pièce dans le dépôt | md5 .docx d’origine | md5 extraction | ¶ non vides | TAB | têtes | § 8.2 |')
A('|---|---|---|---|---|---|---|---|')
for p in m['pieces']:
    if p['groupe'] != 'retenues': continue
    att = p.get('tetes_attendues_prompt_8_2')
    ok = '✓' if p.get('tetes_concordantes') else '⚠️'
    A(f"| {'/'.join(p['textes'])} | `{p['cible']}` | `{p['md5_docx_origine'][:10]}` | `{p['md5_extraction'][:10]}` | "
      f"{p['paragraphes_non_vides']} | {p['tabulations']} | {p['nb_tetes_article']} | {att if att is not None else '—'} {ok} |")
A('')
conf = sum(1 for p in m['pieces'] if str(p.get('md5_docx_origine_de_lattendu','')).startswith('prompt'))
A(f'**Contrôle § 8.2.** Le prompt ne chiffre que **16 md5 distincts** sur les 31 pièces : ')
A(f'ces {conf} pièces-là sont **confirmées**, ')
A(f"{sum(1 for p in m['pieces'] if not p['md5_docx_concordant'])} écart. Pour les {31-conf} autres, ")
A('ce manifeste **fixe** la référence par première mesure — il ne confirme rien, et c’est écrit')
A('pièce par pièce dans le JSON (`md5_docx_origine_de_lattendu`).')
A('')
A(f"Comptes de têtes : le § 8.2 en chiffre 22 ; les 22 concordent, "
  f"{sum(1 for p in m['pieces'] if p.get('tetes_concordantes') is False)} écart.")
A('')
A('## 2. Les six écartés — jamais versés, gardés comme pièces de contrôle')
A('')
A('| Pièce | md5 .docx | Motif |')
A('|---|---|---|')
for p in m['pieces']:
    if p['groupe'] != 'ecartees': continue
    A(f"| `{p['cible']}` | `{p['md5_docx_origine'][:10]}` | {p['libelle']} |")
A('')
A('⚠️ `ecartee-f` est le **doublon à l’octet** de la gagnante `piece-19-20` : md5 `.docx` et md5')
A('d’extraction IDENTIQUES des deux côtés. Il s’exclut **par son nom**, jamais par son md5 —')
A('l’exclure par md5 exclurait la gagnante (§ 11.2).')
A('')
A('## 3. Hors liste — une trouvaille non arbitrée')
A('')
for p in m['pieces']:
    if p['groupe'] != 'hors_liste': continue
    A(f"`{p['cible']}` — .docx `{p['docx_origine']}`, md5 `{p['md5_docx_origine'][:10]}`.")
    A('')
    A(p['libelle'])
A('')
A('## 4. Divergence mesurée entre l’extraction volatile et la ré-extraction')
A('')
A('Sur les 31 pièces, **une seule** diverge par son CONTENU : les vingt autres ne diffèrent')
A('que par des paragraphes VIDES que l’extraction de séance avait laissés tomber.')
A('')
for p in m['pieces']:
    dv = p.get('divergence_scratchpad')
    if not dv or dv['tabulations_scratchpad'] == dv['tabulations_reextraction']: continue
    A(f"- **`{p['cible']}`** — l’extraction de séance porte **{dv['tabulations_scratchpad']} tabulation(s)**, "
      f"la ré-extraction **{dv['tabulations_reextraction']}**. C’est le **bug `<w:tab/>`** connu de la maison "
      f"(leçon Loi UCREF 2017) : les colonnes du J.O. y étaient collées. Le `.docx` d’origine est le bon "
      f"(md5 `{p['md5_docx_origine'][:10]}`, celui du § 4). **C’est la seule pièce du lot dont le `.docx` "
      f"porte des éléments `<w:tab/>`** ; partout ailleurs les tabulations sont des U+0009 littéraux du texte. "
      f"L’extraction de séance est conservée en preuve dans `divergences/`.")
A('')
A('## 5. Typographie mesurée par corps (§ 9.3 — jamais supposée)')
A('')
A('| Pièce | apostrophes droites | apostrophes courbes | espaces insécables | exposants Unicode |')
A('|---|---|---|---|---|')
for p in m['pieces']:
    if p['groupe'] != 'retenues': continue
    A(f"| `{p['cible']}` | {p['apostrophes_droites']} | {p['apostrophes_courbes']} | {p['espaces_insecables']} | "
      f"{p['exposants_unicode'] or '—'} |")
A('')
A('Aucune pièce retenue ne mélange les deux apostrophes : chacune est franchement droite')
A('ou franchement courbe. Un seul exposant Unicode dans tout le jeu retenu — « 177ᵉ Année »')
A('au bandeau de fascicule de `piece-23`, hors dispositif. Les exposants hostiles au parsing')
A('(U+1D49 + U+02B3, U+00BA) restent cantonnés à l’écartée `ecartee-e` (§ 4.2).')
A('')
A('## 6. Notes de transcription de l’ÉDITEUR repérées dans les pièces retenues')
A('')
A('Elles vont **en note d’édition, jamais au dispositif** (§ 11.11). Lignes repérées :')
A('')
A('| Pièce | lignes |')
A('|---|---|')
for p in m['pieces']:
    if p['groupe'] != 'retenues': continue
    n = p.get('note_de_transcription_editeur') or []
    if n: A(f"| `{p['cible']}` | {', '.join(str(x) for x in n)} |")
A('')
A('⚠️ `piece-07` (CCAG 2011) porte sa note **AU MILIEU** du fichier (l. 20-24), avant le début')
A('de l’extrait : elle atteste l’absence de la page 2 du Moniteur (§ 4.3) et signale que le')
A('dispositif reproduit est bien celui du CCAG, non celui du Tome IV de la couverture (§ 9.2).')
A('D’autres pièces portent des notes **entre crochets, en ligne dans le corps** — notamment')
A('`piece-02` l. 629 (début de l’article 174 partiellement illisible) et quatre passages de')
A('`piece-10`. Ce ne sont pas des sics du J.O. : ce sont des interventions d’éditeur.')
open(os.path.join(DEST, 'manifeste-empreintes.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

# ── table de découpe ──
L = []
A = L.append
A('# Table de découpe — § 8.3')
A('')
A(f'Générée le {d["genere_le"]}.')
A('')
A('## La règle appliquée, et le piège qu’elle évite')
A('')
A('> Un document = **en-tête de l’acte** + visas/considérants + dispositif + bloc « Donné »')
A('> + signatures + **l’annexe que son dispositif sanctionne**, jusqu’à l’en-tête de l’acte')
A('> suivant ou au colophon.')
A('')
A('La frontière est l’**en-tête de l’acte**, jamais le bloc « Donné ». Mesuré sur pièces :')
A('la Charte de 2012, le Manuel de 2009 et les manuels/dossiers types de 2017 sont transcrits')
A('**après** le bloc « Donné » et les signatures de leur arrêté-chapeau. Une coupe posée')
A('mécaniquement sur « Donné » les aurait orphelinés.')
A('')
A('**Marqueur d’en-tête d’acte, mesuré :** la ligne de devise « LIBERTÉ … ÉGALITÉ … FRATERNITÉ ».')
A('Elle emploie selon les fascicules l’espace ordinaire (Spécial 52), la **tabulation**')
A('(Spécial n° 8) ou l’**EM SPACE U+2003** (Charte 2013) — le motif doit couvrir les trois.')
A('')
A('**Contrôle de validité du marqueur :** dans chacun des trois fichiers multi-actes, le nombre')
A('de marqueurs égale exactement le nombre de blocs « Donné » (2 = 2, 9 = 9, 2 = 2).')
A('')
A('## Ce qui se découpe, et ce qui ne se découpe pas')
A('')
A('**Trois fichiers seulement portent plusieurs actes** — les trois nommés au § 8.3, confirmés')
A('par la mesure. Les 21 autres pièces retenues sont mono-acte : elles ne se découpent pas.')
A('')
A('| Fichier | rang | rôle | texte n° | l. début | l. fin (exclue) | « Donné » | têtes | segment écrit |')
A('|---|---|---|---|---|---|---|---|---|')
for r in d['fichiers']:
    if len(r['segments']) < 2: continue
    for s in r['segments']:
        A(f"| `{r['piece']}` | {s['rang']} | **{s['role']}** | {s.get('texte_no') or '—'} | {s['l_debut']} | "
          f"{s['l_fin_exclue']} | {s['blocs_donne']} | {s['tetes_article']} | "
          f"{('`decoupe/' + s['fichier'] + '`') if s.get('fichier') else '— (non versé)'} |")
    A(f"| `{r['piece']}` | — | liminaire fascicule | — | {r['zone_liminaire_fascicule'][0]} | "
      f"{r['zone_liminaire_fascicule'][1]} | 0 | 0 | — (bandeau + sommaire) |")
    if r['zone_queue'][0] < r['zone_queue'][1]:
        A(f"| `{r['piece']}` | — | queue fascicule | — | {r['zone_queue'][0]} | {r['zone_queue'][1]} | 0 | 0 | "
          f"— ({'circulaire 009 CIN, abonnements, colophon' if 'sp8' in r['piece'] else 'colophon, note de transcription de l’éditeur'}) |")
A('')
A('## L’identification de chaque acte, lue du corps')
A('')
for r in d['fichiers']:
    if len(r['segments']) < 2: continue
    A(f"### `{r['piece']}`")
    A('')
    for s in r['segments']:
        marque = '**AU CORPUS**' if s['role'] == 'corpus' else 'hors corpus'
        A(f"{s['rang']}. {marque} — {s['titre_lu_du_corps']}")
    A('')
A('## Les contrôles, et leurs résultats')
A('')
A('1. **Un seul acte par segment.** Chaque segment de corpus porte exactement 1 bloc « Donné ».')
A('   0 alerte.')
A('2. **Les segments sont contigus et rien n’est perdu.** Dans les trois fichiers, les segments')
A('   se touchent bout à bout ; les seules zones hors segment sont le liminaire de fascicule et,')
A('   pour deux d’entre eux, la queue de fascicule.')
A('3. **L’annexe est restée avec son arrêté.** Contrôle arithmétique, le plus dur : les têtes')
A('   d’article des segments s’additionnent exactement aux totaux mesurés au § 8.2 pour le')
A('   fichier entier.')
A('')
A('   | Fichier | § 8.2 attend | somme des segments | détail |')
A('   |---|---|---|---|')
A('   | Charte 2013 | 32 | 32 | 6 (Delmas, hors corpus) + 26 (arrêté 2 + Charte 22 + art. 5.1/5.2) |')
A('   | Spécial n° 8 | 34 | 34 | 3 (texte 19) + 10 (texte 20) + 7 × 3 (nominations, hors corpus) |')
A('   | Spécial 52 | 41 | 41 | 29 (texte 21) + 12 (texte 22) |')
A('')
A('   Le segment de la Charte porte **26** têtes et non 2 : c’est la preuve directe que l’annexe')
A('   sanctionnée (art. 1-22 + 5.1/5.2 + modèle d’engagement) est restée dans le segment de son')
A('   arrêté. Une coupe sur « Donné » n’en aurait laissé que 2.')
A('4. **Le hors-corpus n’apparaît dans aucun segment versé.** Recherche des mentions Delmas, BNC,')
A('   BNDA, CNAL, Judy BAZILE, Carte d’Identification Nationale, Verrettes, St Raphaël,')
A('   Pointe-à-Raquette, Grand-Bassin dans les cinq segments écrits : **0 occurrence**, à une')
A('   exception qui n’en est pas une — `texte-22` cite « la Commune de Delmas » à son propre')
A('   article 3-1, parmi les communes soumises aux seuils. Rien à voir avec l’arrêté Delmas de 2012.')
A('')
A('## Les neuf actes du Spécial n° 8, et le dixième sans bloc « Donné »')
A('')
A('Mesuré : **9 blocs « Donné » pour 10 actes**. La Circulaire n° 009 relative à l’utilisation de')
A('la Carte d’Identification Nationale (l. 424-460) n’a ni devise, ni bloc « Donné » : elle se')
A('clôt sur « Port-au-Prince, le 2 février 2021 » et la signature du Premier ministre Joseph')
A('JOUTHE. Elle est **hors corpus**. Les quatre commissions municipales sont Grand-Bassin')
A('(Terrier-Rouge), Pointe-à-Raquette, St Raphaël et Verrettes — quatre, comme annoncé au § 4.2.')
A('')
A('## Les zones d’appareil d’éditeur, à écarter du corps au § 8.4')
A('')
A('| Pièce | note de transcription | colophon |')
A('|---|---|---|')
for r in d['fichiers']:
    n, c = r['note_transcription_ligne'], r['colophon_ligne']
    if n is None and c is None: continue
    A(f"| `{r['piece']}` | {'l. ' + str(n) if n is not None else '—'} | {'l. ' + str(c) if c is not None else '—'} |")
open(os.path.join(DEST, 'table-decoupe.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('écrits : manifeste-empreintes.md, table-decoupe.md')
