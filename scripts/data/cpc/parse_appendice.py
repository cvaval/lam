#!/usr/bin/env python3
"""
APPENDICE du Code de procédure civile → un document PAR RUBRIQUE.

⚠️ L'Appendice n'est PAS une collection de 114 textes autonomes, malgré ce que suggère son
décompte. Sa colonne vertébrale est la RUBRIQUE thématique cotée (« IV.1.- La déclaration
tardive de naissance ») ; sous chacune, le compilateur reproduit les articles utiles d'un ou
plusieurs textes. La MÊME loi revient dans plusieurs rubriques avec des articles différents :
la loi du 20 août 1974 sur l'état civil paraît sous III.6.1 (art. 4), IV.1 (art. 26), IV.2
(art. 28), IV.3… Publier « un document par texte » agglomérerait ces extraits épars et
laisserait croire qu'on détient le texte entier. On publie donc la rubrique, unité que le
recueil a lui-même conçue comme cohérente.

Titre du document : le titre du texte annexé quand la rubrique n'en reproduit qu'un
(le cas des trois quarts) ; à défaut, l'intitulé de la rubrique.

Le SOMMAIRE fait autorité pour la liste des rubriques (92) et des textes (114). Le corps en
contient deux de plus, qui sont des faux positifs — du texte d'article commençant par « I.- »
(« I.- La Plaine de Desdunes comprend la section rurale de 2ème Desdunes. »). Apparier sur le
sommaire les élimine.

⚠️ Trois formes de titre de texte coexistent ; ne retenir que le tiret cadratin perd 55 des
114 textes. Voir TITRE.

⚠️ Deux formes d'en-tête d'article échappent au motif ordinaire, toutes deux venant de la
Constitution de 1987 reproduite en appendice : la mention de source SANS parenthèses
(« Art 269 Const du 29 mars 1987.- ») et le décimal À POINT (« Art 200.1.- »). Elles valent
12 articles — exactement l'écart entre 1 666 et les 1 678 annoncés.

La forme abrégée « Art. N.- » est CONSERVÉE telle quelle : `articleAnchorFromHeading` la
reconnaît et en tire la même ancre que « Article N.- ». Moins on transforme, moins on abîme.

⚠️ Lacunes signalées par l'auteur, à vérifier sur le Moniteur (reportées telles quelles) :
  · Loi du 13 novembre 2007 (Conseil supérieur du pouvoir judiciaire) : saute de l'art. 5 à 26 ;
  · Arrêté du 27 septembre 1985 (tarif judiciaire) : Titre I et Titre II partiels seulement ;
  · Loi du 7 avril 1998 (réforme judiciaire) : chapitres sans en-tête.

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

# En-tête d'article. Le groupe 2 recueille la mention de modification ou de source, qu'elle
# soit entre parenthèses — « Art 26 (L. 27 août 1980).- » — ou nue — « Art 269 Const du
# 29 mars 1987.- ». Le numéro admet le décimal à tiret (957-1) comme à point (200.1).
ART = re.compile(r'^Art\.?\s+(\d{1,4}(?:er)?(?:[-.]\d{1,2})?)\s*'
                 r'(?:\(([^)]*)\)|((?:Const|L\.|D\.|A\.)[^.]{0,44}))?\s*\.\-\s*(.*)$')

# ⚠️ Sous-article constitutionnel écrit « Art. 269.-1 » : `articleAnchorFromHeading` s'arrête
# au 269 et le rabat sur l'ancre de l'article 269, qui le précède immédiatement — deux
# articles pour une seule ancre. On rétablit la forme canonique « 269-1 » (celle qu'emploie
# déjà la Constitution de 1987 sur la plateforme), qui donne art-269-1.
SOUS_ART = re.compile(r'^(Art\.?\s+\d{1,4})\.\-(\d{1,2})\b')

DIVISION = re.compile(r'^(Titre|Chapitre|Section|Sous-section|Sous-titre|Livre|'
                      r'(?:Premi[èe]re|Deuxi[èe]me|Troisi[èe]me|Quatri[èe]me|Cinqui[èe]me)\s+partie|'
                      r'Dispositions\s+(?:principales|g[ée]n[ée]rales|transitoires|finales))\b', re.I)
MONITEUR = re.compile(r'^\(?(Mon(?:iteur)?\.?\s*(?:No|N°|n°)|Le Moniteur|Bulletin des Lois)', re.I)
NOTE = re.compile(r'^\[\s*Note d’[ée]dition')

# Titre d'un texte annexé. TROIS formes coexistent dans le sommaire comme dans le corps —
# les confondre coûte cher : ne retenir que le tiret perd 55 des 114 textes.
#   « — Décret du 30 mars 1984 … »            (tiret cadratin)
#   « 1°) Loi du 4 juillet 1974 … »           (numérotation d'une rubrique multi-textes)
#   « Loi du 27 novembre 2007 portant … »     (nu, sous une rubrique entre crochets)
# S'y ajoutent un titre tout en CAPITALES et un libellé suivi du texte
# (« 6°) Fermage et loyer des biens de l’État — Décret du 22 sept 1964 … »).
TYPE = (r'(?:D[ée]cret-?\s?loi|D[ée]cret|Loi|Arr[êe]t[ée]|Constitution|Ordonnance|Circulaire|'
        r'R[èe]glement|Code)')
TITRE = re.compile(rf'^(?:—\s*)?(?:\d+°\)\s*)?(?:[^—]{{0,80}}—\s*)?({TYPE}\b.*)$', re.I)
MARQUEUR = re.compile(r'^(?:—\s*|\d+°\)\s*)')


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)  # sans quoi les colonnes du J.O. se collent
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


def titre_texte(ligne):
    """Titre de texte annexé porté par la ligne, sinon None."""
    if len(ligne) > 400 or DIVISION.match(ligne) or ART.match(ligne):
        return None
    m = TITRE.match(ligne)
    return m.group(1).strip() if m else None


def sommaire():
    """(rubriques ordonnées, titres de textes) — la liste autoritaire."""
    som = paragraphes('CPC_cumule_sommaire_integral_1.docx')
    i = next(k for k, p in enumerate(som) if re.match(r'^APPENDICE', p, re.I))
    j = next((k for k, p in enumerate(som) if k > i and re.match(r'^JURISPRUDENCE', p)), len(som))
    rubs, titres, cote = [], [], None
    for p in som[i:j]:
        m = RUBRIQUE.match(p)
        if m and len(p) < 200:
            cote = m.group(1)
            rubs.append({'cote': cote, 'label': m.group(2).strip()})
            continue
        t = titre_texte(p)
        if t:
            titres.append((cote, t))
    return rubs, titres


def main():
    rubs, titres_som = sommaire()
    print(f'sommaire : {len(rubs)} rubriques · {len(titres_som)} textes annexés')
    attendus = {norm(t) for _, t in titres_som}

    corps = paragraphes('CPC_cumule_corrige.docx')
    a = next(i for i, p in enumerate(corps) if p.strip() == 'APPENDICE')
    b = next((i for i, p in enumerate(corps) if i > a and re.match(r'^JURISPRUDENCE', p)), len(corps))
    app = corps[a + 1:b]

    # ── Bornes des rubriques : appariées au sommaire, DANS L'ORDRE ──
    # Sans cet appariement, deux lignes de texte d'article commençant par « I.- » passeraient
    # pour des rubriques et couperaient le corps au mauvais endroit.
    bornes, ptr = [], 0
    for k, p in enumerate(app):
        m = RUBRIQUE.match(p)
        if not m or len(p) >= 200 or ptr >= len(rubs):
            continue
        if m.group(1) == rubs[ptr]['cote'] and norm(m.group(2))[:40] == norm(rubs[ptr]['label'])[:40]:
            bornes.append({**rubs[ptr], 'i': k})
            ptr += 1
    if ptr != len(rubs):
        manque = [r['cote'] for r in rubs[ptr:]]
        raise SystemExit(f'✗ rubriques non retrouvées dans le corps : {manque}')
    print(f'corps    : {len(bornes)}/{len(rubs)} rubriques appariées ✓')

    # ── Découpe : un document par couple (rubrique, texte) ──
    # ⚠️ NE JAMAIS fusionner deux extraits sur la foi d'un titre identique. Les trois « Loi du
    # 10 avril 2002 » de I.B.5, I.B.6 et I.B.7 sont trois lois DIFFÉRENTES, du même jour,
    # créant chacune un tribunal (Miragoâne, les Côteaux, la Croix-des-Bouquets) ; le sommaire
    # les abrège à leur date. Les fondre écraserait deux lois sur trois.
    docs, vus_titres, n_tetes = [], set(), 0

    def ouvrir(titre, cote, label):
        docs.append({'cote': cote, 'rubrique': label, 'titre': titre, 'moniteur': None,
                     'lignes': [], 'toc': [], 'labels': {}, 'mentions': {}})
        return docs[-1]

    for n, r in enumerate(bornes):
        fin = bornes[n + 1]['i'] if n + 1 < len(bornes) else len(app)
        bloc = app[r['i'] + 1:fin]
        cur, saut = None, 0
        for k, l in enumerate(bloc):
            if saut:
                saut -= 1
                continue
            if NOTE.match(l):
                continue
            t = titre_texte(l)
            if t:
                # Le corps coupe souvent le titre en DEUX paragraphes (« Décret du 29 sept
                # 1986 » / « créant une cour d’appel à Hinche ») ; le sommaire, lui, le donne
                # d'un seul tenant — ou au contraire l'abrège à sa date (les trois lois du
                # 10 avril 2002). On apparie sur le sommaire, mais on AFFICHE la lecture la
                # plus complète : une suite en minuscule ne peut être qu'une fin de titre.
                suite = bloc[k + 1] if k + 1 < len(bloc) else ''
                joint = f'{t} {suite}'.strip()
                suite_est_fin = bool(suite) and suite[:1].islower() and not (
                    ART.match(suite) or DIVISION.match(suite) or MONITEUR.match(suite))
                cle = norm(joint) if norm(joint) in attendus else norm(t)
                # Le sommaire n'est pas exhaustif : il omet l'extrait de la Constitution qui
                # ouvre II.A. Un titre qu'il ignore est néanmoins retenu s'il porte un
                # marqueur éditorial explicite (tiret cadratin ou « N°) ») — vérifié : ce
                # seul cas dans tout l'Appendice, aucun faux positif.
                if cle in attendus or MARQUEUR.match(l):
                    if norm(joint) in attendus or suite_est_fin:
                        t, saut = joint, 1
                    cur = ouvrir(t, r['cote'], r['label'])
                    vus_titres.add(cle)
                    continue
            if cur is None:
                # Articles ouvrant la rubrique sans ligne de titre : ce sont les extraits de
                # la Constitution de 1987 (I.A.5 « La police », IV.21 « légalité de
                # l'arrestation »). Le document prend l'intitulé de la rubrique.
                cur = ouvrir(r['label'], r['cote'], r['label'])
            if MONITEUR.match(l) and not cur['lignes']:
                cur['moniteur'] = l.strip('()')
                continue
            l = SOUS_ART.sub(r'\1-\2', l)
            am = ART.match(l)
            if am:
                n_tetes += 1
                num = re.sub(r'er$', '', am.group(1)).replace('.', '-')
                cur['lignes'].append(l)
                cur['labels'].setdefault(f'art-{num}', 'Article 1er' if num == '1' else f'Article {num}')
                if am.group(2) or am.group(3):
                    cur['mentions'].setdefault(f'art-{num}', (am.group(2) or am.group(3)).strip())
                continue
            if DIVISION.match(l) and len(l) < 200:
                cur['lignes'].append(l)
                cur['toc'].append({'level': 1, 'label': l, 'anchor': f'sec-{len(cur["toc"]) + 1}',
                                   'kind': l.split()[0].lower()})
                continue
            cur['lignes'].append(l)

    # Un titre qui revient (la loi de 1974 sur l'état civil, citée sous quatre rubriques)
    # est désambiguïsé par l'intitulé de sa rubrique — sinon la liste afficherait des
    # doublons indiscernables.
    freq = {}
    for d in docs:
        freq[d['titre']] = freq.get(d['titre'], 0) + 1
    for d in docs:
        d['corps'] = '\n'.join(d.pop('lignes')).strip()
        if freq[d['titre']] > 1:
            d['titre'] = f'{d["titre"]} — {d["rubrique"]}'
        # Bloc ouvrant sa rubrique sans ligne de titre : si TOUS ses articles portent la même
        # mention de source (« Const du 29 mars 1987 »), elle nomme le texte. On la reprend
        # plutôt que d'inventer un titre ou de laisser « La police » seule en tête de liste.
        if d['titre'] == d['rubrique'] and d['mentions'] and len(d['mentions']) == len(d['labels']):
            src = {re.sub(r'^Const\b', 'Constitution', m.strip(' .')) for m in d['mentions'].values()}
            if len(src) == 1:
                d['titre'] = f'{src.pop()} — {d["rubrique"]}'
    docs = [d for d in docs if d['labels']]

    json.dump(docs, open(f'{DIR}/appendice.json', 'w'), ensure_ascii=False, indent=1)

    perdus = [t for _, t in titres_som if norm(t) not in vus_titres]
    print(f'\ntextes du sommaire retrouvés : {len(attendus) - len(set(map(norm, perdus)))}/{len(attendus)}')
    for t in perdus:
        print(f'  ⚠ absent du corps : {t[:92]}')
    print(f'en-têtes d’article  : {n_tetes}')
    print(f'documents           : {len(docs)}')
    print(f'  ancres distinctes : {sum(len(d["labels"]) for d in docs)}')
    print(f'  à mention         : {sum(len(d["mentions"]) for d in docs)}')
    tail = sorted(len(d['labels']) for d in docs)
    print(f'  taille : médiane {tail[len(tail) // 2]} art. · max {tail[-1]} · 1 article : {tail.count(1)}')
    coll = [d['cote'] for d in docs if len(d['labels']) != sum(1 for l in d['corps'].split('\n') if ART.match(l))]
    print(f'  documents à numéro d’article répété : {len(coll)} {coll[:8]}')
    print(f'\n→ {DIR}/appendice.json')


if __name__ == '__main__':
    main()
