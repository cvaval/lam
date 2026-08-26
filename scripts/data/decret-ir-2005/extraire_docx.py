"""Extracteur docx minimal — un paragraphe par ligne, tabulations préservées, barrés marqués."""
import sys, zipfile, re
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def paras(path):
    z=zipfile.ZipFile(path)
    root=ET.fromstring(z.read('word/document.xml'))
    out=[]
    for p in root.iter(W+'p'):
        buf=[]
        for r in p.iter(W+'r'):
            rpr=r.find(W+'rPr')
            barre=False
            if rpr is not None:
                st=rpr.find(W+'strike')
                if st is not None and st.get(W+'val') not in ('false','0'):
                    barre=True
            txt=[]
            for n in r.iter():
                if n.tag==W+'t': txt.append(n.text or '')
                elif n.tag==W+'tab': txt.append('\t')          # ⚠️ le bug des colonnes collées
                elif n.tag in (W+'br', W+'cr'): txt.append('\n')
            t=''.join(txt)
            if t: buf.append('⟦BARRÉ⟧'+t+'⟦/BARRÉ⟧' if barre else t)
        # une cellule de tableau se termine sans marqueur : on repère la ligne parente
        out.append(''.join(buf))
    return out

for f in sys.argv[1:]:
    ls=paras(f)
    print('\n'.join(ls))
