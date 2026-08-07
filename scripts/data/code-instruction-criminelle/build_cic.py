#!/usr/bin/env python3
"""Construit les données du Code d'instruction criminelle depuis les trois .docx.

Sortie : source.json { corps[], toc[], navToc[], index[], meta }.

Décisions portées ici (voir docs/prompt-code-instruction-criminelle.md) :
 · `toc.label` = LA LIGNE DU CORPS, jamais le libellé composé de la table : 45 des 67
   libellés joignent 2-3 lignes par un tiret, et aucun ne s'apparierait ;
 · les deux lois intercalées restent en `kind:'code'` — les marquer `connexe` ferait
   perdre son ancre à 159 articles (le drapeau d'annexe de segmentAnnotated ne se
   referme jamais) ; le déduplicateur d'ancres règle seul la collision de numéros ;
 · le menu n'est PAS construit par l'indentation : les SECTIONS I-III qui suivent le
   TITRE IV de la loi de 1979 appartiennent au Code, pas à cette loi.
"""
import json, re, unicodedata, zipfile
from pathlib import Path

SRC = Path.home() / 'Downloads'
OUT = Path(__file__).parent

def paragraphes(chemin):
    xml = zipfile.ZipFile(chemin).read('word/document.xml').decode('utf-8')
    out = []
    for p in re.findall(r'<w:p\b.*?</w:p>|<w:p\b[^>]*/>', xml, re.S):
        m = re.search(r'<w:pPr>(.*?)</w:pPr>', p, re.S)
        pPr = m.group(1) if m else ''
        style = (re.search(r'<w:pStyle w:val="([^"]+)"', pPr) or [None, ''])[1]
        ind = int((re.search(r'w:left="(-?\d+)"', pPr) or [None, '0'])[1])
        corps = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)
        gras = '<w:b/>' in corps or '<w:b ' in corps
        ital = '<w:i/>' in corps or '<w:i ' in corps
        corps = corps.replace('<w:tab/>', '<w:t> </w:t>').replace('<w:br/>', '<w:t> </w:t>')
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', corps, re.S))
        t = (t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
              .replace('&#39;', "'").replace('&quot;', '"'))
        t = re.sub(r'\s+', ' ', t).strip()
        if t:
            out.append({'t': t, 'style': style, 'ind': ind, 'b': gras, 'i': ital})
    return out

def cle(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '', s)

texte = paragraphes(SRC / 'Code_instruction_criminelle.docx')
tdm = paragraphes(SRC / 'Code instruction criminelle_ TABLE DES MATIÈRES.docx')[1:]  # sans « TABLE DES MATIÈRES »
index = paragraphes(SRC / 'Index_Code_instruction_criminelle.docx')

# ── appariement table ↔ corps, DANS L'ORDRE ───────────────────────────────────
# Une rubrique « CHAPITRE Ier — DE LA POLICE JUDICIAIRE » couvre deux lignes du corps ;
# l'ancre se pose sur la PREMIÈRE, seule à pouvoir servir de libellé de table.
NIVEAU = {0: 1, 400: 2, 800: 3, 1200: 4}
toc, ptr = [], 0
for r in tdm:
    parts = [p.strip() for p in re.split(r'\s+[—–]\s+', r['t']) if p.strip()]
    depart = None
    for k, part in enumerate(parts):
        while ptr < len(texte) and cle(texte[ptr]['t']) != cle(part):
            ptr += 1
        if ptr >= len(texte):
            raise SystemExit(f"rubrique non appariée : « {r['t'][:70]} » (partie « {part[:40]} »)")
        if k == 0:
            depart = ptr
        ptr += 1
    toc.append({'level': NIVEAU[r['ind']], 'label': texte[depart]['t'],
                'anchor': f'sec-{len(toc) + 1}', 'kind': 'code',
                'libelle': r['t'], 'ligne': depart})

# ── les deux lois intercalées, et où elles se referment ───────────────────────
def ligne_de(motif):
    return next(i for i, p in enumerate(texte) if p['t'].startswith(motif))

