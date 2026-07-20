#!/usr/bin/env python3
"""Parser de l'INDEX MAÎTRE Vandal (Index Code de commerce.docx) → parsed/index-master.json.

Grammaire de l'index (sondée) :
  Sujet de tête            « Abordage »
  - Sous-entrée; clause; … « - Navire, art 257, 258; D. 28 août 1960, art 6; p 309; »
Une CLAUSE (segment entre « ; ») porte des références vers UNE cible :
  - « art N » avant toute désignation → le Code de commerce lui-même ;
  - après une désignation datée (« D. 28 août 1960 », « L. 3 août 1955 »…) → ce texte ;
  - « Code douanier, art N » → le Code des douanes de la plateforme ;
  - « Convention …, art N / Règle N » → la convention citée ;
  - « Ibid » → cible de la référence précédente ;
  - « p/pp NNN » → page de l'édition imprimée (à remplacer par un lien, jamais affichée) ;
  - « V. / Voir également Sujet » → renvoi interne d'index.

Sorties :
  parsed/index-master.json  — index structuré complet (multi-documents, tâche 3)
  structure.json (mis à jour) — indexEntries du Code seul (sujets → art-N existants)
"""
import html, re, json, os, zipfile, unicodedata
from collections import Counter

OUT = os.path.dirname(os.path.abspath(__file__))
PARSED = os.path.join(OUT, 'parsed')
DOCX = '/Users/cvaval/Downloads/Index Code de commerce.docx'

ENT = [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&#x2019;', '’'), ('&#x2018;', '‘'),
       ('&#x2013;', '–'), ('&#x2014;', '—'), ('&#xa0;', ' '), ('&quot;', '"'), ('&apos;', "'")]


def clean(t):
    t = html.unescape(html.unescape(t))
    return re.sub(r'\s+', ' ', t).strip()


