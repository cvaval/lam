#!/usr/bin/env python3
"""§ 8.2 — SÉCURISER : ré-extrait chaque .docx d'origine avec l'extracteur canonique
(tabulations préservées), écrit les pièces sous des noms stables dans le dépôt, et
construit le manifeste d'empreintes : md5 des .docx D'ORIGINE et md5 des extractions,
étiquetés séparément (§ 4). Compare aussi à l'extraction volatile du scratchpad et
SIGNALE toute divergence — jamais d'ajustement silencieux."""
import hashlib, json, os, re, sys, datetime, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extraire_canon import paras

DEST = "/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab/scripts/data/marches-publics"
DL = os.path.expanduser('~/Downloads')
SCRATCH = "/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/marches"
PLAN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plan-copie.json'), encoding='utf-8'))

# ⚠️ motif de tête : accepte « Articles N » (§ 9.1) et les décimales à POINT ou TIRET (§ 9.3)
# ⚠️ MOTIF DE TÊTE VALIDÉ le 27 août : ligne entière, « Article » OU « Articles »
# (pluriel sic du J.O., § 9.1), numéro simple / décimal à POINT ou à TIRET (§ 9.3)
# ou « 1er », suivi de . - – — OU DES DEUX-POINTS (têtes des contrats-types annexés
# aux arrêtés de 2017). Ce motif retrouve EXACTEMENT les 22 comptes du § 8.2.
RE_TETE = re.compile(r'^[ \t\u00a0]*Articles?[ \t\u00a0]+(\d+[ \t\u00a0]*[.\-][ \t\u00a0]*\d+|\d+|1[ \t\u00a0]*(?:er|ère|ᵉʳ))[ \t\u00a0]*(?:[.\-–—:]|$)', re.I)

# Les 16 md5 courts EXPRESSÉMENT écrits dans le prompt (§ 4, § 4.1, § 4.2, § 11.2).
DU_PROMPT = {'ef0705bf51', '0b1fac6133', '88f2b63644', '974b09e432', '832c3976b5', '1c19ae9907',
             '708db83e5d', 'f9fa7ef489', 'b31909ac83', '2466f6637d', 'fa178c8d34', '952a9c370e',
             '5bece78c8b', 'a85cae5e01', 'ff16667a79', 'cc799360bd'}

def md5b(b): return hashlib.md5(b).hexdigest()
def md5f(p):
    with open(p, 'rb') as f: return md5b(f.read())

def tetes(txt):
    out = []
    for l in txt.split('\n'):
        m = RE_TETE.match(l)
        if m: out.append(re.sub(r'[\s\u00a0]+', '', m.group(1)))
    return out

ATTENDU_8_2 = {
 'piece-00-loi-2009-corps.txt':179,'piece-00-loi-2009-table-matieres.txt':0,
 'piece-01-decret-2004-12-03-reglementation.txt':118,'piece-02-arrete-2009-10-26-modalites.txt':387,
 'piece-04-arrete-2009-10-26-organisation-cnmp.txt':64,'piece-05-arrete-2011-05-10-dao-travaux-tome1.txt':2,
 'piece-06-arrete-2011-05-10-consultants-tome3.txt':2,'piece-07-arrete-2011-05-10-ccag.txt':2,
 'piece-08-arrete-2012-05-25-seuils.txt':11,'piece-09-arrete-2012-12-21-charte-ethique.txt':32,
 'piece-10-arrete-2017-08-30-demande-prix-fournitures.txt':17,'piece-11-arrete-2017-08-30-procedures-celeres.txt':30,
 'piece-12-arrete-2017-08-30-cotations-travaux.txt':30,'piece-13-arrete-2017-08-30-allege-travaux.txt':6,
 'piece-14-arrete-2017-08-30-allege-fournitures.txt':24,'piece-15-arrete-2017-08-30-allege-consultants.txt':22,
 'piece-16-arrete-2019-01-09-defense.txt':23,'piece-17-arrete-2019-12-26-nomination-cnmp.txt':4,
 'piece-18-arrete-2020-02-12-defense.txt':24,'piece-19-20-fascicule-sp8-2021-02-04.txt':34,
 'piece-21-22-fascicule-sp52-2021-11-09.txt':41,'piece-23-arrete-2022-06-01-seuils.txt':19,
 'piece-24-circulaire-010-2023-12-04.txt':0,
}

