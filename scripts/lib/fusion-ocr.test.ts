import { describe, expect, it } from 'vitest'
import { aligner, debris, fusionner, tesseractPropre } from './fusion-ocr'

describe('fusionner — Claude complété par Tesseract', () => {
  it('réinsère deux mots que Claude a sautés (LM2020-50 : « sur ordinateur »)', () => {
    const claude = "écrit au recto d'une feuille de papier blanc ordinaire, daté à Port-au-Prince le 24 avril 2019"
    const tess = "écrit au recto d’une feuille de\npapier blanc ordinaire sur ordinateur, daté à\nPort-au-Prince le 24 avril 2019"
    const f = fusionner(claude, tess)
    expect(f.reinseres).toEqual(['sur ordinateur,'])
    expect(f.texte).toContain('papier blanc ordinaire, sur ordinateur, daté')
  })

  it('réinsère un mot isolé véritable (LM2021-100 : « également »)', () => {
    const f = fusionner("Elle effectue des prélèvements et des analyses", 'Elle effectue également des prélèvements et des analyses')
    expect(f.texte).toBe('Elle effectue également des prélèvements et des analyses')
  })

  it('ne reprend ni le titre courant ni le bruit de scan', () => {
    const claude = 'Le citoyen Bocchit EDMOND est nommé Ministre des Affaires Étrangères'
    const tess = '<< LE MONITEUR >> N° 81 - Mercredi 22 Mai 2019\nn Y6 ME P\nLe citoyen Bocchit EDMOND est nommé Ministre des Affaires Etrangéres'
    const f = fusionner(claude, tess)
    expect(f.reinseres).toEqual([])
    expect(f.texte).toBe(claude)
  })

  it('un bloc lu dans un autre ordre (colonnes, manchette) n’est jamais doublé', () => {
    const claude = 'Article premier. Le citoyen est nommé. Article deux. Le présent arrêté sera publié.'
    const tess = 'Article deux. Le présent arrêté sera publié.\nArticle premier. Le citoyen est nommé.'
    expect(fusionner(claude, tess).reinseres).toEqual([])
    expect(fusionner('URGENCE URGENCE affiche du ministère de la santé', 'affiche du ministère URGENCE URGENCE de la santé').reinseres).toEqual([])
  })

  it('les fautes de lettres de Tesseract ne remplacent jamais le texte de Claude', () => {
    const f = fusionner('Vu le Décret du 17 mai 2005 ; Ils ont vingt-cinq ans', 'Vu le Décrèt du 17 mai 2005 ; IIs ont vint-cinq ans')
    expect(f.texte).toBe('Vu le Décret du 17 mai 2005 ; Ils ont vingt-cinq ans')
  })

  it('signale une divergence de plusieurs mots sans la trancher', () => {
    const f = fusionner('Le terrain mesure trois cents mètres carrés au total', 'Le terrain mesure deux cent quarante pieds au total')
    expect(f.desaccords.length).toBe(1)
    expect(f.texte).toContain('trois cents mètres carrés')
  })
})

describe('outils', () => {
  it('tesseractPropre recolle les césures et les traits d’union espacés', () => {
    expect(tesseractPropre('Port- au-Prince, enregis-\ntrement')).toBe('Port-au-Prince, enregistrement')
  })
  it('debris reconnaît un titre courant et du bruit', () => {
    expect(debris('No. 50 - Mardi 15 Mars 2016')).toBe(true)
    expect(debris('æ,wä ’æ._')).toBe(true)
    expect(debris('sur ordinateur')).toBe(false)
  })
  it('aligner rend des opérations à la difflib', () => {
    const ops = aligner(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'e'])
    expect(ops.map((o) => o.op)).toEqual(['egal', 'retire', 'egal', 'ajoute'])
  })
})
