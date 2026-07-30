#!/usr/bin/env python3
"""
APPENDICE du Code de procédure civile → un document PAR TEXTE ANNEXÉ.

L'Appendice réunit des textes autonomes (décrets, lois, arrêtés) qui RENUMÉROTENT chacun
à partir de 1 : les verser dans un seul corps ferait entrer en collision 1 678 ancres
d'article. On en fait donc des documents distincts, comme pour la compilation notariale.

Le SOMMAIRE fait autorité : il liste chaque texte annexé, précédé d'un tiret cadratin, sous
sa rubrique cotée (« I.A.1.- Organisation du Ministère de la Justice »). On y prend la liste
et les cotes ; le corps fournit le texte.

⚠️ La forme de l'en-tête d'article distingue à elle seule les deux ensembles — l'auteur du
document l'a harmonisée : « Art. 21.- » pour un texte annexé, « Article 21.- » pour le Code.

⚠️ Lacunes signalées par l'auteur, à vérifier sur le Moniteur (reportées telles quelles) :
  · Loi du 13 novembre 2007 (Conseil supérieur du pouvoir judiciaire) : saute de l'art. 5 à 26 ;
  · Arrêté du 27 septembre 1985 (tarif judiciaire) : Titre I et Titre II partiels seulement ;
  · Loi du 7 avril 1998 (réforme judiciaire) : chapitres sans en-tête.

Produit appendice.json : [{cote, titre, moniteur, corps, articles, divisions}].
    python3 scripts/data/cpc/parse_appendice.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))

# Cote de rubrique, parfois entre crochets : « [I.A.7.- La magistrature] »
RUBRIQUE = re.compile(r'^\[?([IVX]+(?:\.[A-Z])?(?:\.\d+(?:\s*bis)?)*)\.\-\s*(.+?)\]?$')
ART = re.compile(r'^Art\.?\s+(\d{1,4}(?:er)?(?:-\d{1,2})?)\s*(?:\(([^)]*)\))?\s*\.\-\s*(.*)$')
DIVISION = re.compile(r'^(Titre|Chapitre|Section|Sous-section|Sous-titre|Première partie|'
                      r'Deuxième partie|Troisième partie|Quatrième partie)\b', re.I)
MONITEUR = re.compile(r'^(Mon(?:iteur)?\.?\s*(?:No|N°|n°)|Le Moniteur)', re.I)
NOTE = re.compile(r'^\[\s*Note d’[ée]dition')

# Titre d'un texte annexé. Trois formes coexistent dans le sommaire comme dans le corps —
# les confondre coûte cher : ne retenir que le tiret perd 55 des 114 textes.
#   « — Décret du 30 mars 1984 … »            (tiret cadratin)
#   « 1°) Loi du 4 juillet 1974 … »           (numérotation dans une rubrique multi-textes)
#   « Loi du 27 novembre 2007 portant … »     (nu, sous une rubrique entre crochets)
# S'y ajoutent un titre tout en CAPITALES et un libellé de rubrique suivi du texte
# (« 6°) Fermage et loyer des biens de l’État — Décret du 22 sept 1964 … »).
TYPE = (r'(?:D[ée]cret-?\s?loi|D[ée]cret|Loi|Arr[êe]t[ée]|Constitution|Ordonnance|Circulaire|'
        r'R[èe]glement|Code)')
TITRE = re.compile(rf'^(?:—\s*)?(?:\d+°\)\s*)?(?:[^—]{{0,80}}—\s*)?({TYPE}\b.*)$', re.I)


def titre_texte(ligne):
    """Titre de texte annexé porté par la ligne, sinon None."""
    if len(ligne) > 400 or DIVISION.match(ligne):
        return None
    m = TITRE.match(ligne)
    return m.group(1).strip() if m else None


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())[:70]


def main():
    corps_doc = paragraphes('CPC_cumule_corrige.docx')
    a = next(i for i, p in enumerate(corps_doc) if p.strip() == 'APPENDICE')
    b = next((i for i, p in enumerate(corps_doc) if i > a and re.match(r'^JURISPRUDENCE', p, re.I)),
             len(corps_doc))
    app = corps_doc[a + 1:b]

    # ── Liste autoritaire : le sommaire ──
    som = paragraphes('CPC_cumule_sommaire_integral_1.docx')
    i = next(k for k, p in enumerate(som) if re.match(r'^APPENDICE', p, re.I))
    j = next((k for k, p in enumerate(som) if k > i and re.match(r'^JURISPRUDENCE', p)), len(som))
    titres_som, cote, rubriques = [], None, 0
    for p in som[i:j]:
        m = RUBRIQUE.match(p)
        if m and len(p) < 200:
            cote, rubriques = m.group(1), rubriques + 1
            continue
        t = titre_texte(p)
        if t:
            titres_som.append((cote, t))
    print(f'sommaire : {rubriques} rubriques · {len(titres_som)} textes annexés listés')

    # ── Repérage dans le corps ──
    voulus = {norm(t): (c, t) for c, t in titres_som}
    reperes, vus = [], set()
    cote_corps = None
    for k, p in enumerate(app):
        m = RUBRIQUE.match(p)
        if m and len(p) < 200:
            cote_corps = m.group(1)
            continue
        t = titre_texte(p)
        n = norm(t) if t else None
        if n in voulus and n not in vus:
            vus.add(n)
            reperes.append({'i': k, 'cote': voulus[n][0] or cote_corps, 'titre': voulus[n][1]})
    print(f'corps    : {len(reperes)} retrouvés')
    for c, t in titres_som:
        if norm(t) not in vus:
            print(f'  ⚠ introuvable dans le corps : [{c}] {t[:82]}')

    # ── Découpe ──
    textes = []
    for n, r in enumerate(reperes):
        fin = reperes[n + 1]['i'] if n + 1 < len(reperes) else len(app)
        bloc = app[r['i']:fin]
        moniteur = bloc[1] if len(bloc) > 1 and MONITEUR.match(bloc[1]) else None
        lignes, toc, labels, amendes = [], [], {}, {}
        for l in bloc[1:]:
            if moniteur and l == moniteur:
                continue
            if RUBRIQUE.match(l) and len(l) < 200:
                continue  # cote d'une rubrique voisine : hors du texte
            if NOTE.match(l):
                continue  # note d'édition
            if DIVISION.match(l) and len(l) < 160:
                lignes.append(l)
                toc.append({'level': 1, 'label': l, 'anchor': f'sec-{len(toc) + 1}',
                            'kind': l.split()[0].lower()})
                continue
            am = ART.match(l)
            if am:
                num = am.group(1).replace('er', '') if am.group(1).endswith('er') else am.group(1)
                lib = 'Article 1er' if num == '1' else f'Article {num}'
                mention = am.group(2)
                lignes.append(f'{lib}{f" ({mention})" if mention else ""}.- {am.group(3)}'.rstrip())
                labels[f'art-{num}'] = lib
                if mention:
                    amendes[f'art-{num}'] = mention.strip()
                continue
            lignes.append(l)
        if not labels:
            continue  # rubrique sans article : rien à publier séparément
        textes.append({
            'cote': r['cote'], 'titre': r['titre'], 'moniteur': moniteur,
            'corps': '\n'.join(lignes), 'toc': toc, 'labels': labels, 'amendes': amendes,
        })

    json.dump(textes, open(f'{DIR}/appendice.json', 'w'), ensure_ascii=False, indent=1)
    tot = sum(len(t['labels']) for t in textes)
    print(f'\ntextes retenus (au moins un article) : {len(textes)}')
    print(f'articles au total                    : {tot}')
    gros = sorted(textes, key=lambda t: -len(t['labels']))[:5]
    print('les plus étoffés :')
    for t in gros:
        print(f'  {len(t["labels"]):4} art. · {t["cote"] or "—":10} {t["titre"][:66]}')
    sans_mon = sum(1 for t in textes if not t['moniteur'])
    print(f'sans référence au Moniteur           : {sans_mon}')
    print(f'\n→ {DIR}/appendice.json')


if __name__ == '__main__':
    main()
