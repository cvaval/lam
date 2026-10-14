"""Collation mot à mot : Word ↔ témoins (fusions OCR), têtes appariées par NUMÉRO + rang d'occurrence."""
import json, re, sys, unicodedata, difflib, collections, csv
SP = sys.argv[1]
WIT = sys.argv[2:]  # dossiers de témoins (pNNN.fusion.txt), ex. cf/ocr cf/ocr-opus
items = json.load(open(f'{SP}/docx/cf.json'))

wlines = []
for i, x in enumerate(items):
    if x['k'] == 'p':
        if x['text']:
            wlines.append((x['text'], f'p{i}'))
    else:
        for r, row in enumerate(x['rows']):
            for c, cell in enumerate(row):
                if cell['text'] and cell['vmerge'] != 'continue':
                    wlines.append((cell['text'], f't{i}r{r}c{c}'))
last = max(k for k, (t, _) in enumerate(wlines) if 'DEMERO' in t)
wlines = wlines[: last + 1]

TOK = re.compile(r"[^\W_]+|[^\w\s]", re.U)
def toks(lines):
    out = []
    for li, (t, ref) in enumerate(lines):
        for m in TOK.finditer(unicodedata.normalize('NFC', t)):
            out.append((m.group(0), li, ref))
    return out
def key(w):
    for a, b in (('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-'), ('−', '-'), ('«', '"'), ('»', '"'), ('“', '"'), ('”', '"')):
        w = w.replace(a, b)
    return w.lower()
HEAD = re.compile(r'^Article\s*(1er|\d+)\s*\.', re.I)

def chunks(lines, T):
    """bornes de jetons par tête, clé (numéro, rang)"""
    seen = collections.Counter()
    marks = []
    for li, (t, _) in enumerate(lines):
        m = HEAD.match(t)
        if m:
            n = '1' if m.group(1).lower() == '1er' else m.group(1)
            seen[n] += 1
            marks.append(((n, seen[n]), li))
    starts = {}
    k = 0
    pos = []
    for keyn, li in marks:
        while k < len(T) and T[k][1] < li:
            k += 1
        pos.append((keyn, k))
    out = {('pre', 1): (0, pos[0][1] if pos else len(T))}
    for (kn, a), nxt in zip(pos, pos[1:] + [(None, len(T))]):
        out[kn] = (a, nxt[1])
    return out

A = toks(wlines)
CA = chunks(wlines, A)

def strip_acc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
def cat(wa, wb, tag):
    if tag == 'casse':
        return 'casse'
    ja, jb = ''.join(key(x) for x in wa), ''.join(key(x) for x in wb)
    if ja == jb:
        return 'espace'
    if strip_acc(ja) == strip_acc(jb):
        allcaps = all((x.upper() == x) for x in wa + wb if any(c.isalpha() for c in x))
        return 'accent-capitale' if allcaps else 'accent'
    if all(not any(c.isalnum() for c in x) for x in wa + wb):
        return 'ponctuation'
    return 'mot'

alldivs = []
pagemap = {}  # jeton Word -> page (d'après le 1er témoin)
for wi, W in enumerate(WIT):
    plines = []
    for p in range(1, 171):
        for ln in open(f'{SP}/{W}/p{p:03d}.fusion.txt', encoding='utf8').read().split('\n'):
            if '<<' in ln and 'MONITEUR' in ln:
                continue
            if ln.strip():
                plines.append((ln.strip(), p))
    B = toks(plines)
    CB = chunks(plines, B)
    miss = [k for k in CA if k not in CB]
    extra = [k for k in CB if k not in CA]
    print(W, 'jetons', len(B), 'têtes manquantes au témoin', miss, 'en trop', extra)
    # une tête manquante au témoin : son morceau Word est fondu dans le précédent
    keysA = list(CA)
    merged = []
    for k in keysA:
        if k in CB or not merged:
            merged.append([k])
        else:
            merged[-1].append(k)
    for grp in merged:
        a1, a2 = CA[grp[0]][0], CA[grp[-1]][1]
        if grp[0] not in CB:
            continue
        b1, b2 = CB[grp[0]]
        # étendre la borne témoin si la tête suivante y manque aussi : rien à faire (déjà fondu)
        ka = [key(t[0]) for t in A[a1:a2]]
        kb = [key(t[0]) for t in B[b1:b2]]
        s = difflib.SequenceMatcher(None, ka, kb, autojunk=False)
        for tag, i1, i2, j1, j2 in s.get_opcodes():
            if tag == 'equal':
                for k in range(i2 - i1):
                    if wi == 0:
                        pagemap[a1 + i1 + k] = B[b1 + j1 + k][1] and plines[B[b1 + j1 + k][1]][1]
                    wa, wb = A[a1 + i1 + k][0], B[b1 + j1 + k][0]
                    if wa.replace('’', "'") != wb.replace('’', "'") and wa.lower() == wb.lower():
                        alldivs.append(dict(w=W, tag='casse', a=[a1 + i1 + k, a1 + i1 + k + 1], wa=[wa], wb=[wb], page=plines[B[b1 + j1 + k][1]][1]))
                continue
            wa = [A[k][0] for k in range(a1 + i1, a1 + i2)]
            wb = [B[k][0] for k in range(b1 + j1, b1 + j2)]
            pg = plines[B[min(b1 + j1, len(B) - 1)][1]][1]
            alldivs.append(dict(w=W, tag=tag, a=[a1 + i1, a1 + i2], wa=wa, wb=wb, page=pg))
for d in alldivs:
    d['cat'] = cat(d['wa'], d['wb'], d['tag'])
print(len(alldivs), collections.Counter((d['w'], d['cat']) for d in alldivs))
json.dump(dict(divs=alldivs, A=A, pagemap=pagemap), open(f'{SP}/coll/divs2.json', 'w'), ensure_ascii=False)
