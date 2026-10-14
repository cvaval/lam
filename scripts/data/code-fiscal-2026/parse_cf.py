"""Code fiscal 2026 (Le Moniteur Spécial N° 48-A) — corps, sommaire, index et tableaux du lecteur annoté.

    python3 -I scripts/data/code-fiscal-2026/parse_cf.py <décret.docx> <TABLES DES MATIÈRES.docx> <index.docx>

Écrit, dans ce dossier : bodyOriginal.txt, annotations.json, rich.json, piece-sommaire-cliente.txt,
piece-index-cliente.txt, et docs/livraison-code-fiscal-2026/index-a-valider.csv. Rien en base.

LE TEXTE DU JOURNAL OFFICIEL FAIT FOI, À LA LETTRE (consigne de Me Vaval, 13 oct. 2026).
- Le corps est le Word de la cliente, CORRIGÉ des seuls écarts que la collation mot à mot contre le
  fac-similé a établis sur l'image (corrections-jo.json ; docs/livraison-code-fiscal-2026/collation.csv).
  Les irrégularités du J.O. lui-même (pas d'art. 294, deux « Article 406 », rubrique C sans B,
  « 6, 6% », « inhalationautres »…) sont reproduites.
- Le corps commence à « LIBERTÉ ÉGALITÉ FRATERNITÉ » et finit à la dernière signature : la manchette
  et le sommaire du fascicule (10 premiers paragraphes) sont coupés, leurs références passent dans
  `moniteurRef` et la note de tête de la fiche.
- Les en-têtes de division se lisent souvent sur deux lignes (« TITRE I » / « PRÉALABLE COMMUN… »).
  On ne JOINT PAS les lignes du corps : le `toc` s'apparie sur la 1re ligne, les lignes suivantes
  entrent au `toc` sous le genre `suite` (même niveau, pas d'entrée au sommaire), et `navToc` porte
  le libellé réuni.
- Le sommaire HTML affiche des PLAGES D'ARTICLES calculées sur le corps, jamais des pages.
"""
import csv
import hashlib
import json
import os
import re
import sys
import unicodedata

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import extraire_docx  # noqa: E402
from xml.etree import ElementTree as ET  # noqa: E402
import zipfile  # noqa: E402

DEPOT = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
LIVRAISON = os.path.join(DEPOT, 'docs', 'livraison-code-fiscal-2026')

SHA_DECRET = '02193031afd76a0a2ea4b605a0ae788b42e01fc44d6174d35b1897164f8be074'
SHA_TOC = '5e58a5ab6341d4e3a1a4d0f8206571ff4ef0ddd22a82e92609d934dd8c9fa0cf'
SHA_INDEX = 'd07522fcb24f3ce0f62c7a04d3b9a0b8fbd41a1d09d7cb2ed1adffea808590dc'


def sha(f):
    return hashlib.sha256(open(f, 'rb').read()).hexdigest()


def items_of(docx):
    with zipfile.ZipFile(docx) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for ch in root.find(extraire_docx.W + 'body'):
        if ch.tag == extraire_docx.W + 'p':
            out.append(extraire_docx.para(ch))
        elif ch.tag == extraire_docx.W + 'tbl':
            out.append(extraire_docx.table(ch))
    return out


def fold(s):
    s = unicodedata.normalize('NFD', s.replace('’', "'").replace('œ', 'oe'))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def an(s):
    return re.sub(r'[^0-9a-zà-ÿœ]', '', s.replace('’', "'").lower())


HEAD = re.compile(r'^Article\s*(1er|\d{1,3})\s*\.')


