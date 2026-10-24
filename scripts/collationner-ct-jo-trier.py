#!/usr/bin/env python3
"""COLLATION DU CODE DU TRAVAIL CONTRE LE J.O. n° 18-A (5 mars 1984) — tri à trois témoins. LECTURE SEULE.
base (base.txt + ann.json) / transcription du J.O. (jo-paras.json, extrait du docx fourni) / Tesseract sur le scan
(tess/jo-NN.txt). Sortie : ecarts-jo.json (verdict jo | base | image). Voir docs/livraison-ct-mot-a-mot.md § 9.

    /usr/bin/python3 scripts/collationner-ct-jo-trier.py <dossier jo>
"""
import difflib, glob, json, re, sys, unicodedata, collections
D = sys.argv[1]
N = lambda s: re.sub(r'\s+', ' ', s).strip()
B = open(D + '/base.txt', encoding='utf8').read().split('\n')
ann = json.load(open(D + '/ann.json'))
table = [N(t['label']) for t in ann['toc']]
annexe = N(next(t['label'] for t in ann['toc'] if t['kind'] == 'connexe'))
P = json.load(open(D + '/jo-paras.json'))
MARQ = re.compile(r'^(?:[a-z]\s?\)|\d{1,2}\s?°?\s?\)|\d{1,2}\.|•|–|-)\s+')

def decoupe(lines, toc=None, entetes=None):
    art = {'preambule': []}; cur = 'preambule'; n = 0; ptr = 0
    for i, l in enumerate(lines):
        s = N(l)
        if not s:
            continue
        if toc is not None and ptr < len(toc) and s == toc[ptr]:
            ptr += 1
            if s == annexe:
                break
            continue
        if entetes is not None and i in entetes:
            continue
        m = re.match(r'^Article\s+(\d{1,3})\s*\.', s)
        if m and int(m.group(1)) == n + 1:
            n += 1; cur = str(n); art[cur] = []
        if n >= 516 and cur == '516' and s.startswith('ANNEXE'):
            break
        art[cur].append(s)
    return art

b = decoupe(B, table)
# Transcription : les intitulés (styles Heading, paragraphes gras sans « Article ») ne sont pas du texte d'article.
jl = [t for _, _, t in P]
ent = {i for i, (s, g, t) in enumerate(P) if s or (g and not t.startswith('Article'))}
j = decoupe(jl, None, ent)

# Tesseract : pages concaténées, césures recousues, têtes en séquence (plus longue sous-suite croissante).
q = '\n'.join(open(f, encoding='utf8').read() for f in sorted(glob.glob(D + '/tess/jo-*.txt')))
q = re.sub(r'(\w)-\n(\w)', r'\1\2', q)
q = re.sub(r'\s+', ' ', q)
heads = [(m.start(), int(m.group(1).translate(str.maketrans('OolIS', '00115')))) for m in re.finditer(r'(?:A|Â|À)?\s?[rn]\s?t\s?[il1!|]\s?[cec]\s?[l1I!|]\s?e\s*([\dOolIS]{1,3})\s*[.,:;]?\s*[-–—~]?', q) if re.fullmatch(r'[\dOolIS]{1,3}', m.group(1)) and any(c.isdigit() for c in m.group(1))]
best, prev = {}, {}
for k, (_, c) in enumerate(heads):
    best[k], prev[k] = 1, None
    for i in range(max(0, k - 40), k):
        if heads[i][1] < heads[k][1] and heads[k][1] - heads[i][1] <= (k - i) + 10 and best[i] + 1 > best[k]:
            best[k], prev[k] = best[i] + 1, i
k = max(best, key=best.get) if best else None
seq = []
while k is not None:
    seq.append(heads[k]); k = prev[k]
seq.reverse()
qa = {}
for (p0, n), nxt in zip(seq, seq[1:] + [(len(q), None)]):
    qa[str(n)] = q[p0:nxt[0]]

def toks(s):
    s = s.replace('’', "'").replace('–', '-').replace('—', '-')
    s = re.sub(r'^(Article\s+\d+)\s*\.\s*-?\s*', r'\1. ', s)
    s = re.sub(r'\s+([;:!?])', r'\1', s)
    return re.findall(r"[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]+|[^\s0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]", s)
fold = lambda x: unicodedata.normalize('NFD', ' '.join(x)).encode('ascii', 'ignore').decode().lower()
proche = lambda x, y: x == y or (len(x) >= 4 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.85)

res, cpt = [], collections.Counter()
for n in b:
    if n not in j:
        continue
    A = toks(' '.join(MARQ.sub('', l) for l in b[n]))
    T = toks(' '.join(MARQ.sub('', l) for l in j[n]))
    Q = toks(qa.get(n, ''))
    smTQ = difflib.SequenceMatcher(None, T, Q, autojunk=False)
    carte = {}
    for bl in smTQ.get_matching_blocks():
        for d in range(bl.size):
            carte[bl.a + d] = bl.b + d
    def qseg(j1, j2):
        g = next((carte[i] for i in range(j1 - 1, -1, -1) if i in carte), -1)
        d = next((carte[i] for i in range(j2, len(T)) if i in carte), len(Q))
        return Q[g + 1:d]
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, T, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        a, t, qq = A[i1:i2], T[j1:j2], qseg(j1, j2)
        nature = 'ponct' if not re.search(r'\w', ' '.join(a + t)) else 'casse' if ' '.join(a).lower() == ' '.join(t).lower() else \
            'accent' if fold(a) == fold(t) else 'mot'
        exact = lambda x, y: ' '.join(x) == ' '.join(y)
        if nature in ('casse', 'accent', 'ponct'):
            verdict = 'jo' if exact(qq, t) and not exact(qq, a) else 'base' if exact(qq, a) else 'image'
        else:
            fq, fa, ft = fold(qq), fold(a), fold(t)
            # Égalité EXACTE d'abord (« les travailleurs » = « les travailleurs ») ; la proximité ne départage que si
            # elle ne profite qu'à un seul côté (« nom » est proche de « noms » ET de « nom »).
            verdict = 'jo' if fq == ft and fq != fa else 'base' if fq == fa and fq != ft else \
                'jo' if proche(fq, ft) and not proche(fq, fa) else 'base' if proche(fq, fa) and not proche(fq, ft) else 'image'
        cpt[(nature, verdict)] += 1
        res.append({'article': n, 'nature': nature, 'verdict': verdict, 'base': ' '.join(a), 'jo': ' '.join(t), 'tesseract': ' '.join(qq),
                    'contexte': ' '.join(A[max(0, i1 - 5):i1]) + ' ⟦' + ' '.join(a) + '⟧ ' + ' '.join(A[i2:i2 + 5])})
json.dump(res, open(D + '/ecarts-jo.json', 'w'), ensure_ascii=False, indent=0)
print('têtes Tesseract en séquence', len(seq), '| articles base', len(b) - 1, '| transcription', len(j) - 1)
tot = collections.Counter(); [tot.update({v: c}) for (_, v), c in cpt.items()]
print('écarts', len(res), dict(tot))
for nat in ('mot', 'casse', 'accent', 'ponct'):
    print(f'  {nat:6}', {v: cpt[(nat, v)] for v in ('jo', 'base', 'image')})
