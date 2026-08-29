#!/usr/bin/env python3
"""§ 8.3 — DÉCOUPE HORS-CORPUS.

Règle appliquée (celle du § 8.3, CORRIGÉE du piège de l'annexe) :
  un document = EN-TÊTE DE L'ACTE + visas/considérants + dispositif + bloc « Donné »
  + signatures + L'ANNEXE QUE SON DISPOSITIF SANCTIONNE, jusqu'à l'EN-TÊTE DE L'ACTE
  SUIVANT ou au colophon.
La frontière est donc l'EN-TÊTE DE L'ACTE, JAMAIS le bloc « Donné » : couper sur
« Donné » orphelinerait l'annexe sanctionnée, qui est transcrite APRÈS lui.

Marqueur d'en-tête d'acte MESURÉ dans les fascicules du lot : la ligne de devise
« LIBERTÉ … ÉGALITÉ … FRATERNITÉ ». Mesure de contrôle : dans les trois fichiers
multi-actes, le nombre de marqueurs égale exactement le nombre de blocs « Donné ».
"""
import os, re, json, hashlib, datetime

DEST = "/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab/scripts/data/marches-publics"
OUT = os.path.join(DEST, 'decoupe')

# ⚠️ la devise emploie selon les fascicules l'espace ordinaire, la TABULATION ou
# l'EM SPACE U+2003 (Charte 2013) : \s les couvre tous en Python.
RE_HEAD = re.compile(r'^\s*LIBERT[ÉE]\s+[ÉE]GALIT[ÉE]\s+FRATERNIT[ÉE]\s*$', re.I)
RE_DONNE = re.compile(r'^[ \t ]*Donn[ée]{1,2}s?[ \t ]+(au|à|en)\b', re.I)
# ⚠️ ÉLARGI le 28 août (D1). Le motif « Achevé d'imprimer » seul MANQUAIT le colophon des
# fascicules anciens (pièces 01, 04, 08), qui s'ouvre directement sur la raison sociale des
# Presses Nationales suivie de leur adresse. Résultat : leur colophon était resté dans le
# corps versé. La seconde alternative ne mord que sur la LIGNE D'ADRESSE (raison sociale +
# rue/Boîte Postale/Tél.), jamais sur une mention des Presses Nationales au fil du texte.
RE_COLO = re.compile(
    r"Achev[ée] d[’'']?[Ii]mprimer"
    r"|Presses Nationales d[’'']Ha[ïi]ti\s*[-•–—]\s*(?:\d|Rue|rue|61,)"
    r"|Presses Nationales d[’'']Ha[ïi]ti\s*•\s*Rue",
    re.I,
)
RE_NOTE = re.compile(r'^[ \t ]*NOTES? DE TRANSCRIPTION[ \t ]*$', re.I)
RE_TETE = re.compile(r'^[ \t ]*Articles?[ \t ]+(\d+[ \t ]*[.\-][ \t ]*\d+|\d+|1[ \t ]*(?:er|ère|ᵉʳ))[ \t ]*(?:[.\-–—:]|$)', re.I)

