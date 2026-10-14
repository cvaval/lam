import json,re,sys,unicodedata
SP=sys.argv[1]
toc=[x['text'] for x in json.load(open(f'{SP}/docx/toc.json')) if x['k']=='p' and x['text']][1:]
strip=lambda s: re.sub(r'\s*\d{1,3}$','',s).strip()
toc2=[strip(s) for s in toc]
it=json.load(open(f'{SP}/docx/cf.json'))
body=[(i,x) for i,x in enumerate(it) if x['k']=='p' and x['text']]
def an(s): return re.sub(r'[^0-9a-zà-ÿœ]','',s.replace('’',"'").lower())
start=[k for k,(i,x) in enumerate(body) if x['text'].startswith('LIVRE I :')][0]
k=start; res=[]; miss=[]
for e in toc2:
    ne=an(e); found=None
    for j in range(k,min(len(body),k+400)):
        t=body[j][1]['text']
        if re.match(r'^Article\s*\d|^Article 1er',t): continue
        acc=''
        for m in range(4):
            if j+m>=len(body): break
            acc+=an(body[j+m][1]['text'])
            if acc==ne: found=(j,m+1);break
            if not ne.startswith(acc): break
        if found: break
    if not found: miss.append((e,k)); continue
    res.append((e,found)); k=found[0]+found[1]
print('appariés',len(res),'manquants',len(miss))
for e,k in miss[:12]:
    print('MANQUE:',e)
    for j in range(k,k+0): pass
json.dump([(e,j,m,[body[j+x][0] for x in range(m)]) for e,(j,m) in res],open(f'{SP}/coll/tocmatch.json','w'),ensure_ascii=False)