def ancre(t):
    return 'art-' + re.sub(r'[.\-]', '-', t)

def traiter(entree, groupe):
    src = os.path.join(DL, entree['docx'])
    if not os.path.exists(src):
        return {'cible': entree['cible'], 'ERREUR': f"docx introuvable : {src}"}
    md5_docx = md5f(src)
    corps = '\n'.join(paras(src)) + '\n'
    dst = os.path.join(DEST, entree['cible'])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write(corps)
    t = tetes(corps)
    # confrontation à l'extraction volatile du scratchpad
    sp = os.path.join(SCRATCH, entree['txt_scratchpad'])
    div = None
    if os.path.exists(sp):
        spc = open(sp, encoding='utf-8').read()
        if spc.rstrip('\n') != corps.rstrip('\n'):
            a = [l.strip() for l in spc.split('\n') if l.strip()]
            b = [l.strip() for l in corps.split('\n') if l.strip()]
            div = {
                'md5_txt_scratchpad': md5f(sp),
                'lignes_scratchpad': len(a), 'lignes_reextraction': len(b),
                'tabulations_scratchpad': spc.count('\t'), 'tabulations_reextraction': corps.count('\t'),
                'tetes_scratchpad': len(tetes(spc)), 'tetes_reextraction': len(t),
            }
    return {
        'groupe': groupe,
        'textes': entree.get('textes'),
        'cible': entree['cible'],
        'libelle': entree.get('libelle') or entree.get('motif'),
        'docx_origine': entree['docx'],
        'md5_docx_origine': md5_docx,
        'md5_docx_attendu_prompt': entree['md5_docx_attendu'],
        'md5_docx_concordant': md5_docx.startswith(entree['md5_docx_attendu']),
        # ⚠️ honnêteté : le prompt ne chiffre QUE 16 des 31 .docx. Pour les autres, ce
        # manifeste FIXE la référence (première mesure) — il ne CONFIRME rien.
        'md5_docx_origine_de_lattendu': ('prompt § 4/4.1/4.2/11.2'
            if entree['md5_docx_attendu'] in DU_PROMPT else 'première mesure — le prompt ne le chiffre pas'),
        'octets_docx': os.path.getsize(src),
        'md5_extraction': md5b(corps.encode('utf-8')),
        'octets_extraction': len(corps.encode('utf-8')),
        'paragraphes': corps.count('\n'),
        'paragraphes_non_vides': sum(1 for l in corps.split('\n') if l.strip()),
        'tabulations': corps.count('\t'),
        'md5_txt_scratchpad': md5f(sp) if os.path.exists(sp) else None,
        'nb_tetes_article': len(t),
        'tetes_attendues_prompt_8_2': ATTENDU_8_2.get(entree['cible']),
        'tetes_concordantes': ATTENDU_8_2.get(entree['cible']) is None or ATTENDU_8_2[entree['cible']] == len(t),
        'apostrophes_droites': corps.count("'"),
        'apostrophes_courbes': corps.count('\u2019'),
        'espaces_insecables': corps.count('\u00a0'),
        'exposants_unicode': {k: corps.count(k) for k in ('\u1d49', '\u02b3', '\u00ba', '\u1d48') if corps.count(k)},
        'note_de_transcription_editeur': [i for i, l in enumerate(corps.split('\n'))
                                          if re.search(r'NOTES? DE TRANSCRIPTION|Note de transcription', l)],
        'tetes_article': t,
        'ancres': [ancre(x) for x in t],
        'divergence_scratchpad': div,
    }

