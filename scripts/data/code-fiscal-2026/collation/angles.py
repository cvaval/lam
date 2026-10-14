"""Angles morts : (1) accent seul, Word ↔ Tesseract, alignés 1:1 ; (2) mots collés au J.O. (Tesseract 1 jeton = 2 jetons Word)."""
import json, re, sys, unicodedata, difflib, collections
SP = sys.argv[1]
D = json.load(open(f'{SP}/coll/divs2.json'))
A = D['A']; pagemap = {int(k): v for k, v in D['pagemap'].items()}
TOK = re.compile(r"[^\W_]+|[^\w\s]", re.U)
def key(w):
    for a, b in (('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-')): w = w.replace(a, b)
    return w.lower()
def sa(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
pg = [None]*len(A)
for k, v in pagemap.items(): pg[k] = v
last = 1
for k in range(len(A)):
    if pg[k] is None: pg[k] = last
    else: last = pg[k]
byp = collections.defaultdict(list)
for k in range(len(A)): byp[pg[k]].append(k)
acc, glue = [], []
for p in range(1, 171):
    T = []
    for ln in open(f'{SP}/cf/ocr/p{p:03d}.tesseract.tsv', encoding='utf8').read().split('\n')[1:]:
        f = ln.split('\t')
        if len(f) < 12 or f[0] != '5' or not f[11].strip(): continue
        for m in TOK.finditer(unicodedata.normalize('NFC', f[11])):
            T.append((m.group(0), tuple(map(int, f[6:10])), float(f[10])))
    ks = byp.get(p, [])
    ka = [sa(key(A[k][0])) for k in ks]   # aligner SANS accents
    kb = [sa(key(t[0])) for t in T]
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ka, kb, autojunk=False).get_opcodes():
        if tag == 'equal':
            for x in range(i2 - i1):
                wa, wb = A[ks[i1+x]][0], T[j1+x][0]
                if wa.lower() != wb.lower() and any(unicodedata.category(c) == 'Mn' for c in unicodedata.normalize('NFD', wa + wb)):
                    acc.append((p, ks[i1+x], wa, wb, T[j1+x][1], T[j1+x][2]))
        elif tag == 'replace' and i2 - i1 == 2 and j2 - j1 == 1:
            wa = A[ks[i1]][0] + A[ks[i1+1]][0]
            if sa(key(wa)) == kb[j1] and all(c.isalnum() for c in wa):
                glue.append((p, ks[i1], A[ks[i1]][0] + ' ' + A[ks[i1+1]][0], T[j1][0], T[j1][1], T[j1][2]))
c = collections.Counter((wa, wb) for _, _, wa, wb, _, _ in acc)
print('accent seul Word≠Tesseract :', len(acc)); print(c.most_common(60))
print('collés au J.O. selon Tesseract :', len(glue))
for g in glue: print(g[0], g[2], '→', g[3], g[5])
json.dump(dict(acc=acc, glue=glue), open(f'{SP}/coll/angles.json', 'w'), ensure_ascii=False)
