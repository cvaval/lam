#!/usr/bin/env python3
"""Extrait l'arrêté du 30 avril 2018, son sommaire et son index depuis les .docx fournis.

⚠ PIÈGE PAYÉ SUR CE CORPUS : le titre d'un signataire et son nom sont deux runs séparés par
un `<w:tab/>`. Le remplacer par une espace NUE la place hors des balises <w:t> et l'extraction
la perd (« Le PrésidentJovenel MOÏSE »). On le convertit donc en run de texte. Et l'on retire
`<w:pPr>…</w:pPr>` AVANT de lire les <w:t> : le pPr porte ses propres <w:tabs>.
"""
import json, re, sys, zipfile
from pathlib import Path

SRC = Path.home() / 'Downloads'
OUT = Path(__file__).parent

def paragraphes(chemin: Path):
    xml = zipfile.ZipFile(chemin).read('word/document.xml').decode('utf-8')
    out = []
    for p in re.findall(r'<w:p\b.*?</w:p>|<w:p\b[^>]*/>', xml, re.S):
        corps = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)
        corps = corps.replace('<w:tab/>', '<w:t> </w:t>').replace('<w:br/>', '<w:t> </w:t>')
        txt = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', corps, re.S))
        txt = (txt.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                  .replace('&#39;', "'").replace('&quot;', '"'))
        txt = re.sub(r'\s+', ' ', txt).strip()
        if txt:
            out.append(txt)
    return out

texte = paragraphes(SRC / 'Arrete_Protection_Donnees_Personnelles_2018_RECONSTITUE_1.docx')
index = paragraphes(SRC / 'Arrete_PDP_2018_Index_alphabetique.docx')
sommaire = paragraphes(SRC / 'Arrete_PDP_2018_Sommaire.docx')

# ── décision cliente : le « pr » de deux signataires est retiré ────────────────
avant = sum(1 for l in texte if re.search(r'\bpr [A-ZÉ]', l))
texte = [re.sub(r'\bpr ([A-ZÉ])', r'\1', l) for l in texte]
assert avant == 2, f'attendu 2 mentions « pr », trouvé {avant}'
assert not any(re.search(r'\bpr [A-ZÉ]', l) for l in texte)

# ── décision cliente : le doublon de l'index est supprimé ─────────────────────
# Établi par la mesure : le corps de l'entrée « Restriction - … » est identique
# caractère pour caractère à la queue de « Accès (restriction d'—) », à la parenthèse
# fermante près (150 signes contre 151).
i5 = next(i for i, l in enumerate(index) if l.startswith('Accès (restriction'))
i6 = next(i for i, l in enumerate(index) if l.startswith('Restriction -'))
queue = index[i5][index[i5].find('consultation réservée'):]
corps = index[i6][index[i6].find('consultation réservée'):]
assert queue.rstrip(')') == corps.rstrip(')'), 'le doublon annoncé n’en est pas un — arrêt'
del index[i6]

json.dump({'texte': texte, 'index': index, 'sommaire': sommaire},
          open(OUT / 'source.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"texte {len(texte)} · index {len(index)} (doublon retiré) · sommaire {len(sommaire)}")
print('« pr » retiré de :', [l for l in texte if 'RODRIGUE' in l or 'DENIS' in l])