manif = {'genere_le': datetime.datetime.now().isoformat(timespec='seconds'),
         'extracteur': 'ir2005/extraire.py (tabulations <w:tab/> et runs barrés préservés)',
         'source_docx': DL, 'destination': DEST, 'pieces': []}
for g in ('retenues', 'ecartees', 'hors_liste'):
    for e in PLAN[g]:
        manif['pieces'].append(traiter(e, g))

# relevés + avenant — le scratchpad est VOLATILE : on ne recopie que s'il est encore là,
# et on n'écrase jamais une copie déjà durable.
copies = []
for src_nom, dst_nom in (('releve-identification.json', 'releve-identification.json'),
                         ('releve-graphe.json', 'releve-graphe.json'),
                         ('releve-base.json', 'releve-base.json'),
                         ('AVENANT-loi-mere-2009.md', 'avenant-loi-mere-2009.md'),
                         ('Le_Moniteur_Special_35_6_octobre_2017_Arrete_Manuel_DAO_Alle.txt',
                          'divergences/sp35-2017-extraction-scratchpad-sans-tabulations.txt')):
    src, dst = os.path.join(SCRATCH, src_nom), os.path.join(DEST, dst_nom)
    if os.path.exists(src) and not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst); copies.append(dst_nom)
manif['releves_copies'] = copies or 'déjà durables (scratchpad purgé ou copies présentes)'

json.dump(manif, open(os.path.join(DEST, 'manifeste-empreintes.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

# ── rapport ──
bad = [p for p in manif['pieces'] if p.get('ERREUR') or not p.get('md5_docx_concordant')]
print(f"pièces traitées : {len(manif['pieces'])}  (retenues {sum(1 for p in manif['pieces'] if p['groupe']=='retenues')},"
      f" écartées {sum(1 for p in manif['pieces'] if p['groupe']=='ecartees')},"
      f" hors-liste {sum(1 for p in manif['pieces'] if p['groupe']=='hors_liste')})")
conf = [p for p in manif['pieces'] if p.get('md5_docx_origine_de_lattendu','').startswith('prompt')]
print(f"md5 .docx CONFIRMÉS contre le prompt : {len(conf)}/31 (le prompt n'en chiffre que 16) ;"
      f" les {31-len(conf)} autres sont FIXÉS ici par première mesure")
print(f"md5 .docx NON concordants avec le prompt : {len(bad)}")
for p in bad: print('  ⚠️', p['cible'], p.get('ERREUR') or f"{p['md5_docx_origine'][:10]} ≠ {p['md5_docx_attendu_prompt']}")
print()
print(f"{'cible':58} {'md5docx':11} {'md5extr':11} {'¶':>5} {'TAB':>4} {'têtes':>6}")
for p in manif['pieces']:
    if p.get('ERREUR'): continue
    print(f"{p['cible'][:56]:58} {p['md5_docx_origine'][:10]:11} {p['md5_extraction'][:10]:11} "
          f"{p['paragraphes_non_vides']:>5} {p['tabulations']:>4} {p['nb_tetes_article']:>6}")
nc = [p for p in manif['pieces'] if p.get('tetes_concordantes') is False]
print(f"comptes de têtes NON concordants avec le § 8.2 : {len(nc)}")
for p in nc: print('  ⚠️', p['cible'], p['nb_tetes_article'], '≠', p['tetes_attendues_prompt_8_2'])
print()
dv = [p for p in manif['pieces'] if p.get('divergence_scratchpad')]
print(f"divergences extraction volatile ↔ ré-extraction : {len(dv)}")
for p in dv:
    d = p['divergence_scratchpad']
    print(f"  ⚠️ {p['cible']} : lignes {d['lignes_scratchpad']}→{d['lignes_reextraction']}, "
          f"TAB {d['tabulations_scratchpad']}→{d['tabulations_reextraction']}, "
          f"têtes {d['tetes_scratchpad']}→{d['tetes_reextraction']}")
