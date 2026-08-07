import json, re, zipfile
from pathlib import Path
SRC = Path.home() / 'Downloads'

def paras(chemin):
    xml = zipfile.ZipFile(chemin).read('word/document.xml').decode('utf-8')
    out = []
    for p in re.findall(r'<w:p\b.*?</w:p>|<w:p\b[^>]*/>', xml, re.S):
        m = re.search(r'<w:pPr>(.*?)</w:pPr>', p, re.S)
        pPr = m.group(1) if m else ''
        style = (re.search(r'<w:pStyle w:val="([^"]+)"', pPr) or [None, ''])[1]
        ind = int((re.search(r'w:left="(-?\d+)"', pPr) or [None, '0'])[1])
        corps = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)
        sz = (re.search(r'<w:sz w:val="(\d+)"', corps) or [None, ''])[1]
        gras = '<w:b/>' in corps or '<w:b ' in corps
        ital = '<w:i/>' in corps or '<w:i ' in corps
        corps = corps.replace('<w:tab/>', '<w:t> </w:t>').replace('<w:br/>', '<w:t> </w:t>')
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', corps, re.S))
        t = (t.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>').replace('&#39;',"'").replace('&quot;','"'))
        t = re.sub(r'\s+', ' ', t).strip()
        if t: out.append({'t': t, 'style': style, 'ind': ind, 'sz': sz, 'b': gras, 'i': ital})
    return out

for nom, f in [('texte','Code_instruction_criminelle.docx'),
               ('tdm','Code instruction criminelle_ TABLE DES MATIÈRES.docx'),
               ('index','Index_Code_instruction_criminelle.docx')]:
    ps = paras(SRC / f)
    json.dump(ps, open(f'cic/{nom}.json','w',encoding='utf-8'), ensure_ascii=False)
    car = sum(len(p['t']) for p in ps)
    styles = sorted({p['style'] for p in ps if p['style']})
    tailles = sorted({p['sz'] for p in ps if p['sz']})
    print(f"{nom:7} {len(ps):5} ¶ · {car:7} car. · styles {styles[:5]} · corps {tailles[:6]}")
