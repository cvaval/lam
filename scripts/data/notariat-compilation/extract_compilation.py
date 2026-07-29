#!/usr/bin/env python3
"""
Découpe NOTARIAT_compilation_revue.docx en TEXTES DISTINCTS.

La compilation réunit neuf blocs ; deux sont écartés et signalés :
  · le DÉCRET-LOI DU 27 NOVEMBRE 1969 — DOUBLON de la transcription autonome déjà traitée
    (scripts/data/notariat-1969/) ; sa transcription est ici de moindre qualité ;
  · la LOI DU 1er SEPTEMBRE 1951 SUR L'EXPROPRIATION — HORS SUJET (ni notariat, ni
    modificative), et réduite à son préambule.
La LOI DU 6 AVRIL 1880 sur les officiers de l'état civil n'a QUE son titre : rien à publier.

Produit textes.json : {slug: {titre, date, articles: [{num, text}], corps}}.
    python3 scripts/data/notariat-compilation/extract_compilation.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/NOTARIAT_compilation_revue.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# (slug, titre officiel, borne début, borne fin exclue, date, nb d'articles attendu)
TEXTES = [
    ('arrete-1919-examen',
     'Arrêté réglementant les détails de l’examen en Notariat et fixant le mode de versement '
     'et d’affectation du cautionnement',
     1, 25, '1919', 14),
    ('loi-1919-notariat',
     'Loi du 24 février 1919 sur le Notariat',
     25, 96, '1919-02-24', 46),
    ('loi-1862-notariat',
     'Loi du 21 août 1862 sur le Notariat',
     96, 108, '1862-08-21', 11),
    ('loi-1877-modificative',
     'Loi du 8 août 1877 modificative sur le Notariat',
     108, 113, '1877-08-08', 2),
    ('decret-loi-1941-etude-vacante',
     'Décret-loi du 20 juin 1941 sur le notaire dont l’étude est devenue vacante',
     114, 121, '1941-06-20', 2),
    ('decret-1974-nombre-notaires',
     'Décret du 30 septembre 1974 augmentant le nombre des notaires',
     224, 229, '1974-09-30', 2),
    ('decret-1986-nombre-notaires',
     'Décret du 9 juillet 1986 du Conseil National de Gouvernement fixant le nombre des notaires',
     233, 242, '1986-07-09', 2),
]

ECARTES = [
    ('DÉCRET-LOI DU 27 NOVEMBRE 1969', 121, 224,
     'DOUBLON — transcription autonome déjà traitée (scripts/data/notariat-1969/)'),
    ('LOI DU 6 AVRIL 1880 sur les officiers de l’état civil', 113, 114,
     'TITRE SEUL — aucun corps dans la compilation'),
    ('LOI DU 1er SEPTEMBRE 1951 sur l’expropriation', 229, 233,
     'HORS SUJET — étrangère au notariat, réduite à son préambule'),
]

# Coquilles sûres, propres à cette transcription (elle est plus abîmée que l'autre).
COQUILLES = [
    (r'\bJjustice\b', 'Justice'), (r'\biiotaires\b', 'notaires'), (r'\bnotaiiat\b', 'notariat'),
    (r'\bppur\b', 'pour'), (r'\binterdissant\b', 'interdisant'), (r'\bPublies\b', 'Publics'),
    (r'\bRFPUBLIQUE\b', 'RÉPUBLIQUE'), (r'\bPRESIDÉNT\b', 'PRÉSIDENT'), (r'\bNANPHY\b', 'NAMPHY'),
    (r'\bLicutenant\b', 'Lieutenant'), (r'\bJaeques\b', 'Jacques'), (r'\bFranQois\b', 'François'),
    (r'\bWilliarns\b', 'Williams'), (r'\bd\'offlce\b', 'd’office'), (r'\bdécés\b', 'décès'),
    (r'\bétre\b', 'être'), (r'\ban\. 32\b', 'art. 32'), (r'\bMAGLOIPE\b', 'MAGLOIRE'),
    (r'\barücle\b', 'article'), (r'\bConstiotution\b', 'Constitution'), (r'\bdérnontré\b', 'démontré'),
    (r'\bMiragoàne\b', 'Miragoâne'), (r'\bGoàve\b', 'Goâve'), (r'\bRiviére\b', 'Rivière'),
    (r'\bprofes:\s*sion\b', 'profession'), (r'\bTa Secrétairerie\b', 'La Secrétairerie'),
]


def paragraphes():
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()) for p in html.unescape(x).split('\n') if p.strip()]


def corriger(s):
    for rx, rep in COQUILLES:
        s = re.sub(rx, rep, s)
    # Apostrophe typographique UNIQUE : l'OCR mêle « ' » et « ’ », et la table ci-dessus
    # introduisait elle-même l'incohérence (« d'apposer d’office »).
    return s.replace("'", '\u2019')


def main():
    ps = [corriger(p) for p in paragraphes()]
    sortie = {}
    print(f'{"texte":34} {"¶":>9}  articles')
    for slug, titre, a, b, date, attendu in TEXTES:
        seg = ps[a:b]
        # Découpe en articles : une tête peut être incrustée en milieu de paragraphe.
        joint = '\n'.join(seg)
        # « Art 37- » : la forme ABRÉGÉE existe aussi (articles 37 et 38 de la loi de 1919).
        # Ne la pas admettre faisait perdre ces deux articles ET tous les suivants, le garde
        # séquentiel s'arrêtant au premier trou.
        reperes = [(int(m.group(1)), m.start(), m.end())
                   for m in re.finditer(r'(?<!l’)(?<!l\')(?<!du )(?<!L\')Art(?:icle)?\.?\s*(\d{1,3})\s*[.—-]+\s*', joint)]
        # Ne garder que la SÉQUENCE croissante depuis 1 (les « Article 32 » cités par un
        # texte modificatif ne sont pas des articles du texte porteur).
        garde, attendu_n = [], 1
        for n, s0, e0 in reperes:
            if n == attendu_n:
                garde.append((n, s0, e0))
                attendu_n += 1
        arts = []
        for i, (n, _, e0) in enumerate(garde):
            fin = garde[i + 1][1] if i + 1 < len(garde) else len(joint)
            arts.append({'num': str(n), 'text': re.sub(r'\s+', ' ', joint[e0:fin]).strip()})
        entete = joint[: garde[0][1]].strip() if garde else joint
        corps = entete + '\n' + '\n'.join(f'Article {a["num"]}. — {a["text"]}' for a in arts)
        sortie[slug] = {'titre': titre, 'date': date, 'articles': arts, 'corps': corps}
        drapeau = '✓' if len(arts) == attendu else f'⚠ attendu {attendu}'
        print(f'{slug:34} ¶{a:>3}–{b - 1:<4} {len(arts):3}  {drapeau}')

    json.dump(sortie, open(f'{DIR}/textes.json', 'w'), ensure_ascii=False, indent=1)
    print('\nBlocs ÉCARTÉS (signalés, non versés) :')
    for nom, a, b, motif in ECARTES:
        print(f'  · {nom}  (¶{a}–{b - 1})\n      {motif}')
    print(f'\n→ {DIR}/textes.json')


if __name__ == '__main__':
    main()
