"""Codes pénal et de procédure pénale révisés (décrets du 24 juin 2025) — corps et sommaire du lecteur annoté.

    python3 -I scripts/data/codes-penaux-2025/parse.py cp
    python3 -I scripts/data/codes-penaux-2025/parse.py cpp

Lit `<code>/transcription.txt` (assembler.py) et `<code>/corrections-jo.json`, écrit `<code>/bodyOriginal.txt`,
`<code>/annotations.json` et `<code>/rapport.txt`. Rien en base.

LE TEXTE DU JOURNAL OFFICIEL FAIT FOI, À LA LETTRE.
- La transcription est l'OCR combiné (Opus 5.5 + Tesseract) du fac-similé, CORRIGÉE des seuls écarts que la
  collation sur l'image a établis (`corrections-jo.json`, une ligne par lieu, page et texte exacts).
- Les irrégularités du J.O. lui-même sont reproduites.
- Le corps commence à « LIBERTÉ ÉGALITÉ FRATERNITÉ » et finit à la dernière signature : la manchette et le
  sommaire du fascicule sont coupés, comme le titre courant de chaque page (« Spécial N° 44 - Mardi 24 Juin
  2025 << LE MONITEUR >> 12 »).
- Un paragraphe coupé par un saut de page est RECOLLÉ (rien ne le coupe dans le texte) ; chaque recollage est
  listé dans rapport.txt. Un mot coupé en fin de page (« ajuste- » / « ment ») perd son trait d'union ; un
  composé (« elle- » / « même ») le garde : on tranche par le vocabulaire du texte lui-même.
- Le titre du décret, imprimé sur deux lignes, est une seule ligne du corps.
- Apostrophes : le J.O. imprime « ’ » (7 917 fois sur la lecture Tesseract du Code pénal) ; Opus rend « ' ».
  Le corps porte « ’ ».
- Les en-têtes de division se lisent sur deux lignes (« Chapitre I » / « Des principes généraux »). On ne JOINT
  PAS ces lignes : le `toc` s'apparie sur la 1re ligne, les suivantes entrent au `toc` sous le genre `suite`,
  et `navToc` porte le libellé réuni (même règle que le Code fiscal 2026).
- Le sommaire HTML affiche des PLAGES D'ARTICLES calculées sur le corps, jamais des pages.
"""
import json
import os
import re
import sys
import unicodedata

ICI = os.path.dirname(os.path.abspath(__file__))

CONFIG = {
    'cp': {
        'titre': ['DÉCRET RÉVISANT CELUI DU 11 MARS 2020', 'PORTANT CODE PÉNAL'],
        'avant_titre': ['LIBERTÉ ÉGALITÉ FRATERNITÉ', 'RÉPUBLIQUE D’HAÏTI', 'DÉCRET'],
        # Irrégularités STRUCTURELLES du J.O., reproduites et signalées en note à leur division (même
        # forme que le Code fiscal 2026, validée par Me Vaval le 14 oct.). Le témoin de 2020 est le
        # Décret du 11 mars 2020 portant Code pénal (Dropbox `Moniteur/Code_Penal_2020.docx`).
        'notes': [
            ('art-562-2', 'Le Journal officiel imprime deux fois « Article 562 » et aucun « Article 563 » ; le second '
                          '« Article 562 » (« Les personnes morales peuvent être déclarées pénalement responsables… ») est '
                          'l’article 563 du Code pénal du 11 mars 2020. Le texte est reproduit tel quel.'),
            ('art-697', 'Le Journal officiel passe de l’article 697 à l’article 699 ; aucun article 698 n’y est imprimé. '
                        'L’alinéa « Le fait, par un agent de l’administration pénitentiaire, de recevoir ou retenir une '
                        'personne… », imprimé à la suite de l’article 697, est l’article 698 du Code pénal du 11 mars 2020. '
                        'Le texte est reproduit tel quel.'),
        ],
    },
    'cpp': {
        'titre': ['DÉCRET RÉVISANT CELUI DU 11 MARS 2020', 'PORTANT CODE DE PROCÉDURE PÉNALE'],
        'avant_titre': ['LIBERTÉ ÉGALITÉ FRATERNITÉ', 'RÉPUBLIQUE D’HAÏTI', 'DÉCRET'],
    },
}

