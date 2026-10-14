import json, re, sys, unicodedata, difflib, collections
SP = sys.argv[1]
D = json.load(open(f'{SP}/coll/divs2.json'))
A = D['A']; pagemap = {int(k): v for k, v in D['pagemap'].items()}
TOK = re.compile(r"[^\W_]+|[^\w\s]", re.U)
def key(w):
    for a, b in (('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-')): w = w.replace(a, b)
    return w.lower()
pg = [None]*len(A); last = 1
for k, v in pagemap.items(): pg[k] = v
for k in range(len(A)):
    if pg[k] is None: pg[k] = last
    else: last = pg[k]
byp = collections.defaultdict(list)
for k in range(len(A)): byp[pg[k]].append(k)
out = []
P = set(';:,.!?')
for p in range(1, 171):
    T = []
    for ln in open(f'{SP}/cf/ocr/p{p:03d}.tesseract.tsv', encoding='utf8').read().split('\n')[1:]:
        f = ln.split('\t')
        if len(f) < 12 or f[0] != '5' or not f[11].strip(): continue
        for m in TOK.finditer(unicodedata.normalize('NFC', f[11])):
            T.append((m.group(0), tuple(map(int, f[6:10])), float(f[10])))
    ks = byp.get(p, [])
    ka = [key(A[k][0]) for k in ks]; kb = [key(t[0]) for t in T]
    ops = difflib.SequenceMatcher(None, ka, kb, autojunk=False).get_opcodes()
    for oi, (tag, i1, i2, j1, j2) in enumerate(ops):
        if tag == 'replace' and i2-i1 == 1 and j2-j1 == 1 and ka[i1] in P and kb[j1] in P and T[j1][2] > 85:
            fr = ops[oi-1][0] == 'equal' and ops[oi+1][0] == 'equal' if 0 < oi < len(ops)-1 else False
            if fr: out.append((p, ks[i1], A[ks[i1]][0], T[j1][0], T[j1][1], T[j1][2]))
print(len(out), collections.Counter((a, b) for _, _, a, b, _, _ in out))
json.dump(out, open(f'{SP}/coll/ponct.json', 'w'), ensure_ascii=False)
for o in out[:80]:
    k = o[1]; print(o[0], o[2], '→', o[3], round(o[5]), '|', ' '.join(A[j][0] for j in range(k-6, k+5)))