# Découpe DÉCLARÉE des trois fichiers multi-actes : rang de l'acte (1-based) -> rôle.
# Les rangs et les identifications ont été LUS DU CORPS (en-tête + intitulé + dispositif).
MULTI = {
 'piece-09-arrete-2012-12-21-charte-ethique.txt': [
   ('hors-corpus', "Arrêté déclarant d'utilité publique un terrain situé à l'Avenue Maïs Gâté, Section communale de St-Martin, Commune de Delmas", None),
   ('corpus', "Arrêté du 21 décembre 2012 sanctionnant la Charte d'Éthique applicable aux acteurs des marchés publics et des conventions de concession d'ouvrage de service public", '09'),
 ],
 'piece-19-20-fascicule-sp8-2021-02-04.txt': [
   ('corpus', "Arrêté du 9 décembre 2020 modifiant les Articles 227 et 227.1 de l'Arrêté du 26 octobre 2009 précisant les modalités d'application de la Loi du 10 juin 2009", '19'),
   ('corpus', "Arrêté du 9 décembre 2020 fixant la composition des Commissions Ministérielles des Marchés Publics (CMMP) et des Commissions Spécialisées des Marchés Publics (CSMP)", '20'),
   ('hors-corpus', "Arrêté nommant le Conseil d'Administration a.i. de la Banque Nationale de Crédit (BNC)", None),
   ('hors-corpus', "Arrêté nommant le Conseil d'Administration de la Banque Nationale de Développement Agricole (BNDA)", None),
   ('hors-corpus', "Arrêté nommant la citoyenne Judy BAZILE, Directrice Générale du Conseil National d'Assistance Légale (CNAL)", None),
   ('hors-corpus', "Arrêté — Commission Municipale de Grand-Bassin (Terrier-Rouge)", None),
   ('hors-corpus', "Arrêté — Commission Municipale de Pointe-à-Raquette", None),
   ('hors-corpus', "Arrêté — Commission Municipale de St Raphaël", None),
   ('hors-corpus', "Arrêté — Commission Municipale de Verrettes", None),
 ],
 'piece-21-22-fascicule-sp52-2021-11-09.txt': [
   ('corpus', "Décret du 21 octobre 2021 établissant l'obligation de présenter des informations permettant d'identifier les Bénéficiaires effectifs des Marchés publics et des Concessions", '21'),
   ('corpus', "Arrêté du 21 octobre 2021 fixant les seuils de passation des marchés publics en dessous des seuils d'intervention de la CNMP", '22'),
 ],
}
# Fichiers mono-acte : rôle unique, numéro du texte
MONO = {
 'piece-00-loi-2009-corps.txt': ('00', 3),   # ⚠️ TROIS blocs « Donné » : Sénat, Chambre, Palais National
 'piece-00-loi-2009-table-matieres.txt': ('00-tdm', 0),
 'piece-01-decret-2004-12-03-reglementation.txt': ('01', 1),
 'piece-02-arrete-2009-10-26-modalites.txt': ('02', 1),
 'piece-03-arrete-2009-10-26-manuel-procedures.txt': ('03', 1),
 'piece-04-arrete-2009-10-26-organisation-cnmp.txt': ('04', 1),
 'piece-05-arrete-2011-05-10-dao-travaux-tome1.txt': ('05', 1),
 'piece-06-arrete-2011-05-10-consultants-tome3.txt': ('06', 1),
 'piece-07-arrete-2011-05-10-ccag.txt': ('07', 1),
 'piece-08-arrete-2012-05-25-seuils.txt': ('08', 1),
 'piece-10-arrete-2017-08-30-demande-prix-fournitures.txt': ('10', 1),
 'piece-11-arrete-2017-08-30-procedures-celeres.txt': ('11', 1),
 'piece-12-arrete-2017-08-30-cotations-travaux.txt': ('12', 1),
 'piece-13-arrete-2017-08-30-allege-travaux.txt': ('13', 1),
 'piece-14-arrete-2017-08-30-allege-fournitures.txt': ('14', 1),
 'piece-15-arrete-2017-08-30-allege-consultants.txt': ('15', 1),
 'piece-16-arrete-2019-01-09-defense.txt': ('16', 1),
 'piece-17-arrete-2019-12-26-nomination-cnmp.txt': ('17', 1),
 'piece-18-arrete-2020-02-12-defense.txt': ('18', 1),
 'piece-23-arrete-2022-06-01-seuils.txt': ('23', 1),
 'piece-24-circulaire-010-2023-12-04.txt': ('24', 0),   # § 9.6 : aucune assertion « Donné »
}

os.makedirs(OUT, exist_ok=True)
table = {'genere_le': datetime.datetime.now().isoformat(timespec='seconds'),
         'regle': __doc__.strip(), 'fichiers': [], 'alertes': []}

def zones_annexes(lines):
    """Notes de transcription de l'ÉDITEUR (jamais au dispositif) et queue de fascicule."""
    note = next((i for i, l in enumerate(lines) if RE_NOTE.match(l)), None)
    colo = next((i for i, l in enumerate(lines) if RE_COLO.search(l)), None)
    return note, colo

