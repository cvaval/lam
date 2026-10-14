"""Lieux de divergence : union des témoins + Tesseract seul, localisés sur l'image (boîtes TSV)."""
import json, re, sys, unicodedata, difflib, collections, os
SP = sys.argv[1]
D = json.load(open(f'{SP}/coll/divs2.json'))
A = D['A']; divs = D['divs']; pagemap = {int(k): v for k, v in D['pagemap'].items()}
TOK = re.compile(r"[^\W_]+|[^\w\s]", re.U)
def key(w):
    for a, b in (('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-'), ('−', '-'), ('«', '"'), ('»', '"'), ('“', '"'), ('”', '"')):
        w = w.replace(a, b)
    return w.lower()
# page de chaque jeton Word : interpolation
pg = [None] * len(A)
for k, v in pagemap.items():
    pg[k] = v
last = 1
for k in range(len(A)):
    if pg[k] is None:
        pg[k] = last
    else:
        last = pg[k]
# jetons TSV par page
def tsv(p):
    out = []
    for ln in open(f'{SP}/cf/ocr/p{p:03d}.tesseract.tsv', encoding='utf8').read().split('\n')[1:]:
        f = ln.split('\t')
        if len(f) < 12 or f[0] != '5' or not f[11].strip():
            continue
        l, t, w, h = map(int, f[6:10])
        lid = (int(f[2]), int(f[3]), int(f[4]))
        for m in TOK.finditer(unicodedata.normalize('NFC', f[11])):
            out.append((m.group(0), (l, t, w, h), lid))
    # titre courant : la ligne qui porte « MONITEUR » dans le premier dixième de la page
    hdr = {x[2] for x in out if 'MONITEUR' in x[0] and x[1][1] < 330}
    return [x for x in out if x[2] not in hdr]
bbox = {}  # jeton Word -> boîte
vocab = collections.Counter(key(t[0]) for t in A)
for W in sorted({d['w'] for d in divs}):
    for p in range(1, 171):
        f = f'{SP}/{W}/p{p:03d}.claude.txt'
        if os.path.exists(f):
            for m in TOK.finditer(open(f, encoding='utf8').read()):
                vocab[key(m.group(0))] += 1
tdivs = []
byp = collections.defaultdict(list)
for k in range(len(A)):
    byp[pg[k]].append(k)
WORD = re.compile(r'^[^\W\d_]+$', re.U)
for p in range(1, 171):
    ks = byp.get(p, [])
    if not ks:
        continue
    T = tsv(p)
    ka = [key(A[k][0]) for k in ks]
    kb = [key(t[0]) for t in T]
    ops = difflib.SequenceMatcher(None, ka, kb, autojunk=False).get_opcodes()
    for oi, (tag, i1, i2, j1, j2) in enumerate(ops):
        if tag == 'equal':
            for x in range(i2 - i1):
                bbox[ks[i1 + x]] = T[j1 + x][1]
            continue
        framed = oi > 0 and oi + 1 < len(ops) and ops[oi - 1][0] == 'equal' and ops[oi - 1][2] - ops[oi - 1][1] >= 2 and ops[oi + 1][0] == 'equal' and ops[oi + 1][2] - ops[oi + 1][1] >= 2
        if not framed:
            continue
        wa = [A[ks[x]][0] for x in range(i1, i2)]
        wb = [T[x][0] for x in range(j1, j2)]
        aw = [w for w in wa if any(c.isalnum() for c in w)]
        bw = [w for w in wb if any(c.isalnum() for c in w)]
        # mots lus par Tesseract seul (omission possible du Word ET des deux Claude)
        if tag == 'insert' and bw and len(wb) <= 4 and all(WORD.match(w) and vocab[key(w)] >= 3 and (len(w) >= 2 or key(w) in ('à', 'a', 'y')) for w in bw):
            tdivs.append(dict(w='tesseract', tag=tag, a=[ks[i1] if i1 < len(ks) else ks[-1] + 1] * 2, wa=wa, wb=wb, page=p, cat='mot'))
        # remplacement mot pour mot par un AUTRE mot réel
        elif tag == 'replace' and len(aw) == len(bw) == 1 and len(wa) == len(wb) == 1 and WORD.match(bw[0]) and WORD.match(aw[0]) and vocab[key(bw[0])] >= 3 and key(aw[0]) != key(bw[0]):
            sa, sb = key(aw[0]), key(bw[0])
            if difflib.SequenceMatcher(None, sa, sb).ratio() < 0.5:
                continue  # lecture estropiée, pas un mot voisin
            tdivs.append(dict(w='tesseract', tag=tag, a=[ks[i1], ks[i2 - 1] + 1], wa=wa, wb=wb, page=p, cat='mot'))
        elif tag == 'delete' and aw and len(wa) <= 2 and all(WORD.match(w) for w in aw) and not re.match(r'^(?:[a-z]|[ivx]{1,4}) \.$', ' '.join(wa)):
            # (les repères d'énumération « b. », « iii. », que Tesseract saute en retrait, sont écartés)
            tdivs.append(dict(w='tesseract', tag=tag, a=[ks[i1], ks[i2 - 1] + 1], wa=wa, wb=wb, page=p, cat='mot'))
print('Tesseract seul :', len(tdivs), collections.Counter(d['tag'] for d in tdivs))
print('jetons Word localisés :', len(bbox), '/', len(A))
alld = divs + tdivs
# regroupement en LIEUX : spans Word qui se recouvrent ou se touchent
alld.sort(key=lambda d: (d['a'][0], d['a'][1]))
lieux = []
for d in alld:
    a1, a2 = d['a']
    if lieux and a1 <= lieux[-1]['a'][1] and not (a1 == a2 == lieux[-1]['a'][1] and lieux[-1]['a'][0] < a1):
        L = lieux[-1]
        L['a'][1] = max(L['a'][1], a2)
        L['lectures'].append(d)
    else:
        lieux.append(dict(a=[a1, a2], lectures=[d]))
def box_of(a1, a2):
    ks = [k for k in range(a1 - 3, a2 + 3) if k in bbox]
    if not ks:
        for r in range(4, 40):
            ks = [k for k in (a1 - r, a2 + r) if k in bbox]
            if ks:
                break
    if not ks:
        return None
    bs = [bbox[k] for k in ks]
    return [min(b[0] for b in bs), min(b[1] for b in bs), max(b[0] + b[2] for b in bs), max(b[1] + b[3] for b in bs)]
for i, L in enumerate(lieux):
    a1, a2 = L['a']
    L['id'] = f'C{i + 1:03d}'
    L['page'] = pg[min(a1, len(A) - 1)]
    L['word'] = ' '.join(A[k][0] for k in range(a1, a2))
    L['ctx'] = ' '.join(A[k][0] for k in range(max(0, a1 - 8), a1)) + ' ⟦' + L['word'] + '⟧ ' + ' '.join(A[k][0] for k in range(a2, min(len(A), a2 + 8)))
    L['box'] = box_of(a1, a2)
    L['ref'] = A[min(a1, len(A) - 1)][2]
print('lieux', len(lieux), collections.Counter(tuple(sorted({d['w'] for d in L['lectures']})) for L in lieux))
json.dump(lieux, open(f'{SP}/coll/lieux.json', 'w'), ensure_ascii=False, indent=0)
