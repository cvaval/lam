"""Extraction du Word du Code fiscal 2026 (Le Moniteur Spécial N° 48-A) — paragraphes et tableaux, DANS L'ORDRE.

    python3 -I scripts/data/code-fiscal-2026/extraire_docx.py <Code_Fiscal_2026_Moniteur_48-A.docx> <sortie.json>

⚠️ LE BUG `<w:tab/>` DE NOS EXTRACTEURS (leçon de la loi UCREF) : 282 têtes portent « Article 121.-<w:tab/>Ont à
payer… ». Une tabulation devient une ESPACE, jamais rien — sinon « Article 121.-Ont à payer ». Les suites
d'espaces et de tabulations se réduisent à une espace ; le début et la fin du paragraphe sont rognés.
`<w:br/>` (26) devient aussi une espace : la ligne imprimée n'est pas un paragraphe.

Chaque paragraphe garde sa mise en forme (gras, italique, souligné, alignement), qui sert à reconnaître les
divisions ; chaque tableau garde ses cellules, et les paragraphes d'une même cellule se joignent par une ESPACE
(leçon du décret minier : « zinc ;Concentré »).
"""
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def on(rpr, tag):
    if rpr is None:
        return False
    el = rpr.find(W + tag)
    if el is None:
        return False
    v = el.get(W + 'val')
    return v not in ('0', 'false', 'none')


def runs(p):
    """(texte, gras, italique, souligné) par run, tabulations et sauts → espace."""
    out = []
    for r in p.iter(W + 'r'):
        rpr = r.find(W + 'rPr')
        txt = []
        for el in r:
            if el.tag == W + 't':
                txt.append(el.text or '')
            elif el.tag in (W + 'tab', W + 'br', W + 'cr'):
                txt.append(' ')
        out.append((''.join(txt), on(rpr, 'b'), on(rpr, 'i'), on(rpr, 'u')))
    return out


def norm(s):
    return re.sub(r'[ \t]+', ' ', s).strip()


def para(p):
    rs = runs(p)
    text = norm(''.join(t for t, *_ in rs))
    pleins = [x for x in rs if x[0].strip()]
    ppr = p.find(W + 'pPr')
    jc = ppr.find(W + 'jc') if ppr is not None else None
    st = ppr.find(W + 'pStyle') if ppr is not None else None
    return {
        'k': 'p',
        'text': text,
        'b': bool(pleins) and all(x[1] for x in pleins),
        'i': bool(pleins) and all(x[2] for x in pleins),
        'u': bool(pleins) and all(x[3] for x in pleins),
        # Une partie seulement en gras : la tête d'article (« Article 22.- » en gras, le texte non).
        'bTete': norm(''.join(x[0] for x in rs[: next((i for i, x in enumerate(rs) if x[0].strip() and not x[1]), len(rs))])),
        'align': jc.get(W + 'val') if jc is not None else None,
        'style': st.get(W + 'val') if st is not None else None,
    }


def table(tbl):
    rows = []
    for tr in tbl.findall(W + 'tr'):
        row = []
        for tc in tr.findall(W + 'tc'):
            tcpr = tc.find(W + 'tcPr')
            span = 1
            vmerge = None
            if tcpr is not None:
                gs = tcpr.find(W + 'gridSpan')
                if gs is not None:
                    span = int(gs.get(W + 'val'))
                vm = tcpr.find(W + 'vMerge')
                if vm is not None:
                    vmerge = vm.get(W + 'val') or 'continue'
            ps = [para(p) for p in tc.findall(W + 'p')]
            row.append({
                'text': ' '.join(x['text'] for x in ps if x['text']),
                'paras': [x['text'] for x in ps],
                'b': bool(ps) and all(x['b'] for x in ps if x['text']) and any(x['text'] for x in ps),
                'span': span,
                'vmerge': vmerge,
            })
        rows.append(row)
    return {'k': 't', 'rows': rows}


def main(src, dst):
    with zipfile.ZipFile(src) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')
    items = []
    for ch in body:
        if ch.tag == W + 'p':
            items.append(para(ch))
        elif ch.tag == W + 'tbl':
            items.append(table(ch))
    json.dump(items, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    np = sum(1 for x in items if x['k'] == 'p')
    nt = sum(1 for x in items if x['k'] == 't')
    print(f'{np} paragraphes ({sum(1 for x in items if x["k"] == "p" and x["text"])} non vides), {nt} tableaux')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
