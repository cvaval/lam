#!/usr/bin/env python3
"""
LES TROIS LOIS DE 2007 SUR LA MAGISTRATURE — transcriptions intégrales du Journal Officiel.

Le recueil du Code de procédure civile en donnait des versions AMPUTÉES : il tronquait le
dernier article des trois (la disposition abrogatoire ou d'exécution) et, pour la loi créant
le Conseil Supérieur du Pouvoir Judiciaire, il manquait les articles 6 à 25 — son auteur le
signalait lui-même en note : « Lacune de numérisation — la page 308 de l'exemplaire source
est absente (probable numérisation recto seul) ». Ces transcriptions comblent le tout.

Source : Le Moniteur, 162ᵉ année n° 112, Port-au-Prince, jeudi 20 décembre 2007.

Ce qui est RETENU du fascicule : les visas, les considérants, la formule d'adoption, le
corps des articles, les blocs de signature et la promulgation — en français ET en créole,
telle que le Journal Officiel la publie.
Ce qui est ÉCARTÉ : le bandeau du Moniteur (il devient `moniteurRef`), les filets d'astérisques,
le colophon des Presses Nationales, et la « note d'audit éditorial » du transcripteur — dont
les anomalies relevées sur le texte IMPRIMÉ sont en revanche reportées en annotation sur les
articles qu'elles concernent : le lecteur doit savoir qu'une bizarrerie vient du J.O. lui-même.

⚠️ Deux formes de division coexistent : la désignation seule sur sa ligne, suivie de sa
légende en capitales (« TITRE I » / « DES DISPOSITIONS GENERALES »), et la forme d'un seul
tenant (« CHAPITRE I : DES PRINCIPES GÉNÉRAUX »). Ne traiter que la seconde perd les deux
tiers des divisions.

⚠️ Les en-têtes sont ponctués « Article 1 : » au Journal Officiel. Ils sont ramenés à la
forme « Article 1er.- » employée partout ailleurs sur la plateforme : l'ancre serait la même
dans les deux cas, mais le lecteur passe d'un texte annexé à l'autre.

    python3 scripts/data/cpc/parse_magistrature.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_appendice import paragraphes  # noqa: E402

DIR = os.path.dirname(os.path.abspath(__file__))

FICHIERS = [
    ('1_Loi_portant_Statut_de_la_Magistrature_2007.docx', 'CPC_APPENDICE_I_A_7_1',
     'Loi du 27 novembre 2007 portant Statut de la Magistrature', 71),
    ('2_Loi_relative_a_l_Ecole_de_la_Magistrature_EMA_2007.docx', 'CPC_APPENDICE_I_A_7_2',
     'Loi du 15 novembre 2007 relative à l’École de la Magistrature', 51),
    ('3_Loi_creant_le_Conseil_Superieur_du_Pouvoir_Judiciaire_2007.docx', 'CPC_APPENDICE_I_A_7_3',
     'Loi du 13 novembre 2007 créant le Conseil Supérieur du Pouvoir Judiciaire', 42),
]

MONITEUR = 'Le Moniteur, 162ᵉ année n° 112 du jeudi 20 décembre 2007'

TETE = re.compile(r'^Article\s+(premier|\d{1,4})(?:er)?\s*:\s*(.*)$', re.I)
DIV_SEULE = re.compile(r'^(TITRE|SOUS-TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+([IVXLC]+|\d+|PREMIER)\s*:?\s*$', re.I)
# ⚠️ La ponctuation varie jusque dans un même texte : « CHAPITRE I : … », « TITRE II — … »
# et « Section I.- Recrutement par la voie de l'Ecole… ». Omettre le point détache cette
# dernière du sommaire — et une division absente du sommaire est pire qu'invisible : le
# lecteur y verrait « Section I » comme une tête d'ARTICLE et lui donnerait l'ancre art-1.
DIV_PLEINE = re.compile(r'^(TITRE|SOUS-TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+([IVXLC]+|\d+|PREMIER)\s*[:.—–-]+\s*\S', re.I)
# En-tête sans désignation, en capitales : « DISPOSITION FINALE », « DISPOSITIONS TRANSITOIRES ».
DIV_NUE = re.compile(r'^DISPOSITIONS?\s+[A-ZÉÈÀÊÎÔÛÇ]{4,}\s*$')
NIVEAU = {'TITRE': 1, 'SOUS-TITRE': 2, 'CHAPITRE': 2, 'SECTION': 3, 'SOUS-SECTION': 4}

# Apparat du fascicule, hors texte de loi
REJET = re.compile(r'^(\*[\s*]*$|Presses Nationales|Boîte Postale|Dépôt Légal)')
PUCE = re.compile(r'^[•·]\s*')


def anomalies(ps, debut):
    """Anomalies du texte IMPRIMÉ relevées par le transcripteur → {ancre: [notes]} + générales.

    Seule la rubrique « Anomalies du texte imprimé — conservées telles quelles » est reprise :
    les corrections de reconnaissance optique sont déjà appliquées et les notes de mise en
    forme ne concernent pas le lecteur.
    """
    par_article, generales = {}, []
    i = next((k for k in range(debut, len(ps)) if re.match(r'^2\.\s*Anomalies', ps[k])), None)
    if i is None:
        return par_article, generales
    for p in ps[i + 1:]:
        if re.match(r'^3\.\s', p):
            break
        if not PUCE.match(p):
            continue
        note = PUCE.sub('', p).strip()
        nums = re.findall(r'\d{1,4}', re.match(r'^Art\.?\s+([\d\s,et-]+)\s*:', note).group(1)) \
            if re.match(r'^Art\.?\s+([\d\s,et-]+)\s*:', note) else []
        if nums:
            corps = re.sub(r'^Art\.?\s+[\d\s,et-]+\s*:\s*', '', note)
            for n in nums:
                par_article.setdefault(f'art-{n}', []).append(corps)
        else:
            generales.append(note)
    return par_article, generales


def main():
    sortie = []
    for fichier, source, titre, attendu in FICHIERS:
        ps = paragraphes(fichier)
        debut = next(i for i, p in enumerate(ps) if p.startswith('LIBERT'))
        fin = next(i for i, p in enumerate(ps) if p.startswith('NOTE D’AUDIT'))
        par_art, generales = anomalies(ps, fin)

        lignes, toc, labels = [], [], {}
        saut = False
        for k in range(debut, fin):
            if saut:
                saut = False
                continue
            p = ps[k]
            if REJET.match(p):
                continue
            m = DIV_SEULE.match(p)
            if m:
                # Désignation seule : sa légende est la ligne suivante, en capitales.
                legende = ps[k + 1] if k + 1 < fin else ''
                if legende and not TETE.match(legende) and legende == legende.upper():
                    p, saut = f'{p.rstrip(" :")} — {legende}', True
                toc.append({'level': NIVEAU[m.group(1).upper()], 'label': p,
                            'anchor': f'sec-{len(toc) + 1}', 'kind': m.group(1).lower()})
                lignes.append(p)
                continue
            m = DIV_PLEINE.match(p)
            if m:
                toc.append({'level': NIVEAU[m.group(1).upper()], 'label': p,
                            'anchor': f'sec-{len(toc) + 1}', 'kind': m.group(1).lower()})
                lignes.append(p)
                continue
            if DIV_NUE.match(p):
                toc.append({'level': 1, 'label': p, 'anchor': f'sec-{len(toc) + 1}', 'kind': 'titre'})
                lignes.append(p)
                continue
            t = TETE.match(p)
            if t:
                n = '1' if t.group(1).lower() == 'premier' else t.group(1)
                lib = 'Article 1er' if n == '1' else f'Article {n}'
                if f'art-{n}' in labels:
                    raise SystemExit(f'✗ {fichier} : article {n} en double')
                labels[f'art-{n}'] = lib
                lignes.append(f'{lib}.- {t.group(2)}'.rstrip())
                continue
            lignes.append(p)

        nums = sorted(int(a.replace('art-', '')) for a in labels)
        manquants = [n for n in range(1, max(nums) + 1) if n not in nums]
        if manquants:
            raise SystemExit(f'✗ {fichier} : articles manquants {manquants}')
        if len(nums) != attendu:
            raise SystemExit(f'✗ {fichier} : {len(nums)} articles, {attendu} attendus')
        orphelines = [a for a in par_art if a not in labels]
        if orphelines:
            raise SystemExit(f'✗ {fichier} : note d’anomalie sur un article inexistant {orphelines}')

        sortie.append({
            'source': source, 'titre': titre, 'moniteur': MONITEUR,
            'corps': '\n'.join(lignes).strip(), 'toc': toc, 'labels': labels,
            'anomalies': par_art, 'anomaliesGenerales': generales,
        })
        print(f'{titre[:56]:58} {len(nums):3} art. (1→{max(nums)}) · {len(toc):2} divisions · '
              f'{len(par_art)} art. annotés · {len(generales)} notes générales')

    json.dump(sortie, open(f'{DIR}/magistrature.json', 'w'), ensure_ascii=False, indent=1)
    print(f'\n→ {DIR}/magistrature.json')


if __name__ == '__main__':
    main()