TETE_PAGE = re.compile(r'^(?:\d{1,3}\s*)?(?:<+\s*|«\s*)?LE MONITEUR(?:\s*>+|\s*»)?\s*Spécial N°\s*44(?:-A)?\s*-\s*Mardi 24 Juin 2025\s*(?:\d{1,3})?$'
                       r'|^(?:\d{1,3}\s*)?Spécial N°\s*44(?:-A)?\s*-\s*Mardi 24 Juin 2025\s*(?:<+\s*|«\s*)?LE MONITEUR(?:\s*>+|\s*»)?\s*(?:\d{1,3})?$'
                       r'|^\d{1,3}$')
# Numéro : simple (« 8 »), ordinal (« 1er »), ou COMPOSÉ — « 30-1 », « 1128.1 », « 649.1 » (sous-articles insérés).
NUM = r'(?:1er|\d{1,4}(?:[.\-]\d{1,3})*)'
ARTICLE = re.compile(r'^Article\s*(' + NUM + r')\s*\.?\s*-')
# Balises qu'Opus a parfois laissées autour de sa lecture (<answer>, <response>, <final_answer>, <transcript>…)
BALISE = re.compile(r'</?(?:answer|final_answer|response|transcript|invoke|output|text)(?:\s[^>]*)?>')
LIVRE = re.compile(r'^LIVRE\s+\S+$')
TITRE = re.compile(r'^TITRE\s+\S+$')
CHAPITRE = re.compile(r'^Chapitre\s+[IVXLC]+(?:er)?$')
SECTION = re.compile(r'^Section\s+\d+$')
SOUS_SECTION = re.compile(r'^Sous-section\s+\d+\s*\.\s*-')
PARAGRAPHE = re.compile(r'^Paragraphe\s+\d+\s*\.\s*-')
FIN_PHRASE = re.compile(r'[.;:!?»)]$')


def rang_de(t):
    if LIVRE.match(t):
        return 1
    if TITRE.match(t):
        return 2
    if CHAPITRE.match(t):
        return 3
    if SECTION.match(t):
        return 4
    if SOUS_SECTION.match(t):
        return 5
    if PARAGRAPHE.match(t):
        return 6
    return None


def ancre(n):
    """Même normalisation que `anchorFromDesignation` (src/lib/doc/anchors.ts) : « 30-1 » → art-30-1,
    « 1128.1 » → art-1128-1."""
    return 'art-' + re.sub(r'-+', '-', re.sub(r'[.\s]+', '-', n.lower())).strip('-')