def main(f_decret, f_toc, f_index):
    for f, h in ((f_decret, SHA_DECRET), (f_toc, SHA_TOC), (f_index, SHA_INDEX)):
        if sha(f) != h:
            sys.exit(f'⛔ {os.path.basename(f)} : empreinte inattendue — la pièce a changé, tout est à refaire.')

    # ── 1. Corps : le Word, corrigé d'après le fac-similé ─────────────────────────────────────
    items = items_of(f_decret)
    corr = json.load(open(os.path.join(ICI, 'corrections-jo.json'), encoding='utf8'))['corrections']
    for c in corr:
        t = items[c['para']]['text']
        if t.count(c['avant']) != 1:
            sys.exit(f"⛔ correction {c['id']} : « {c['avant']} » trouvé {t.count(c['avant'])} fois au paragraphe {c['para']}")
        items[c['para']]['text'] = t.replace(c['avant'], c['apres'])

    debut = next(i for i, x in enumerate(items) if x['k'] == 'p' and x['text'] == 'LIBERTÉ ÉGALITÉ FRATERNITÉ')
    fin = max(i for i, x in enumerate(items) if x['k'] == 'p' and x['text'].endswith('Pr. Vijonet DEMERO'))
    lignes = []  # (texte, rang de l'item)
    rich = []
    for i in range(debut, fin + 1):
        x = items[i]
        if x['k'] == 'p':
            if x['text']:
                lignes.append((x['text'], i))
            continue
        # Tableau : une ligne « cellule | cellule » par rangée (forme lue par AnnotatedText.splitRich),
        # et le tableau structuré dans richBlocksJson. Cellule vMerge « continue » = vide.
        rows = []
        for r, row in enumerate(x['rows']):
            cells = [('' if c['vmerge'] == 'continue' else c['text']) for c in row]
            lignes.append((' | '.join(cells), i))
            entete = r == 0 and all(c['b'] for c in row if c['text'])
            rows.append([
                {k: v for k, v in (('text', t), ('header', True if entete else None), ('colSpan', c['span'] if c['span'] > 1 else None)) if v is not None}
                for t, c in zip(cells, row)
            ])
        rich.append({'type': 'table', 'rows': rows, '_item': i})

    textes = [t for t, _ in lignes]
    if any('\t' in t for t in textes) or any(re.match(r'^Article\s*\d+\.-\S', t) for t in textes):
        sys.exit('⛔ tabulation ou tête collée « Article N.-Texte » dans le corps (bug <w:tab/>)')

    # ── 2. Têtes d'article ───────────────────────────────────────────────────────────────────
    tetes = []  # (ligne, numéro, ancre)
    vus = {}
    for k, t in enumerate(textes):
        m = HEAD.match(t)
        if not m:
            continue
        n = '1' if m.group(1) == '1er' else m.group(1)
        vus[n] = vus.get(n, 0) + 1
        ancre = f'art-{n}' if vus[n] == 1 else f'art-{n}-{vus[n]}'
        tetes.append((k, n, ancre))
    repetees = {f'art-{n}': [f'art-{n}-{j}' for j in range(2, c + 1)] for n, c in vus.items() if c > 1}

    # ── 3. Sommaire : les 419 entrées de la cliente, appariées au corps ───────────────────────
    toc_cli = [x['text'] for x in items_of(f_toc) if x['k'] == 'p' and x['text']]
    assert toc_cli[0] == 'TABLES DES MATIÈRES', toc_cli[0]
    toc_cli = [re.sub(r'\s*\d{1,3}$', '', s).strip() for s in toc_cli[1:]]  # pages : outil de travail, jamais affichées

    k0 = next(k for k, t in enumerate(textes) if t.startswith('LIVRE I :'))
    divisions = []  # (ligne, nb de lignes, libellé de la cliente)
    k = k0
    for e in toc_cli:
        ne = an(e)
        trouve = None
        for j in range(k, min(len(textes), k + 400)):
            if HEAD.match(textes[j]):
                continue
            acc = ''
            for m in range(4):
                if j + m >= len(textes):
                    break
                acc += an(textes[j + m])
                if acc == ne:
                    trouve = (j, m + 1)
                    break
                if not ne.startswith(acc):
                    break
            if trouve:
                break
        if not trouve:
            sys.exit(f'⛔ entrée du sommaire non retrouvée dans le corps : « {e} »')
        divisions.append((trouve[0], trouve[1], e))
        k = trouve[0] + trouve[1]
    assert len(divisions) == 419, len(divisions)

    def rang(lib, dans_conclusion):
        if lib.startswith('LIVRE'):
            return 1
        if lib.startswith('CONCLUSION'):
            return 2
        if re.match(r'^[A-ZÉÈ]+ PARTIE', lib):
            return 3 if dans_conclusion else 2
        if lib.startswith('SOUS-TITRE'):
            return 4
        if lib.startswith('TITRE'):
            return 3
        if lib.startswith('CHAPITRE'):
            return 5
        if lib.startswith('Section'):
            return 6
        if re.match(r'^[A-H]\. ', lib):
            return 7
        if re.match(r'^\d\. ', lib):
            return 8
        if re.match(r'^[ivx]+\. ', lib):
            return 9
        sys.exit(f'⛔ rang inconnu : « {lib} »')

    # Niveau d'AFFICHAGE dans le corps (AnnotatedText) : 1 = grand intertitre, 2 = intertitre en
    # capitales, 3 = section (seul niveau qui garde la casse), 4 = rubrique. Calqué sur le Code civil
    # (LOI 1 · CHAPITRE 2 · Section 3 · sous-section 4).
    NIVEAU = {1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 4, 8: 4, 9: 4}
    TITRES = ['LIBERTÉ ÉGALITÉ FRATERNITÉ', 'RÉPUBLIQUE D’HAÏTI', 'DÉCRET',
              'DÉCRET REMPLACANT LE DÉCRET DU 19 DÉCEMBRE 2022 PORTANT CODE FISCAL', 'DÉCRÈTE',
              'CODE FISCAL COMPRENANT LE CODE GÉNÉRAL DES IMPÔTS (CGI) ET LE LIVRE DES PROCÉDURES FISCALES (LPF)']
    entrees = []  # (ligne, label, level, kind, rang|None, n° de division|None)
    j = 0
    for t in TITRES:
        while textes[j] != t:
            j += 1
        entrees.append((j, t, 1, 'title', None, None))
        j += 1
    dans_conc = False
    for d, (ligne, nb, lib) in enumerate(divisions):
        if lib.startswith('CONCLUSION'):
            dans_conc = True
        r = rang(lib, dans_conc)
        entrees.append((ligne, textes[ligne], NIVEAU[r], 'code', r, d))
        for s in range(1, nb):
            entrees.append((ligne + s, textes[ligne + s], NIVEAU[r], 'suite', None, d))
    entrees.sort(key=lambda e: e[0])
    lignes_toc = [e[0] for e in entrees]
    assert len(set(lignes_toc)) == len(lignes_toc), 'deux entrées sur une même ligne'
    # Le libellé du toc doit être la ligne du corps elle-même (segmentAnnotated compare ligne à ligne).
    toc = []
    ancre_de_ligne = {}
    for n, (ligne, label, level, kind, _r, _d) in enumerate(entrees, start=1):
        toc.append({'level': level, 'label': label, 'anchor': f'sec-{n}', 'kind': kind})
        ancre_de_ligne[ligne] = f'sec-{n}'

    # Plages d'articles : du premier au dernier article situés entre l'en-tête et la division
    # suivante de rang égal ou supérieur. Un intervalle, pas une liste (293 à 295, 294 n'existant pas).
    def plage(ligne, r):
        fin_l = len(textes)
        suivantes = [e for e in entrees if e[3] == 'code' and e[0] > ligne and e[4] <= r]
        if suivantes:
            fin_l = suivantes[0][0]
        arts = [(n, a) for (l, n, a) in tetes if ligne < l < fin_l]
        if not arts:
            return None, None
        a, b = arts[0][0], arts[-1][0]
        if a == b:
            txt = f'art. {a}'
        elif len(arts) == 2 and int(b) == int(a) + 1:
            txt = f'art. {a} et {b}'
        else:
            txt = f'art. {a} à {b}'
        return txt, arts[0][1]

    def libelle(d):
        # « TITRE I » + « PRÉALABLE COMMUN… » → « TITRE I — PRÉALABLE COMMUN… » ; une 1re ligne
        # qui finit par « . » ou « : » (« SOUS-TITRE I. », « PREMIÈRE PARTIE : ») se joint par une
        # espace ; les lignes suivantes de l'intitulé se joignent par une espace.
        ligne, nb, _ = divisions[d]
        parts = [textes[ligne + s] for s in range(nb)]
        if nb == 1:
            return parts[0]
        sep = ' ' if re.search(r'[.:]$', parts[0]) else ' — '
        return parts[0] + sep + ' '.join(parts[1:])

    # navToc : arbre sur 9 rangs ; « Préambule » en tête (visas et considérants).
    preambule = {'label': 'Préambule', 'anchor': ancre_de_ligne[entrees[0][0]], 'children': []}
    groupes = []
    pile = []
    for (ligne, label, level, kind, r, d) in entrees:
        if kind != 'code':
            continue
        txt, a1 = plage(ligne, r)
        if txt is None:
            sys.exit(f'⛔ division sans article : « {label} »')
        noeud = {'label': libelle(d), 'anchor': ancre_de_ligne[ligne], 'articles': txt, 'articlesAnchor': a1, 'children': []}
        while pile and pile[-1][0] >= r:
            pile.pop()
        if r == 1:
            groupes.append(noeud)
        else:
            pile[-1][1]['children'].append(noeud)
        pile.append((r, noeud))
    nav = [preambule] + groupes

    def nettoyer(n):
        if not n.get('children'):
            n.pop('children', None)
        for c in n.get('children', []):
            nettoyer(c)
    for g in groupes:
        for c in g['children']:
            nettoyer(c)

    # ── 4. Libellés d'articles ───────────────────────────────────────────────────────────────
    labels = {a: ('Article 1er' if n == '1' else f'Article {n}') for (_l, n, a) in tetes}

    # ── 5. Index de la cliente : liste plate « Vedette — sous-entrée », Livres I et II fondus ──
    brut = [x['text'] for x in items_of(f_index) if x['k'] == 'p' and x['text']]
    PAT = re.compile(r'^(–\s*)?(.+?)\s*:\s*art\.\s*(.+)$')
    partie = None
    vedette = None
    couples = []  # (partie, vedette, sous-entrée|None, n° tel qu'écrit)
    for s in brut:
        if s.startswith('LIVRE I —'):
            partie = 'Livre I'
        elif s.startswith('LIVRE II —'):
            partie = 'Livre II'
        m = PAT.match(s)
        if not m:
            continue
        sous = bool(m.group(1))
        sujet = m.group(2).strip()
        if not sous:
            vedette = sujet
        nums = []
        for part in re.split(r',\s*', m.group(3).replace('\xa0', ' ')):
            part = part.strip()
            mm = re.fullmatch(r'(\d{1,3})(?: à (\d{1,3}))?', part)
            if not mm:
                sys.exit(f'⛔ renvoi illisible : « {part} » dans « {s} »')
            a = int(mm.group(1))
            b = int(mm.group(2) or a)
            nums += [str(n) for n in range(a, b + 1)]
        for n in nums:
            couples.append((partie, vedette, sujet if sous else None, n))
    ancres = {a for (_l, _n, a) in tetes}
    # Renvois vers un numéro que le J.O. n'imprime pas, REDIRIGÉS vers le bon texte (décision de
    # Me Vaval, 13 oct. 2026 : « renvoyer vers le bon texte ») :
    #  - « 405 » : le premier « Article 406 » (B. Avis de vérification) EST l'article 405 — le second
    #    « Article 406 » le cite ainsi (« Par exception au 2. de l'article 405 ») ;
    #  - « 406 » : dès lors, le second « Article 406 » (C. Vérification inopinée), ancre art-406-2 ;
    #  - « 294 » : les alinéas « 2. » et « 3. » qui suivent le tableau de l'art. 293 (droit
    #    d'affichage, montant reversé à la Commune), que l'index tenait pour un art. 294.
    # Chaque couple redirigé est listé dans index-a-valider.csv.
    REDIRECTION = {'405': '406', '406': '406-2', '294': '293'}
    rediriges = [c for c in couples if c[3] in REDIRECTION]
    est_redirige = [c[3] in REDIRECTION for c in couples]
    couples = [(p, v, s, REDIRECTION.get(n, n)) for (p, v, s, n) in couples]
    retires = [c for c in couples if f'art-{c[3]}' not in ancres]
    if retires:
        sys.exit(f'⛔ renvois sans ancre après redirection : {sorted(set(c[3] for c in retires))}')
    gardes = couples
    entrees_index = {}
    for (p, v, s, n) in gardes:
        sujet = f'{v} — {s}' if s else v
        e = entrees_index.setdefault(fold(sujet), {'subject': sujet, 'ctRefs': []})
        if n not in e['ctRefs']:
            e['ctRefs'].append(n)
    cle_num = lambda r: [int(x) for x in r.split('-')]
    for e in entrees_index.values():
        e['ctRefs'].sort(key=cle_num)
    index = sorted(entrees_index.values(), key=lambda e: fold(e['subject']))

    # ── 6. Contrôle des couples (entrée, article) sur le TEXTE de l'article ──────────────────
    # Contexte d'un article = son texte + les intitulés des divisions qui le contiennent (un index
    # renvoie par MATIÈRE : l'art. 114 relève des « personnes physiques » par son chapitre).
    # Une entrée se lit dans le contexte si l'une de ses variantes (« Location, loyers » → deux ;
    # « (TCA) » → une de plus) s'y lit : son mot de tête, ou au moins deux de ses mots distinctifs.
    # Comparaison sur le radical (5 lettres, sans accents) : « Agriculture » ↔ « agricole ».
    ancetres = {}
    for i, (l, n, a) in enumerate(tetes):
        libs = []
        for (ligne, label, level, kind, r, d) in entrees:
            if kind == 'code' and ligne < l:
                libs = [x for x in libs if x[0] < r] + [(r, libelle(d))]
        ancetres[a] = ' '.join(x[1] for x in libs)
    texte_art = {}
    for i, (l, n, a) in enumerate(tetes):
        fin_l = tetes[i + 1][0] if i + 1 < len(tetes) else len(textes)
        texte_art[a] = fold(' '.join(textes[l:fin_l]) + ' ' + ancetres[a])
    # (les couples REDIRIGÉS sont listés à part dans le CSV, et pas contrôlés ici)
    MOTS_VIDES = set("les des une est que qui par sur aux son ses pour dans avec sont cette ces leur leurs tout tous art article articles autres autre lors dont sans plus non entre ainsi droit droits".split())

    def mots(s):
        return [w for w in re.findall(r"[a-z0-9]+", fold(s)) if len(w) >= 3 and w not in MOTS_VIDES]

    def radical(w):
        return w[:5]
    jetons_art = {a: set(radical(w) for w in re.findall(r'[a-z0-9]+', t)) for a, t in texte_art.items()}
    df = {}
    for js in jetons_art.values():
        for r_ in js:
            df[r_] = df.get(r_, 0) + 1
    N = len(jetons_art)

    def variantes(sujet):
        paren = re.findall(r'\(([^)]*)\)', sujet)
        sans = re.sub(r'\([^)]*\)', ' ', sujet)
        return [v for v in [*re.split(r'[,;]', sans), *paren] if mots(v)]

    def se_lit(sujet, a):
        for v in variantes(sujet):
            ws = mots(v)
            if radical(ws[0]) in jetons_art[a]:
                return True
            dist = [w for w in ws if df.get(radical(w), 0) <= 0.25 * N]
            if sum(1 for w in dist if radical(w) in jetons_art[a]) >= 2:
                return True
        return False
    douteux = []
    for k_, (p, v, s, n) in enumerate(couples):
        if est_redirige[k_]:
            continue
        a = f'art-{n}'
        if a not in ancres:
            continue
        ok_v = se_lit(v, a)
        if s:
            if se_lit(s, a):
                continue
            douteux.append((p, v, s, n, 'la sous-entrée ne se lit pas dans l’article (la vedette, si)' if ok_v else 'ni la sous-entrée ni la vedette ne se lisent dans l’article'))
        elif not ok_v:
            douteux.append((p, v, s, n, 'l’entrée ne se lit pas dans l’article'))

    # ── 7. Renvois de section : les irrégularités du J.O. (texte jamais touché) ──────────────
    def sec_de(pred, derniere=True):
        cands = [d for d, (_l, _nb, lib) in enumerate(divisions) if pred(lib)]
        if len(cands) != 1:
            sys.exit(f'⛔ division ambiguë ou absente pour une note : {len(cands)} candidates')
        ligne, nb, _ = divisions[cands[0]]
        return ancre_de_ligne[ligne + (nb - 1 if derniere else 0)]
    notes = [
        (sec_de(lambda l: l.startswith('CHAPITRE 7 : DROIT D’AFFICHAGE')),
         'Le Journal officiel passe de l’article 293 à l’article 295 ; aucun article 294 n’y est imprimé. Le texte est reproduit tel quel.'),
        (sec_de(lambda l: l.startswith('Section IV. Vérification de comptabilité')),
         'Le Journal officiel imprime deux fois « Article 406 » ; le second renvoie au 2. de l’article 405. Reproduit tel quel.'),
        (sec_de(lambda l: l.startswith('Section V. Établissement de la patente')),
         'Le Journal officiel passe de la rubrique A à la rubrique C, alors que sa table des matières écrit « B. Certificat de patente ». Le texte est reproduit tel quel.'),
    ]
    cross = [{'anchor': a, 'articles': [], 'note': n} for a, n in notes]

    annotations = {
        # Le titre TEL QUE DANS LE TEXTE (décision de Me Vaval, 13 oct. 2026) : l'intitulé imprimé,
        # « DÉCRET REMPLACANT LE DÉCRET DU 19 DÉCEMBRE 2022 PORTANT CODE FISCAL », en casse ordinaire.
        'title': 'Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal',
        'annotationAuthor': '',
        'navToc': nav,
        'toc': toc,
        'connexes': [],
        'jurisprudence': {},
        'indexEntries': index,
        'labels': labels,
        'crossRefs': cross,
        'repeatedHeads': repetees,
        'refDisplay': {f'{n}-{j}': f'{n} (2ᵉ)' if j == 2 else f'{n} ({j}ᵉ)' for a, l in repetees.items() for n in [a[4:]] for j in range(2, len(l) + 2)},
    }

    # ── 8. Écritures ─────────────────────────────────────────────────────────────────────────
    corps = '\n'.join(textes) + '\n'
    open(os.path.join(ICI, 'bodyOriginal.txt'), 'w', encoding='utf8').write(corps)
    json.dump(annotations, open(os.path.join(ICI, 'annotations.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    for t in rich:
        t.pop('_item')
    json.dump(rich, open(os.path.join(ICI, 'rich.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    open(os.path.join(ICI, 'piece-sommaire-cliente.txt'), 'w', encoding='utf8').write(
        '# TABLES DES MATIÈRES.docx (sha256 ' + SHA_TOC + ') — numéros de page RETIRÉS : ce ne sont pas ceux du J.O.\n' + '\n'.join(toc_cli) + '\n')
    open(os.path.join(ICI, 'piece-index-cliente.txt'), 'w', encoding='utf8').write(
        '# Code_Fiscal_2026_Index_mots-cles.docx (sha256 ' + SHA_INDEX + ')\n' + '\n'.join(brut) + '\n')
    os.makedirs(LIVRAISON, exist_ok=True)
    with open(os.path.join(LIVRAISON, 'index-a-valider.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh, delimiter=';')
        w.writerow(['partie', 'vedette', 'sous-entrée', 'article', 'motif', 'sort'])
        CIBLE = {'405': 'le 1er « Article 406 » (B. Avis de vérification) — art-406',
                 '406': 'le 2nd « Article 406 » (C. Vérification inopinée) — art-406-2, affiché « 406 (2ᵉ) »',
                 '294': 'l’art. 293 (alinéas 2. et 3. qui suivent le tableau)'}
        for (p, v, s, n) in rediriges:
            w.writerow([p, v, s or '', n, f'redirigé vers {CIBLE[n]}', 'REDIRIGÉ (décision du 13 oct. : « renvoyer vers le bon texte »)'])
        for (p, v, s, n, motif) in douteux:
            w.writerow([p, v, s or '', n, motif, 'reproduit tel quel — à valider par la cliente'])

    # ── 9. Rapport ───────────────────────────────────────────────────────────────────────────
    formes = {'1er.-': 0, 'N.-': 0, 'N.': [], 'collée': []}
    for (l, n, a) in tetes:
        t = textes[l]
        if t.startswith('Article 1er.-'):
            formes['1er.-'] += 1
        elif re.match(r'^Article\d', t):
            formes['collée'].append(n)
        elif re.match(r'^Article \d+\.-', t):
            formes['N.-'] += 1
        elif re.match(r'^Article \d+\. ', t):
            formes['N.'].append(n)
    cites = {n for (_p, _v, _s, n) in gardes}
    print(f'corps : {len(textes)} lignes, {len(corps):,} caractères ; {len(corr)} corrections d’après le fac-similé')
    print(f'têtes : {len(tetes)} — 1er.- {formes["1er.-"]} · N.- {formes["N.-"]} · « N. » {formes["N."]} · collée {formes["collée"]} · répétées {repetees}')
    print(f'sommaire : {len(divisions)}/419 divisions · toc {len(toc)} entrées ({sum(1 for t in toc if t["kind"] == "title")} titre, {sum(1 for t in toc if t["kind"] == "suite")} lignes de suite)')
    print(f'tableaux : {len(rich)} · rangées {sum(len(t["rows"]) for t in rich)}')
    print(f'index : {len(brut)} lignes · {len(couples)} renvois dépliés · {len(rediriges)} redirigés ({dict((k, sum(1 for c in rediriges if c[3] == k)) for k in REDIRECTION)}) · {len(index)} sujets · couverture {len(cites)}/{len(ancres)} — non cités : {sorted((a for a in ancres if a[4:] not in cites), key=lambda x: [int(p) for p in x[4:].split("-")])}')
    print(f'couples douteux : {len(douteux)} (dont {sum(1 for d in douteux if not d[2])} vedettes, {sum(1 for d in douteux if d[2] and d[4].startswith("ni"))} sous-entrées sans vedette, {sum(1 for d in douteux if d[2] and d[4].startswith("la sous"))} sous-entrées seules) sur {len(gardes)} couples')


if __name__ == '__main__':
    main(*sys.argv[1:4])
