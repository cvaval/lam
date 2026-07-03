#!/usr/bin/env python3
"""Parser Constitution 1987 consolidée → bodyOriginal + structure (chapitres/sections, articles,
statut amendement, anciennes versions repliables). Index thématique généré séparément (IA)."""
import zipfile, re, json, os
OUT=os.path.dirname(os.path.abspath(__file__))+'/parsed'; os.makedirs(OUT,exist_ok=True)
DL='/Users/cvaval/Downloads/Constitution_1987_consolidee_integrale.docx'
ENT=[('&amp;','&'),('&lt;','<'),('&gt;','>'),('&#x2019;','’'),('&#x2018;','‘'),('&#x2013;','–'),('&#x2014;','—'),('&#xa0;',' '),('&quot;','"'),('&apos;',"'")]
def clean(t):
    for a,b in ENT: t=t.replace(a,b)
    return re.sub(r'\s+',' ',t).strip()
def paras(path):
    z=zipfile.ZipFile(path); xml=z.read('word/document.xml').decode('utf-8','replace')
    body=re.search(r'<w:body>(.*)</w:body>',xml,re.S); body=body.group(1) if body else xml
    out=[]
    for p in re.findall(r'<w:p\b.*?</w:p>',body,re.S):
        txt=clean(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>',p,re.S)))
        if not txt or txt.startswith('</w:'): continue
        out.append({'b':'<w:b/>' in p or '<w:b ' in p,'i':'<w:i/>' in p or '<w:i ' in p,'t':txt})
    return out

P=paras(DL)
# démarre au Préambule (saute l'en-tête/notes)
start=next((k for k,x in enumerate(P) if x['t'].startswith('Le Peuple Haïtien proclame')),0)
P=P[start:]

CH_RE=re.compile(r'^CHAPITRE\s+[IVXLC]+\b')
SEC_RE=re.compile(r'^Section\s+[A-Z]\b')
ART_RE=re.compile(r'^Article\s+(\d+(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*(modifié|abrogé)?',re.I)
OLD_RE=re.compile(r'^Ancienne version\b',re.I)
def art_anchor(desig):
    s=str(desig).lower().strip()
    s=re.sub(r'(\d)\s*(?:er|ère)\b',r'\1',s)          # 1er → 1
    s=re.sub(r'(\d)\s*(bis|ter|quater)',r'\1-\2',s)   # 134bis → 134-bis · 190ter → 190-ter
    s=re.sub(r'[.\s]+','-',s); s=re.sub(r'-+','-',s).strip('-')
    return 'art-'+s
def art_label(desig): return 'Article '+re.sub(r'\s+',' ',str(desig)).strip()

toc=[]; body_lines=[]; old_versions={}; status={}; labels={}
sec_n=0; cur_art=None; mode='new'
def head(level,label,kind):
    global sec_n
    sec_n+=1; a='sec-%d'%sec_n
    toc.append({'level':level,'label':label,'anchor':a,'kind':kind})
    body_lines.append(('head',a,level,label)); return a

# Préambule : chapitre d'en-tête (sec-1) ; son contenu (« Le Peuple Haïtien proclame … »)
# suit comme texte. Pas de pseudo-article (évite le doublon « Préambule »).
head(1,'Préambule','chapter')
cur_art='preambule'; status['preambule']=None; mode='new'

for i,x in enumerate(P):
    t=x['t']
    if CH_RE.match(t): cur_art=None; mode='new'; head(1,t,'chapter'); continue
    if SEC_RE.match(t): cur_art=None; mode='new'; head(2,t,'section'); continue
    if OLD_RE.match(t) and x['b']:
        mode='old'; continue
    m=ART_RE.match(t)
    if m and not OLD_RE.match(t):
        desig=m.group(1); tail=t[m.end(1):].strip()
        st=None
        if re.match(r'^abrogé',tail,re.I): st='abrogé'
        elif re.match(r'^modifié',tail,re.I): st='modifié'
        elif re.match(r'^(ajouté|nouveau|article ajouté)',tail,re.I): st='nouveau'
        cur_art=art_anchor(desig); status[cur_art]=st; labels[cur_art]=art_label(desig); mode='new'
        # ligne d'article NETTOYÉE de son suffixe de statut (le statut est stocké à part)
        lbl=re.sub(r'\s+(modifié|abrogé|ajouté|nouveau|article ajouté)\b.*$','',t,flags=re.I).strip()
        body_lines.append(('art',cur_art,0,lbl)); continue
    # texte
    if mode=='old' and cur_art:
        old_versions.setdefault(cur_art,[]).append(t)
    else:
        body_lines.append(('txt',cur_art,0,t))

bodyOriginal='\n'.join(t for k,a,l,t in body_lines)
old_versions={k:'\n'.join(v) for k,v in old_versions.items()}

# ── navToc : Constitution → chapitres → sections ──
nav_children=[]; cur_ch=None
for e in toc:
    if e['kind']=='chapter':
        cur_ch={'label':e['label'],'anchor':e['anchor'],'children':[]}; nav_children.append(cur_ch)
    elif e['kind']=='section' and cur_ch is not None:
        cur_ch['children'].append({'label':e['label'],'anchor':e['anchor']})
navToc=[{'label':'Constitution de la République d’Haïti (1987)','anchor':toc[0]['anchor'],'children':nav_children}]

structure={'title':'Constitution de la République d’Haïti (1987)','annotationAuthor':'',
  'navToc':navToc,'toc':toc,'connexes':[],'jurisprudence':{},'indexEntries':[],
  'oldVersions':old_versions,'status':status,'labels':labels,'crossRefs':[]}
open(OUT+'/bodyOriginal.txt','w').write(bodyOriginal)
json.dump(structure,open(OUT+'/structure.json','w'),ensure_ascii=False,indent=1)

# rapport
arts=[a for k,a,l,t in body_lines if k=='art']
from collections import Counter
print('bodyOriginal:', len(bodyOriginal), 'car.,', bodyOriginal.count(chr(10))+1, 'lignes')
print('toc:', len(toc), 'en-têtes | kinds:', dict(Counter(e['kind'] for e in toc)))
print('articles:', len(arts), '(uniques:', len(set(arts)),')')
print('anciennes versions:', len(old_versions), '| statuts:', dict(Counter(v for v in status.values())))
print('navToc: 1 groupe →', len(nav_children), 'chapitres')
print('  ex chapitre:', nav_children[1]['label'][:45], '→', len(nav_children[1]['children']),'sections')
print('  chapitre avec sections:', next((c['label'][:40]+' ('+str(len(c['children']))+' sec)' for c in nav_children if c['children']),'—'))