def fold(s):
    s = unicodedata.normalize('NFD', s.replace('’', "'").replace('œ', 'oe'))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def main(code):
    cfg = CONFIG[code]
    base = os.path.join(ICI, code)
    brut = open(os.path.join(base, 'transcription.txt'), encoding='utf8').read().split('\n')

    # ── 1. Pages, corrections de la collation ────────────────────────────────────────────────
    pages = {}
    cur = None
    for ln in brut:
        m = re.fullmatch(r'⟦p(\d{3})⟧', ln)
        if m:
            cur = int(m.group(1))
            pages[cur] = []
        elif ln.strip():
            pages[cur].append(ln)
    fcorr = os.path.join(base, 'corrections-jo.json')
    corr = json.load(open(fcorr, encoding='utf8'))['corrections'] if os.path.exists(fcorr) else []
    nb_balises = 0
    for p in pages:
        propres = []
        for t in pages[p]:
            nb_balises += len(BALISE.findall(t))
            t = BALISE.sub('', t).strip()
            if t:
                propres.append(t)
        pages[p] = propres
    # Une correction vise UNE leçon : son texte doit être unique sur la page, ou porter `occurrence`
    # (rang 1, 2… dans la page) quand le J.O. répète la phrase et ne la compose pas pareil (p. 76 du
    # Code de procédure pénale : « connaitre », puis « connaître », dans deux alinéas jumeaux).
    for c in corr:
        lignes = pages[c['page']]
        n = sum(t.count(c['avant']) for t in lignes)
        rang = c.get('occurrence')
        if (rang is None and n != 1) or (rang is not None and n < rang):
            sys.exit(f"⛔ correction {c['id']} : « {c['avant']} » trouvé {n} fois p. {c['page']}")
        vu = 0
        for i, t in enumerate(lignes):
            k = t.count(c['avant'])
            if vu + k >= (rang or 1):
                j = -1
                for _ in range((rang or 1) - vu):
                    j = t.index(c['avant'], j + 1)
                lignes[i] = t[:j] + c['apres'] + t[j + len(c['avant']):]
                break
            vu += k

    # ── 2. Titres courants coupés ; pages recousues ──────────────────────────────────────────
    rapport = []
    for p, lignes in pages.items():
        while lignes and TETE_PAGE.match(lignes[0].strip()):
            lignes.pop(0)
        while lignes and TETE_PAGE.match(lignes[-1].strip()):
            lignes.pop()
        if any(TETE_PAGE.match(t.strip()) or 'LE MONITEUR' in t for t in lignes):
            rapport.append(f'⚠️ p. {p} : titre courant resté dans la page : {[t for t in lignes if "LE MONITEUR" in t]}')
    vocab = set()
    for lignes in pages.values():
        for t in lignes:
            vocab.update(fold(w) for w in re.findall(r'[\w’\'-]+', t))
    lignes = []  # (texte, page)
    for p in sorted(pages):
        for i, t in enumerate(pages[p]):
            t = t.replace("'", '’')
            if i == 0 and lignes:
                prec, pp = lignes[-1]
                debut = t.lstrip()
                if prec.endswith('-') and re.match(r'[a-zà-ÿœ]', debut) and re.search(r'\w-$', prec):
                    w1 = re.search(r'([\w’]+)-$', prec).group(1)
                    w2 = re.match(r'[\w’]+', debut).group(0)
                    if fold(f'{w1}-{w2}') not in vocab and (fold(w1 + w2) in vocab or fold(w2) not in vocab):
                        lignes[-1] = (prec[:-1] + debut, pp)
                        rapport.append(f'recollé p. {pp}/{p} (coupure de mot) : « {w1}-|{w2} » → « {w1}{w2} »')
                    else:
                        lignes[-1] = (prec + debut, pp)
                        rapport.append(f'recollé p. {pp}/{p} (composé gardé) : « {w1}-|{w2} »')
                    continue
                if not FIN_PHRASE.search(prec) and not ARTICLE.match(debut) and not rang_de(debut) and re.match(r'[a-zà-ÿœ0-9(«]', debut):
                    lignes[-1] = (prec + ' ' + debut, pp)
                    rapport.append(f'recollé p. {pp}/{p} : « …{prec[-40:]} | {debut[:40]}… »')
                    continue
            lignes.append((t, p))

    # ── 3. Bornes du corps ; titre du décret sur une ligne ───────────────────────────────────
    textes = [t for t, _ in lignes]
    debut = textes.index('LIBERTÉ ÉGALITÉ FRATERNITÉ')
    fin = max(i for i, t in enumerate(textes) if t == 'Jean Michel MOÏSE')  # dernière signature (Ministre de la Défense)
    corps = lignes[debut:fin + 1]
    textes = [t for t, _ in corps]
    t1, t2 = cfg['titre']
    k = textes.index(t1)
    if textes[k + 1] != t2:
        sys.exit(f'⛔ titre du décret : « {textes[k + 1]} » après « {t1} »')
    corps[k] = (f'{t1} {t2}', corps[k][1])
    del corps[k + 1]
    # Tête d'article : le J.O. compose le texte en retrait, à la suite de « Article N.- » en gras ;
    # l'intervalle est une TABULATION de mise en page, qui devient UNE espace (jamais rien, jamais
    # deux) — règle de l'extracteur du Code fiscal. « Article 704- » (sans point) est du J.O.
    colles = 0
    for i, (t, p) in enumerate(corps):
        m = re.match(r'^(Article\s*' + NUM + r'\s*\.?\s*-)\s*(?=\S)', t)
        if m and not t[m.end(1):].startswith(' ') or (m and t[m.end(1):].startswith('  ')):
            colles += 1
        if m:
            corps[i] = (m.group(1) + ' ' + t[m.end():], p)
    textes = [t for t, _ in corps]
    rapport.append(f'{nb_balises} balise(s) d’Opus retirée(s) ; {colles} tête(s) d’article ramenée(s) à « Article N.- Texte »')
    if any('\t' in t for t in textes):
        sys.exit('⛔ tabulation dans le corps')

    # ── 4. Têtes d'article ───────────────────────────────────────────────────────────────────
    tetes = []
    vus = {}
    for k, t in enumerate(textes):
        m = ARTICLE.match(t)
        if not m:
            continue
        n = '1' if m.group(1) == '1er' else m.group(1)
        vus[n] = vus.get(n, 0) + 1
        a = ancre(n)
        tetes.append((k, n, a if vus[n] == 1 else f'{a}-{vus[n]}'))
    repetees = {ancre(n): [f'{ancre(n)}-{j}' for j in range(2, c + 1)] for n, c in vus.items() if c > 1}
    toutes = [a for (_k, _n, a) in tetes]
    if len(set(toutes)) != len(toutes):
        sys.exit('⛔ deux têtes d’article produisent la même ancre')
    composes = [n for (_k, n, _a) in tetes if not n.isdigit()]
    rapport.append(f'{len(composes)} sous-article(s) au numéro composé : {", ".join(composes)}')
    nums = [int(n) for (_k, n, a) in tetes if n.isdigit()]
    attendu = list(range(1, max(nums) + 1))
    manquants = sorted(set(attendu) - set(nums))
    simples = [n for (_k, n, _a) in tetes if n.isdigit()]
    hors_ordre = [(simples[i - 1], simples[i]) for i in range(1, len(simples)) if int(simples[i]) != int(simples[i - 1]) + 1]
    rapport.append(f'{len(tetes)} têtes d’article, n° 1 à {max(nums)} ; manquants : {manquants or "aucun"} ; répétés : {sorted(repetees) or "aucun"}')
    if hors_ordre:
        rapport.append(f'⚠️ ruptures de suite : {hors_ordre}')

    # ── 5. Sommaire ──────────────────────────────────────────────────────────────────────────
    NIVEAU = {1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4}
    entrees = []  # (ligne, label, level, kind, rang, n° de division)
    j = 0
    for t in cfg['avant_titre'] + [f'{t1} {t2}', 'DÉCRÈTE']:
        while textes[j] != t:
            j += 1
            if j >= len(textes):
                sys.exit(f'⛔ ligne de tête introuvable : « {t} »')
        entrees.append((j, t, 1, 'title', None, None))
        j += 1
    divisions = []  # (ligne, nb de lignes, rang)
    for k, t in enumerate(textes):
        r = rang_de(t)
        if r is None:
            continue
        nb = 1
        if r in (1, 2, 3, 4):  # intitulé sur la (les) ligne(s) suivante(s)
            while k + nb < len(textes) and not ARTICLE.match(textes[k + nb]) and rang_de(textes[k + nb]) is None and nb < 4:
                suivant = textes[k + nb]
                # un intitulé de LIVRE/TITRE est en capitales et peut tenir sur plusieurs lignes ;
                # celui d'un chapitre ou d'une section tient sur une ligne
                if nb >= 2 and (r > 2 or suivant != suivant.upper()):
                    break
                nb += 1
            if nb == 1:
                rapport.append(f'⚠️ division sans intitulé : « {t} »')
            if nb > 2:
                rapport.append(f'intitulé sur {nb - 1} lignes : « {" / ".join(textes[k:k + nb])} »')
        d = len(divisions)
        divisions.append((k, nb, r))
        entrees.append((k, t, NIVEAU[r], 'code', r, d))
        for s in range(1, nb):
            entrees.append((k + s, textes[k + s], NIVEAU[r], 'suite', None, d))
    entrees.sort(key=lambda e: e[0])
    if len({e[0] for e in entrees}) != len(entrees):
        sys.exit('⛔ deux entrées du sommaire sur une même ligne')
    toc = []
    ancre_de_ligne = {}
    for n, (ligne, label, level, kind, _r, _d) in enumerate(entrees, start=1):
        toc.append({'level': level, 'label': label, 'anchor': f'sec-{n}', 'kind': kind})
        ancre_de_ligne[ligne] = f'sec-{n}'

    def plage(ligne, r):
        suivantes = [e for e in entrees if e[3] == 'code' and e[0] > ligne and e[4] <= r]
        fin_l = suivantes[0][0] if suivantes else len(textes)
        arts = [(n, a) for (l, n, a) in tetes if ligne < l < fin_l]
        if not arts:
            return None, None
        a, b = arts[0][0], arts[-1][0]
        if a == b:
            txt = f'art. {a}'
        elif len(arts) == 2 and a.isdigit() and b.isdigit() and int(b) == int(a) + 1:
            txt = f'art. {a} et {b}'
        else:
            txt = f'art. {a} à {b}'
        return txt, arts[0][1]

    def libelle(d):
        ligne, nb, _r = divisions[d]
        parts = [textes[ligne + s] for s in range(nb)]
        if nb == 1:
            return parts[0]
        return parts[0] + ' — ' + ' '.join(parts[1:])

    preambule = {'label': 'Préambule', 'anchor': ancre_de_ligne[entrees[0][0]], 'children': []}
    groupes = []
    pile = []
    for (ligne, label, level, kind, r, d) in entrees:
        if kind != 'code':
            continue
        txt, a1 = plage(ligne, r)
        if txt is None:
            rapport.append(f'⚠️ division sans article : « {libelle(d)} »')
            continue
        noeud = {'label': libelle(d), 'anchor': ancre_de_ligne[ligne], 'articles': txt, 'articlesAnchor': a1, 'children': []}
        while pile and pile[-1][0] >= r:
            pile.pop()
        if not pile:
            groupes.append(noeud)
        else:
            pile[-1][1]['children'].append(noeud)
        pile.append((r, noeud))

    def nettoyer(n):
        if not n.get('children'):
            n.pop('children', None)
        for c in n.get('children', []):
            nettoyer(c)
    # Un GROUPE de tête garde toujours sa liste `children`, même vide (Livre septième du Code pénal) :
    # CodeSidebar la parcourt sans garde. Seuls les nœuds intérieurs perdent une liste vide.
    for g in groupes:
        for c in g['children']:
            nettoyer(c)
    nav = [preambule] + groupes

    labels = {a: ('Article 1er' if n == '1' else f'Article {n}') for (_l, n, a) in tetes}
    refDisplay = {}
    for n, c in vus.items():
        for j in range(2, c + 1):
            refDisplay[f'{n}-{j}'] = f'{n} ({j}ᵉ)'

    notes = []
    for a_art, texte in cfg.get('notes', []):
        l_art = next(l for (l, _n, a) in tetes if a == a_art)
        div = [e for e in entrees if e[3] == 'code' and e[0] < l_art][-1]
        notes.append({'anchor': ancre_de_ligne[div[0]], 'articles': [], 'note': texte})
        rapport.append(f'note « sic » à « {libelle(div[5])} » ({ancre_de_ligne[div[0]]}) pour {a_art}')
    if len({n['anchor'] for n in notes}) != len(notes):
        sys.exit('⛔ deux notes sur une même division')
    # ── 6. Index : le journal d'Opus (indexer.ts), FILTRÉ ici — c'est ce filtre qui fait foi ──
    # Une entrée vise un article du lot (numéro imprimé ; « 562-2 » pour le second 562) et sa VEDETTE
    # se lit dans l'article ou dans l'intitulé de ses divisions (mots de plus de 3 lettres).
    index = []
    fj = os.path.join(base, 'index-ia.jsonl')
    if os.path.exists(fj):
        num_de = {}
        for (k, n, a) in tetes:
            num_de['562-2' if a == 'art-562-2' else n] = (k, a)
        texte_art = {}
        bornes = sorted(k for (k, _n, _a) in tetes) + [len(textes)]
        for (k, n, a) in tetes:
            fin_k = next(b for b in bornes if b > k)
            texte_art[a] = ' '.join(textes[k:fin_k])
        # intitulés de division au-dessus de chaque article
        chemin = {}
        divs = sorted([(e[0], e[4], libelle(e[5])) for e in entrees if e[3] == 'code'])
        for (k, n, a) in tetes:
            pile_d = [x for x in divs if x[0] < k]
            courant = {}
            for (l, r, lib) in pile_d:
                courant = {rr: v for rr, v in courant.items() if rr < r}
                courant[r] = lib
            chemin[a] = ' '.join(courant.values())
        def mots(x):
            return [w for w in re.split(r'[^a-z0-9]+', fold(x)) if len(w) > 3]
        retenues, rejetees, illisibles = {}, [], 0
        for ln in open(fj, encoding='utf8'):
            j = json.loads(ln)
            rep_ = j['reponse']
            try:
                data = json.loads(rep_[rep_.index('['):rep_.rindex(']') + 1])
            except ValueError:
                illisibles += 1
                continue
            for d_ in data:
                n = str(d_.get('article', '')).strip()
                if n not in num_de or n not in j['articles']:
                    rejetees.extend(f'[{n}] {e}' for e in d_.get('entrees', []))
                    continue
                a = num_de[n][1]
                src = fold(texte_art[a] + ' ' + chemin[a])
                for e in d_.get('entrees', []):
                    e = re.sub(r'\s+', ' ', e.replace('–', '—').replace(' - ', ' — ')).strip().rstrip('.;')
                    if not e or re.search(r'\b(art\.|article)\s*\d', e, re.I):
                        rejetees.append(f'[{n}] {e}')
                        continue
                    ved = e.split(' — ')[0]
                    if not all(w in src for w in mots(ved)):
                        rejetees.append(f'[{n}] {e}')
                        continue
                    ref = n  # numéro imprimé ; « 562-2 » pour le second « Article 562 » (ancre art-562-2)
                    k_ = fold(e)
                    ent = retenues.setdefault(k_, {'subject': e, 'ctRefs': []})
                    if ref not in ent['ctRefs']:
                        ent['ctRefs'].append(ref)
        def cle_num(r):
            return [int(x) if x.isdigit() else 0 for x in re.split(r'[.\-]', r)]
        for ent in retenues.values():
            ent['ctRefs'].sort(key=cle_num)
        index = sorted(retenues.values(), key=lambda e: fold(e['subject']))
        couverts = {r for e in index for r in e['ctRefs']}
        rapport.append(f'index : {len(index)} sujets, {sum(len(e["ctRefs"]) for e in index)} renvois, {len(couverts)}/{len(tetes)} articles couverts ; {len(rejetees)} entrée(s) rejetée(s), {illisibles} lot(s) illisible(s)')
        open(os.path.join(base, 'index-rejets.txt'), 'w', encoding='utf8').write('\n'.join(rejetees) + '\n')
    annotations = {'toc': toc, 'navToc': nav, 'labels': labels, 'indexEntries': index}
    if notes:
        annotations['crossRefs'] = notes
    if repetees:
        annotations['repeatedHeads'] = repetees
        annotations['refDisplay'] = refDisplay
    open(os.path.join(base, 'bodyOriginal.txt'), 'w', encoding='utf8').write('\n'.join(textes))
    open(os.path.join(base, 'annotations.json'), 'w', encoding='utf8').write(json.dumps(annotations, ensure_ascii=False, indent=1))
    rapport.insert(0, f'{len(textes)} lignes de corps, {len(toc)} entrées de sommaire ({len(divisions)} divisions), {len(corr)} correction(s) de collation')
    open(os.path.join(base, 'rapport.txt'), 'w', encoding='utf8').write('\n'.join(rapport) + '\n')
    print('\n'.join(r for r in rapport if not r.startswith('recollé')))
    print(f'({sum(r.startswith("recollé") for r in rapport)} recollages de page, voir rapport.txt)')


if __name__ == '__main__':
    main(sys.argv[1])