for f in sorted(list(MULTI) + list(MONO)):
    p = os.path.join(DEST, f)
    lines = open(p, encoding='utf-8').read().split('\n')
    heads = [i for i, l in enumerate(lines) if RE_HEAD.match(l)]
    donnes = [i for i, l in enumerate(lines) if RE_DONNE.match(l)]
    note, colo = zones_annexes(lines)
    rec = {'piece': f, 'lignes': len(lines), 'entetes_acte': heads, 'blocs_donne': donnes,
           'note_transcription_ligne': note, 'colophon_ligne': colo, 'segments': []}

    if f in MULTI:
        decl = MULTI[f]
        if len(heads) != len(decl):
            table['alertes'].append(f"{f} : {len(heads)} en-têtes d'acte mesurés ≠ {len(decl)} déclarés — ARRÊT")
            rec['ERREUR'] = 'nombre d\'actes'
            table['fichiers'].append(rec); continue
        if len(donnes) != len(heads):
            table['alertes'].append(f"{f} : {len(donnes)} blocs « Donné » ≠ {len(heads)} en-têtes d'acte — ARRÊT")
        # fin du dernier acte : première des bornes de queue (circulaire 009 / abonnement / note / colophon / fin)
        bornes_fin = [x for x in (note, colo) if x is not None]
        for k, (role, titre, num) in enumerate(decl):
            deb = heads[k]
            if k + 1 < len(heads):
                fin = heads[k + 1]
            else:
                cands = [x for x in bornes_fin if x > deb]
                # la queue de fascicule commence au 1er marqueur non-acte trouvé après le dernier « Donné »
                fin = min(cands) if cands else len(lines)
                # SP8 : la Circulaire 009 (sans en-tête de devise) suit le 9e arrêté
                for i in range(donnes[-1] + 1, fin):
                    if re.match(r'^\s*CIRCULAIRE\s+N', lines[i].strip(), re.I):
                        fin = i; break
                for i in range(donnes[-1] + 1, fin):
                    if re.match(r'^\s*AVIS RELATIF', lines[i].strip(), re.I):
                        fin = i; break
            seg = lines[deb:fin]
            nd = sum(1 for l in seg if RE_DONNE.match(l))
            nt = sum(1 for l in seg if RE_TETE.match(l))
            s = {'rang': k + 1, 'role': role, 'texte_no': num, 'titre_lu_du_corps': titre,
                 'l_debut': deb, 'l_fin_exclue': fin, 'lignes': fin - deb,
                 'blocs_donne': nd, 'tetes_article': nt,
                 'mentionne_annexe': any(re.search(r'auquel (?:sont|est) annex|annexé', l, re.I) for l in seg)}
            if role == 'corpus':
                nom = f"texte-{num}-{f[len('piece-'):].replace('.txt','')}.txt"
                nom = re.sub(r'^texte-(\d+)-\d+(?:-\d+)?-', r'texte-\1-', nom)
                s['fichier'] = nom
                with open(os.path.join(OUT, nom), 'w', encoding='utf-8', newline='\n') as g:
                    g.write('\n'.join(seg).rstrip('\n') + '\n')
                s['md5_segment'] = hashlib.md5(('\n'.join(seg).rstrip('\n') + '\n').encode()).hexdigest()
            if nd != 1:
                table['alertes'].append(f"{f} acte {k+1} ({role}) : {nd} bloc(s) « Donné » — attendu 1")
            rec['segments'].append(s)
        # zones non-acte
        rec['zone_liminaire_fascicule'] = [0, heads[0]]
        rec['zone_queue'] = [rec['segments'][-1]['l_fin_exclue'], len(lines)]
    else:
        num, nd_att = MONO[f]
        nd = len(donnes)
        fin = len(lines)   # un fichier MONO-ACTE ne se découpe pas : il est entier
        deb = 0
        s = {'rang': 1, 'role': 'corpus', 'texte_no': num,
             'l_debut': deb, 'l_fin_exclue': fin, 'lignes': fin - deb,
             'blocs_donne': nd, 'blocs_donne_attendus': nd_att,
             'tetes_article': sum(1 for l in lines if RE_TETE.match(l)),
             'mentionne_annexe': any(re.search(r'auquel (?:sont|est) annex|annexé', l, re.I) for l in lines),
             'entete_acte_present': bool(heads)}
        if nd != nd_att:
            table['alertes'].append(f"{f} : {nd} bloc(s) « Donné » ≠ {nd_att} attendu(s)")
        rec['segments'].append(s)
    table['fichiers'].append(rec)

json.dump(table, open(os.path.join(DEST, 'table-decoupe.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

print(f"{'pièce':52} {'rang':>4} {'rôle':11} {'txt':>4} {'l.déb':>6} {'l.fin':>6} {'Donné':>6} {'têtes':>6} annexe")
for r in table['fichiers']:
    for s in r['segments']:
        print(f"{r['piece'][:50]:52} {s['rang']:>4} {s['role']:11} {str(s.get('texte_no') or '—'):>4} "
              f"{s['l_debut']:>6} {s['l_fin_exclue']:>6} {s['blocs_donne']:>6} {s['tetes_article']:>6} "
              f"{'oui' if s['mentionne_annexe'] else '—'}")
print()
print(f"ALERTES : {len(table['alertes'])}")
for a in table['alertes']: print('  ⚠️', a)