ANNEXES = [
    {'debut': ligne_de('LOI DU 20 JUILLET 1929'), 'fin': ligne_de('LOI No. 5') - 1,
     'nom': 'Loi du 20 juillet 1929'},
    {'debut': ligne_de('LOI DU 26 JUILLET 1979'), 'fin': ligne_de('SECTION I - MATIÈRES CRIMINELLES') - 1,
     'nom': 'Loi du 26 juillet 1979 sur l’appel pénal'},
]

# ── menu latéral : arbre par niveaux, mais l'annexe se REFERME à sa fin ────────
# Une loi intercalée ouvre une parenthèse : ce qui la suit ne lui appartient pas, mais
# retrouve la branche du Code où elle s'était insérée. Sans cette restauration, les
# SECTIONS I-III qui suivent le TITRE IV de la loi de 1979 remontaient en racines alors
# qu'elles relèvent de la LOI Nº 5, chapitre Ier.
nav, pile, avant_annexe = [], [], None
for e in toc:
    dans_annexe = any(a['debut'] <= e['ligne'] <= a['fin'] for a in ANNEXES)
    if dans_annexe and avant_annexe is None:
        avant_annexe = list(pile)          # on entre : mémoriser la branche du Code
    if not dans_annexe and avant_annexe is not None:
        pile, avant_annexe = avant_annexe, None   # on sort : la reprendre
    while pile and pile[-1]['level'] >= e['level']:
        pile.pop()
    noeud = {'label': e['libelle'], 'anchor': e['anchor'], 'children': []}
    (pile[-1]['noeud']['children'] if pile else nav).append(noeud)
    pile.append({'level': e['level'], 'noeud': noeud, 'annexe': dans_annexe})

# ── index : sujet (fer à gauche, gras) + lignes de détail (en retrait) ─────────
entrees, sujet = [], None
for p in index:
    t = p['t']
    if len(t) <= 2 or t.startswith('INDEX') or t.startswith('CODE') or t.startswith('Les références'):
        continue
    if p['ind'] == 0:
        sujet = t
        if p['i']:                       # « X — voir Y » : renvoi de forme, sans article
            entrees.append({'subject': t, 'ctRefs': []})
            sujet = None
        continue
    if sujet is None:
        continue
    # les renvois sont après le DERNIER deux-points ; le contexte de loi se réinitialise au « ; »
    tete, _, queue = t.rpartition(':')
    refs, contexte_loi = [], False
    for morceau in queue.split(';'):
        if re.search(r'L\.\s*\d{1,2}\s*\w+\.?\s*\d{4}', morceau):
            contexte_loi = True          # « L. 20 juill. 1929, art. 2 » → pas un article du Code
            continue
        contexte_loi = False
        for m in re.finditer(r'(\d{1,3})\s*-\s*(\d{1,3})|(\d{1,3})(?:er)?', morceau):
            if m.group(1):
                refs.extend(range(int(m.group(1)), int(m.group(2)) + 1))
            else:
                refs.append(int(m.group(3)))
    entrees.append({'subject': f"{sujet} — {tete.strip(' –-')}" if tete else f"{sujet} — {t.strip(' –-')}",
                    'ctRefs': sorted(set(refs))})

corps = [p['t'] for p in texte]
json.dump({'corps': corps,
           'toc': [{k: v for k, v in e.items() if k != 'ligne'} for e in toc],
           'navToc': nav, 'index': entrees,
           'annexes': ANNEXES},
          open(OUT / 'source.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print(f"corps {len(corps)} lignes · table {len(toc)}/67 · menu {len(nav)} racines · index {len(entrees)} entrées")
print(f"annexes : " + ' | '.join(f"{a['nom']} ¶{a['debut']}-{a['fin']}" for a in ANNEXES))
refs = [r for e in entrees for r in e['ctRefs']]
print(f"renvois d'index : {len(refs)} · hors 1..472 : {sorted({r for r in refs if r < 1 or r > 472})}")