def paras(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8', 'replace')
    out = []
    for p in re.findall(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S):
        body = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)
        body = re.sub(r'<w:tab\b[^>]*>', '<w:t> </w:t>', body)
        txt = clean(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', body, re.S)))
        if txt:
            out.append(txt)
    return out


def fold(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


MONTH_N = {m: i + 1 for i, m in enumerate(
    ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'])}
ABBR = {'jan': 1, 'fev': 2, 'avr': 4, 'juil': 7, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12}


def month_num(m):
    m = fold(m).rstrip('.')
    return MONTH_N.get(m) or ABBR.get(m)


MONTHS = r'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|fév|fev|jan|sept|oct|nov|déc|dec|avr|juil'
DESIG = re.compile(rf'\b(D|L|Arr|Loi|Décret|Decret|Arrêté|Arrete|Règlements?|Reglements?)\.?\s+(?:du\s+)?(1er|\d{{1,2}})\s+({MONTHS})\.?\s+(\d{{4}})', re.I)
DOUANIER = re.compile(r'\bCode\s+douanier\b', re.I)
CONV = re.compile(r'\b(Convention[^,;]{0,90}?)(?:,|;|$)', re.I)
ARTS = re.compile(r'\bart\.?\s+((?:\d{1,4}(?:-\d+)?(?:\s*(?:bis|ter|quater))?)(?:\s*(?:,|et)\s*(?:\d{1,4}(?:-\d+)?(?:\s*(?:bis|ter|quater))?|suiv\.?))*)', re.I)
REGLES = re.compile(r'\bRègles?\s+((?:\d{1,3})(?:\s*(?:,|et)\s*\d{1,3})*)', re.I)
PAGES = re.compile(r'\bpp?\.?\s?(\d{2,4})(?:\s*et\s*suiv\.?)?', re.I)
VOIR = re.compile(r'\bV(?:oir)?\.\s*(?:également\s+)?([A-ZÉÈÀÂ][^;,.]{2,60})')
SECTION_HDR = re.compile(r'^- [A-Z] -$')


def desig_key(m):
    nature = fold(m.group(1)).rstrip('.')
    nat = {'d': 'decret', 'decret': 'decret', 'l': 'loi', 'loi': 'loi',
           'arr': 'arrete', 'arrete': 'arrete', 'reglement': 'reglement', 'reglements': 'reglement'}.get(nature, nature)
    day = 1 if m.group(2) == '1er' else int(m.group(2))
    return f'{nat}:{day}:{month_num(m.group(3))}:{m.group(4)}'


def parse_arts(s):
    out = []
    for tok in re.split(r'\s*(?:,|et)\s*', s):
        tok = tok.strip().rstrip('.')
        if not tok or fold(tok).startswith('suiv'):
            continue
        tok = re.sub(r'\s*(bis|ter|quater)$', r'-\1', tok, flags=re.I).lower()
        out.append(tok)
    return out


def parse_clause(clause, prev_target):
    """Une clause → liste de refs {target, arts?, regles?, pages?}. Segmentation aux désignations."""
    refs = []
    # positions des cibles dans la clause
    marks = [(m.start(), 'desig', desig_key(m)) for m in DESIG.finditer(clause)]
    marks += [(m.start(), 'douanier', 'douanier') for m in DOUANIER.finditer(clause)]
    marks += [(m.start(), 'conv', 'conv:' + fold(m.group(1))[:60]) for m in CONV.finditer(clause)]
    if re.search(r'\bIbid\b', clause):
        marks += [(re.search(r'\bIbid\b', clause).start(), 'ibid', prev_target or 'code')]
    marks.sort()
    # segments : [0, m1), [m1, m2), …
    bounds = [0] + [p for p, _, _ in marks] + [len(clause)]
    targets = ['code'] + [t for _, _, t in marks]
    for k in range(len(targets)):
        seg = clause[bounds[k]:bounds[k + 1]]
        arts = [a for m in ARTS.finditer(seg) for a in parse_arts(m.group(1))]
        regles = [r for m in REGLES.finditer(seg) for r in re.split(r'\s*(?:,|et)\s*', m.group(1))]
        pages = [m.group(1) for m in PAGES.finditer(seg)]
        if arts or regles or pages:
            refs.append({'target': targets[k], **({'arts': arts} if arts else {}),
                         **({'regles': regles} if regles else {}), **({'pages': pages} if pages else {})})
    return refs, (targets[-1] if marks else prev_target)


lines = paras(DOCX)
entries = []          # {subject, subs: [{label, refs, voir}]}
cur = None
prev_target = 'code'
for l in lines:
    if SECTION_HDR.match(l):
        continue
    if not l.startswith('- '):
        # sujet de tête — peut porter refs et « V. » en ligne
        subject = l.split(',')[0].strip().rstrip('.')
        cur = {'subject': subject, 'subs': []}
        entries.append(cur)
        rest = l[len(subject):].strip(' ,')
        if rest:
            refs, prev_target = parse_clause(rest, 'code')
            voir = [clean(v) for v in VOIR.findall(rest)]
            if refs or voir:
                cur['subs'].append({'label': '', 'refs': refs, 'voir': voir})
        continue
    if cur is None:
        continue
    text = l[2:]
    label = text.split(',')[0].strip()
    refs_all, voir_all = [], [clean(v) for v in VOIR.findall(text)]
    prev_target = 'code'
    for clause in text.split(';'):
        refs, prev_target = parse_clause(clause, prev_target)
        refs_all.extend(refs)
    cur['subs'].append({'label': label, 'refs': refs_all, 'voir': voir_all})

# ── Projection « Code seul » → indexEntries (validée contre les ancres du corps) ──
struct_path = os.path.join(PARSED, 'structure.json')
structure = json.load(open(struct_path))
known = set(structure['labels'].keys())
code_entries = {}
dead = Counter()
for e in entries:
    arts = []
    for sub in e['subs']:
        for r in sub['refs']:
            if r['target'] == 'code':
                for a in r.get('arts', []):
                    if f'art-{a}' in known:
                        arts.append(a)
                    else:
                        dead[a] += 1
    if arts:
        uniq = sorted(set(arts), key=lambda x: (int(re.match(r'\d+', x).group()), x))
        code_entries[e['subject']] = [int(a) if a.isdigit() else a for a in uniq]

# Renvois d'index MANUELS (corrections cliente 20 juil.) : ctRefs bidirectionnels →
# le renvoi s'affiche au bas des DEUX articles (indexBacklinks exclut l'article courant).
MANUAL = {
    "Ancien article 188 (devenu 231)": [231, 242],  # note art 242 : « L'art 188 est devenu 231 »
}
for subj, refs in MANUAL.items():
    valid = [a for a in refs if f'art-{a}' in known]
    if valid:
        code_entries[subj] = valid

structure['indexEntries'] = [{'subject': s, 'ctRefs': refs} for s, refs in sorted(code_entries.items(), key=lambda kv: fold(kv[0]))]
json.dump(structure, open(struct_path, 'w'), ensure_ascii=False, indent=1)
json.dump(entries, open(os.path.join(PARSED, 'index-master.json'), 'w'), ensure_ascii=False, indent=1)

# ── Diagnostics ──
n_refs = sum(len(sub['refs']) for e in entries for sub in e['subs'])
targets = Counter(r['target'].split(':')[0] for e in entries for sub in e['subs'] for r in sub['refs'])
print('sujets       :', len(entries), '· sous-entrées:', sum(len(e['subs']) for e in entries))
print('refs         :', n_refs, '·', dict(targets))
print('indexEntries (Code) :', len(structure['indexEntries']), 'sujets ·',
      sum(len(x['ctRefs']) for x in structure['indexEntries']), 'renvois')
print('arts du Code cités mais absents (liens morts évités) :', dict(dead.most_common(10)))
