# -*- coding: utf-8 -*-
"""
Producteur de `oracle-index-cliente.json` — l'oracle du § 8.

    cd <racine du dépôt> && python3 scripts/data/decret-ir-2005/oracle_index.py

Défaut D13 du contrôle du 25 août : ce fichier n'avait AUCUN producteur — rien, nulle part,
ne le régénérait. Le voici.

L'index de la cliente (`piece-index-cliente.txt`, extrait du .docx par `extraire_docx.py`)
est la seule pièce indépendante que la plateforme possède sur ce décret : établi à la main
sur le Journal officiel authentique, JAMAIS dérivé de la base. C'est ce qui en fait un
oracle — il n'a pas pu hériter des erreurs qu'on cherche.

⚠️ Il ne remplace ni ne complète l'index en base (369 sujets, couverture 191/191) :
interdit n° 2 du prompt. Il sert de PIÈCE DE CONTRÔLE, rien d'autre.

Découpage : « <Mot-clé> — art. N, N, N ». Le séparateur est espace + U+2014 + espace. Dans
le .docx la coupure est machine-sûre (le mot-clé est un run en gras) ; sur le .txt on
retombe sur le séparateur, qui suffit : 52/52 entrées se découpent proprement, la seule
ligne non conforme étant l'en-tête ¶3.
"""
import json
import os
import re

DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DIR, 'piece-index-cliente.txt')
OUT = os.path.join(DIR, 'oracle-index-cliente.json')

SEP = ' — '                       # espace + tiret cadratin + espace
LETTRE = re.compile(r'^[A-ZÀ-Ý]$')     # les 16 lignes de lettre d'index (« A », « B », …)
NUM = re.compile(r'\b(\d{1,3})\b')
PREAMBULE = re.compile(r'\bpréambule\b', re.I)

lignes = open(SRC, encoding='utf-8').read().split('\n')

# ⚠️ Les TROIS lignes de tête sont écartées par leur RANG, pas par leur forme : la 3ᵉ
# (« Le Moniteur, Numéro Spécial No. 10 … — index établi sur les articles 1 à 126… »)
# contient elle aussi le séparateur « — » et se découperait en fausse entrée, avec un
# renvoi fantôme vers les articles 10, 160, 2005, 1 et 126. C'est la seule ligne non
# conforme du fichier ; dans le .docx elle se distingue par son absence de run en gras.
TETE = 3
entrees = []
for i, brut in enumerate(lignes, start=1):
    l = brut.strip()
    if i <= TETE or not l or LETTRE.match(l):
        continue
    if SEP not in l:
        raise AssertionError(f'ligne {i} sans séparateur « — » : {l!r}')
    sujet, queue = l.split(SEP, 1)
    refs = [int(n) for n in NUM.findall(queue)]
    entrees.append(dict(ligne=i, sujet=sujet.strip(), queue=queue.strip(),
                        refs=refs, preambule=bool(PREAMBULE.search(queue))))

renvois = sum(len(e['refs']) for e in entrees)
distincts = sorted({n for e in entrees for n in e['refs']})
hors = [n for n in distincts if n < 1 or n > 126]

# ── Gardes : l'oracle n'a de valeur que si sa lecture se rejoue à l'identique ──
assert len(entrees) == 52, f'{len(entrees)} entrées, attendu 52'
assert renvois == 500, f'{renvois} renvois, attendu 500'
assert len(distincts) == 115, f'{len(distincts)} numéros distincts, attendu 115'
assert max(distincts) == 126, f'maximum cité {max(distincts)}, attendu 126'
assert hors == [], f'renvois hors de 1..126 : {hors}'
assert sum(1 for e in entrees if e['preambule']) == 4, 'attendu 4 entrées renvoyant au Préambule'

# Les 11 articles de 1..126 qu'aucune entrée ne cite — recomptés, pas recopiés.
non_cites = [n for n in range(1, 127) if n not in set(distincts)]
assert non_cites == [2, 6, 11, 12, 14, 18, 25, 40, 61, 102, 121], f'non cités : {non_cites}'

data = dict(
    _lisezMoi=(
        'ORACLE § 8 — index des mots-clés de la cliente '
        '(Index_Mots_Cles_Decret_2005_Impot_sur_le_Revenu.docx, 71 ¶), établi à la main sur le J.O. '
        'authentique et JAMAIS dérivé de la base. Sert de pièce de contrôle indépendante : il ne '
        'remplace ni ne complète l’index en base (369 sujets), interdit n° 2. Découpage : mot-clé = '
        'tête de ligne, queue = « — art. … » (séparateur espace + U+2014 + espace).'),
    _produitPar='scripts/data/decret-ir-2005/oracle_index.py',
    source='piece-index-cliente.txt (Index_Mots_Cles_Decret_2005_Impot_sur_le_Revenu.docx, 71 ¶, extraction extraire_docx.py)',
    _commentMesurer=(
        'Pour chacun des 500 renvois : le radical du mot-clé doit se trouver dans le texte de '
        'l’article cité, dans le corps CORRIGÉ. Trois lectures — juste avant / faux après = on a '
        'cassé quelque chose (bloquant) ; faux avant / juste après = coquille réparée ; faux des '
        'deux côtés = à examiner à la main (consolidation légitime ou défaut résiduel). L’oracle ne '
        'couvre PAS les articles 127 à 189 : aucune mesure de couverture n’y est possible.'),
    _reserves=[
        '63-1 et 63-2 ne sont jamais cités : l’index les rabat sur « 63 ». Preuve : « Secret '
        'professionnel / secret bancaire — art. 63, 83 », alors que le mot « secret » est absent de '
        'l’article 63 et présent dans le 63-1.',
        '11 articles de la plage 1-126 ne sont cités par aucune entrée : ' +
        ', '.join(str(n) for n in non_cites) + '.',
        '4 entrées renvoient au « Préambule ». Ce n’est pas un numéro d’article : porté tel quel '
        'dans des ctRefs il produit « #art-Préambule », lien mort. Le canal correct est l’ancre de '
        'l’entrée de sommaire du préambule (voir toc-cible.json).',
        'Une plage du SOMMAIRE (pas de l’index) est fausse : « Sous-section V — … (articles 43 à '
        '67) » annonce 25 articles là où le corps en porte 27, parce que le sommaire ignore 63-1 et '
        '63-2. Écart attendu, pas un défaut.',
    ],
    mesures=dict(
        entrees=len(entrees),
        renvois=renvois,
        numeros_distincts=len(distincts),
        maximum_cite=max(distincts),
        renvois_hors_1_126=len(hors),
        entrees_renvoyant_au_preambule=sum(1 for e in entrees if e['preambule']),
        articles_de_1_a_126_non_cites=non_cites,
    ),
    entrees=entrees,
)

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')

print('écrit :', OUT, os.path.getsize(OUT), 'octets')
print(f'{len(entrees)} entrées · {renvois} renvois · {len(distincts)} numéros distincts · max {max(distincts)}')
print('articles 1-126 non cités :', non_cites)
