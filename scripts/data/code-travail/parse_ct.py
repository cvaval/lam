#!/usr/bin/env python3
"""Parser Code du travail annoté → bodyOriginal + structure (TOC, jurisprudence, connexes, index)."""
import zipfile, re, json, sys, os

OUT = os.path.dirname(os.path.abspath(__file__)) + '/parsed'
os.makedirs(OUT, exist_ok=True)

ENT = [('&amp;','&'),('&lt;','<'),('&gt;','>'),('&#x2019;',"'"),('&#x2018;',"'"),('&#x2013;','-'),('&#x2014;','—'),('&#xa0;',' '),('&quot;','"')]
def clean(t):
    for a,b in ENT: t=t.replace(a,b)
    return re.sub(r'\s+',' ',t).strip()

def paras(path):
    z=zipfile.ZipFile(path); xml=z.read('word/document.xml').decode('utf-8','replace')
    body=re.search(r'<w:body>(.*)</w:body>',xml,re.S); body=body.group(1) if body else xml
    out=[]
    for p in re.findall(r'<w:p\b.*?</w:p>',body,re.S):
        txt=clean(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>',p,re.S)))
        style=re.search(r'<w:pStyle w:val="([^"]+)"',p)
        ital='<w:i/>' in p or '<w:i ' in p
        bold='<w:b/>' in p or '<w:b ' in p  # gras (chapitres marqués en gras, non en Heading)
        out.append({'style':style.group(1) if style else '','ital':ital,'bold':bold,'t':txt})
    return out

def art_anchor(num):
    m=re.match(r'^(\d{1,3}|premier)(?:[\s-]?(bis|ter|quater))?',str(num).strip().lower())
    if not m: return None
    base='1' if m.group(1)=='premier' else m.group(1)
    return f"art-{base}{('-'+m.group(2)) if m.group(2) else ''}"

DL = sys.argv[1] if len(sys.argv)>1 else '/Users/cvaval/Downloads/Code_du_travail_annote_RECONSTITUE_2.docx'
IDX = sys.argv[2] if len(sys.argv)>2 else '/Users/cvaval/Downloads/INDEX ALPHABÉTIQUE DES MATIÈRES.docx'

P = paras(DL)
# Retire le sommaire imprimé + l'index imprimé en tête (redondants avec la table des matières
# et l'index alphabétique interactifs) : on démarre au vrai titre du décret « CODE DU TRAVAIL »
# / « (DÉCRET DU 24 FÉVRIER 1984) ». Apparat éditorial seulement — le texte légal est préservé.
for _i in range(len(P)-1):
    if P[_i]['t'].strip()=='CODE DU TRAVAIL' and '24 FÉVRIER 1984' in P[_i+1]['t']:
        P = P[_i:]; break
toc=[]; connexes=[]; juris={}; body_lines=[]
cur_art=None              # ancre de l'article courant (pour rattacher la jurisprudence)
cur_section=None          # ancre de la section courante (sec-N) — qualifie la clé de
                          # jurisprudence pour distinguer l'art. 5 du Code de l'art. 5 d'une annexe
in_juris=False            # on est dans un bloc Jurisprudence
juris_case=None           # case courant {ref, excerpt}
in_title=True             # page de titre du décret (CODE DU TRAVAIL / DUVALIER…) → centrée
sec_n=0
ART_RE=re.compile(r'^Article\s+(\d{1,3}|premier)(?:\s*(?:er|ère|e)\b)?(?:\s+(bis|ter|quater))?\s*[\.\-]',re.I)
# Vraies lois connexes = ANNEXES + RÈGLEMENTS (les « DÉCRET » isolés sont des sous-parties).
CONNEXE_RE=re.compile(r'^(ANNEXE\s+[IVXLC]+|R[ÈE]GLEMENTS?)\b',re.I)
# Chapitres du Code « Chapitre N » (ligne seule, gras OU non) + titre ligne suivante.
CHAP_RE=re.compile(r'^Chapitre\s+[\dIVXLC]+\s*$',re.I)
ANN_CHAP_RE=re.compile(r'^CHAPITRE\s+[IVXLC\d]+\s*$')  # CHAPITRE d'annexe (Heading, MAJUSCULES)
consumed=set()  # index de lignes-titre déjà absorbées dans un en-tête de chapitre/section

def flush_case():
    global juris_case
    if juris_case and cur_art:
        key=f"{cur_section or 'sec-0'}|{cur_art}"  # section-qualifiée (anti-collision annexes)
        juris.setdefault(key,[]).append(juris_case)
    juris_case=None

for i,para in enumerate(P):
    if i in consumed: continue
    s,it,b,t=para['style'],para['ital'],para['bold'],para['t']
    if not t: continue
    # Chapitre du Code « Chapitre N » (ligne seule, non balisé Heading) + titre ligne suivante.
    if CHAP_RE.match(t) and s not in ('Heading1','Heading2'):
        flush_case(); in_juris=False
        sec_n+=1; anchor=f"sec-{sec_n}"; cur_section=anchor
        label=t
        nx=next(((j,P[j]['t']) for j in range(i+1,min(i+4,len(P))) if P[j]['t']),None)
        if nx and not re.match(r'^(Chapitre|Article|Jurisprudence)\b',nx[1],re.I) and len(nx[1])<120:
            label=f"{t} — {nx[1]}"; consumed.add(nx[0])
        toc.append({'level':3,'label':label,'anchor':anchor,'kind':'chapter'})
        body_lines.append(('head',anchor,3,label))
        continue
    # En-têtes de structure (TOC)
    if s in ('Heading1','Heading2'):
        flush_case(); in_juris=False
        sec_n+=1; anchor=f"sec-{sec_n}"; cur_section=anchor
        label=t
        # CHAPITRE N (numéro seul, annexe) → fusionne avec le titre ligne suivante.
        if s=='Heading2' and ANN_CHAP_RE.match(t):
            nx=next(((j,P[j]['t']) for j in range(i+1,min(i+4,len(P))) if P[j]['t']),None)
            if nx and not re.match(r'^(CHAPITRE|TITRE|Article|SECTION)\b',nx[1],re.I) and len(nx[1])<100:
                label=f"{t} — {nx[1]}"; consumed.add(nx[0])
        is_connexe = (s=='Heading1' and bool(CONNEXE_RE.match(t)))
        kind_val = 'title' if in_title else ('connexe' if is_connexe else 'code')
        toc.append({'level':1 if s=='Heading1' else 2,'label':label,'anchor':anchor,'kind':kind_val})
        if is_connexe:
            if re.match(r'^R[ÈE]GLEMENTS?',t,re.I):
                title=t
            else:  # ANNEXE N — titre descriptif (prochaine ligne non vide, hors « DÉCRET »)
                desc=next((x['t'] for x in P[i+1:i+6] if x['t'] and x['t'].strip().upper() not in ('DÉCRET','DECRET','LOI')),'')
                title=f"{t} — {desc}".strip(' —')
            connexes.append({'title':title,'anchor':anchor})
        body_lines.append(('head',anchor,1 if s=='Heading1' else 2,label))
        continue
    # Marqueur « Jurisprudence » (italique)
    if re.match(r'^Jurisprudence\b',t,re.I) and len(t)<20:
        flush_case(); in_juris=True; continue
    # Nouvel article → sort de la jurisprudence
    m=ART_RE.match(t)
    if m:
        flush_case(); in_juris=False
        num=('1' if m.group(1).lower()=='premier' else m.group(1))+(('-'+m.group(2).lower()) if m.group(2) else '')
        cur_art=art_anchor(num)
        body_lines.append(('art',cur_art,0,t))
        continue
    if in_juris:
        cm=re.match(r'^(\d+)[\.\)]\s*(.+)$',t)  # « 1. Arrêt du ... »
        if cm:
            flush_case(); juris_case={'ref':cm.group(2).strip(),'excerpt':''}
        elif re.match(r'^(Arr[êe]t|Cass|Sentence|D[ée]cision|Jugement|Cour)\b',t,re.I):
            flush_case(); juris_case={'ref':t,'excerpt':''}
        elif juris_case is not None:
            juris_case['excerpt']=(juris_case['excerpt']+' '+t).strip()
        else:  # première ligne d'un bloc non numéroté → démarre un arrêt
            juris_case={'ref':t,'excerpt':''}
        continue
    # Arrêt orphelin : jurisprudence SANS marqueur « Jurisprudence » devant (ex.
    # « 3. Arrêt du 11 août 1967, … ») — sinon elle fuit dans le texte officiel. Signal
    # fort (numéro + Arrêt/Cassation/…) → entre en mode jurisprudence, rattaché à cur_art.
    if cur_art and re.match(r'^\d+[\.\)]\s+(Arr[êe]t|Cass|Sentence|Jugement|D[ée]cision|Cour\b)',t,re.I):
        in_juris=True
        cm=re.match(r'^(\d+)[\.\)]\s*(.+)$',t)
        flush_case(); juris_case={'ref':cm.group(2).strip(),'excerpt':''}
        continue
    # Section (sous-titre d'un chapitre) : ligne courte, commençant par une majuscule, NON
    # ponctuée comme une phrase, directement suivie d'un « Article N » → en-tête de section.
    if (cur_section and not in_juris and 4<len(t)<58 and t[0].isupper() and not re.search(r'[.,;:]["»]?$',t)
        and not ART_RE.match(t) and not re.match(r'^(Chapitre|Titre|Vu |Consid|Article|\d)',t,re.I)):
        nxt=next((P[j]['t'] for j in range(i+1,min(i+3,len(P))) if P[j]['t']),'')
        if ART_RE.match(nxt):
            flush_case(); in_juris=False
            sec_n+=1; anchor=f"sec-{sec_n}"; cur_section=anchor
            toc.append({'level':4,'label':t,'anchor':anchor,'kind':'section'})
            body_lines.append(('head',anchor,4,t))
            continue
    # Texte courant (article body / sous-items) — sort de la page de titre.
    in_title=False
    body_lines.append(('txt',cur_art,0,t))

flush_case()

# bodyOriginal : texte officiel (sans jurisprudence)
body=[]
for kind,anchor,lvl,t in body_lines:
    body.append(t)
bodyOriginal='\n'.join(body)

# ── Index : sujet → références CT (articles du Code) ──
IP=paras(IDX)
index=[]; cur_subj=None
CT_RE=re.compile(r'CT\s*([\d][\d,\s\-]*\d|\d)')
def ct_nums(refs):
    nums=set()
    for grp in CT_RE.findall(refs):
        for part in grp.split(','):
            part=part.strip()
            r=re.match(r'^(\d+)\s*-\s*(\d+)$',part)
            if r:
                a,b=int(r.group(1)),int(r.group(2))
                if b-a<200:
                    for n in range(a,b+1): nums.add(n)
            elif part.isdigit(): nums.add(int(part))
    return sorted(nums)
for para in IP:
    t=para['t']
    if not t or t.startswith(('CT =','A-chiffre','p. =','a. =','INDEX')): continue
    if t.endswith(':'):  # en-tête de sujet (sous-entrées suivent)
        cur_subj=t[:-1].strip(); continue
    m=re.match(r'^([^,:]+?)[,:]\s*(.+)$',t)
    subj = (m.group(1).strip() if m else t).strip()
    refs = m.group(2) if m else t
    nums=ct_nums(refs)
    if nums:
        full = f"{cur_subj} — {subj}" if cur_subj and not t[0].isupper() else subj
        index.append({'subject':full,'ctRefs':nums})

# ── navToc : table des matières NAVIGABLE hiérarchique (3 niveaux). Code → livres → chapitres ;
#    Lois connexes → annexe → ses chapitres/sous-sections. Le balisage docx est bruité (on cure). ──
def secn(a): return int(a.split('-')[1])
first_conn = min((secn(c['anchor']) for c in connexes), default=10**9)
code_start = next((e['anchor'] for e in toc if e['level']==1 and re.match(r'^TITRE\s+[IVXLC]+\s*$',e['label'])), 'sec-1')
SUBJ=re.compile(r"^(DES?|DU|DE LA|DE L|D[’'])\b",re.I)
SKIP=re.compile(r"^(D[ÉE]CRET|LOI(\s+N|\s*$)|\()",re.I)  # entrées-bruit (DÉCRET, LOI No., « (Moniteur… »)
def nice(s): return (s[0]+s[1:].lower()) if (s and s.isupper()) else s
def fold(s): return re.sub(r'\W','',s).lower()

# Code : livres (sujets niveau-2) → chapitres (niveau-3) → sections (niveau-4)
code_books=[]; cur_book=None; cur_chap=None; seenb=set()
for e in toc:
    n=secn(e['anchor'])
    if not (secn(code_start)<=n<first_conn): continue
    if e['level']==2 and SUBJ.match(e['label']) and len(e['label'])>8:
        k=fold(e['label'])
        if k in seenb: continue
        seenb.add(k); cur_book={'label':nice(e['label']),'anchor':e['anchor'],'children':[]}; cur_chap=None; code_books.append(cur_book)
    elif e.get('kind')=='chapter' and cur_book is not None:
        cur_chap={'label':e['label'],'anchor':e['anchor'],'children':[]}; cur_book['children'].append(cur_chap)
    elif e.get('kind')=='section':
        (cur_chap or cur_book or {'children':[]})['children'].append({'label':e['label'],'anchor':e['anchor']})

# Lois connexes : chaque annexe + ses sous-sections internes (chapitres/titres de la loi)
conn_title={c['anchor']:c['title'] for c in connexes}
DIV=re.compile(r'^(TITRE|CHAPITRE|PARTIE|SECTION|LIVRE)\b',re.I)  # vraies divisions (≠ préambule)
conn_children=[]; cur_an=None
for e in toc:
    if secn(e['anchor'])<first_conn: continue
    if e.get('kind')=='connexe':
        cur_an={'label':conn_title.get(e['anchor'],e['label']),'anchor':e['anchor'],'children':[]}
        conn_children.append(cur_an)
    elif cur_an is not None and DIV.match(e['label']):  # divisions internes de la loi connexe
        cur_an['children'].append({'label':e['label'],'anchor':e['anchor']})

navToc=[
  {'label':'Code du travail — Décret du 24 février 1984','anchor':code_start,'children':code_books},
  {'label':'Lois connexes','anchor':(connexes[0]['anchor'] if connexes else code_start),'children':conn_children},
]

structure={
  'title':'Code du Travail',
  'annotationAuthor':'Jean-Frédéric Salès',
  'navToc':navToc,
  'toc':toc,'connexes':connexes,
  'jurisprudence':juris,
  'indexEntries':index,
}
open(OUT+'/bodyOriginal.txt','w',encoding='utf-8').write(bodyOriginal)
json.dump(structure,open(OUT+'/structure.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)

# ── Rapport ──
art_anchors=[a for k,a,l,t in body_lines if k=='art']
print(f"bodyOriginal : {len(bodyOriginal)} caractères, {len(body)} lignes")
print(f"TOC          : {len(toc)} entrées (dont {len(connexes)} lois connexes)")
print(f"Articles     : {len(art_anchors)} (uniques: {len(set(art_anchors))})")
print(f"Jurisprudence: {len(juris)} articles annotés, {sum(len(v) for v in juris.values())} arrêts au total")
print(f"Index        : {len(index)} entrées avec renvois CT")
print("\n— TOC (12 premières) —")
for e in toc[:12]: print(f"   {'  '*(e['level']-1)}[{e['kind']}] {e['label'][:70]}")
print("\n— Lois connexes (titres) —")
for c in connexes[:12]: print("   •", c['title'][:75])
print("\n— Jurisprudence exemple (…|art-2) —")
k2=next((k for k in juris if k.endswith('|art-2')),None)
for c in (juris.get(k2,[]) if k2 else [])[:2]: print("   ◦", c['ref'][:75], "\n     »", c['excerpt'][:90])
print("\n— Index exemples —")
for e in index[:5]: print("   §", e['subject'][:55], "→ art.", e['ctRefs'][:8])
