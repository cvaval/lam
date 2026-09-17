/**
 * Les user-agents ci-dessous sont ceux du journal de production (`LOGIN_OK`, lus le
 * 16 sept. 2026), copiés tels quels — pas recomposés. Chaque cas verrouille un piège d'ordre :
 * Edge avant Chrome, Chrome avant Safari, Claude/Electron avant Chrome, iPhone avant macOS,
 * Android avant Linux.
 */
import { describe, it, expect } from 'vitest'
import { decrireAppareil } from './appareil'

const UA = {
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Safari/605.1.15',
  claudeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.34493.1 Chrome/148.0.7778.280 Electron/42.9.2 Safari/537.36',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
  node: 'node',
  curl: 'curl/8.7.1',
  // Non vus au journal, mais attendus : Firefox, iPad, Samsung, Chrome iOS.
  firefoxWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Mobile/15E148 Safari/604.1',
}

describe('les familles vues au journal de production', () => {
  it('Safari sur macOS — la version est celle de « Version/ », pas de « Safari/605 »', () => {
    expect(decrireAppareil(UA.safariMac)).toMatchObject({ navigateur: 'Safari 26', systeme: 'macOS', type: 'ordinateur', libelle: 'Safari 26 sur macOS', reconnu: true })
  })
  it('le navigateur intégré de Claude se dit Chrome et Safari : c’est Claude (Electron)', () => {
    expect(decrireAppareil(UA.claudeMac)).toMatchObject({ navigateur: 'Claude (Electron)', systeme: 'macOS', libelle: 'Claude (Electron) sur macOS' })
  })
  it('Chrome sur Windows', () => {
    expect(decrireAppareil(UA.chromeWin).libelle).toBe('Chrome 153 sur Windows')
  })
  it('Edge se dit Chrome : Edge gagne', () => {
    expect(decrireAppareil(UA.edgeWin).libelle).toBe('Edge 153 sur Windows')
  })
  it('Chrome sur macOS', () => {
    expect(decrireAppareil(UA.chromeMac).libelle).toBe('Chrome 149 sur macOS')
  })
  it('un iPhone se dit « like Mac OS X » : iPhone gagne, type mobile', () => {
    expect(decrireAppareil(UA.safariIphone)).toMatchObject({ navigateur: 'Safari 26', systeme: 'iPhone', type: 'mobile', libelle: 'Safari 26 sur iPhone' })
  })
  it('Android se dit Linux : Android gagne, « Mobile » fait le type', () => {
    expect(decrireAppareil(UA.chromeAndroid)).toMatchObject({ navigateur: 'Chrome 149', systeme: 'Android', type: 'mobile' })
  })
})

describe('ce que la table ne reconnaît pas se dit tel quel', () => {
  it.each([UA.node, UA.curl, '', '   '])('« %s » → navigateur non reconnu, jamais deviné', (ua) => {
    expect(decrireAppareil(ua)).toMatchObject({ reconnu: false, libelle: 'Navigateur non reconnu', type: 'inconnu' })
  })
  it('null et undefined aussi', () => {
    expect(decrireAppareil(null).reconnu).toBe(false)
    expect(decrireAppareil(undefined).reconnu).toBe(false)
  })
  it('un Mozilla sans navigateur connu garde le système mais reste non reconnu', () => {
    const a = decrireAppareil('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Inconnu/1.0')
    expect(a.reconnu).toBe(false)
    expect(a.systeme).toBe('Windows')
    expect(a.libelle).toBe('Navigateur non reconnu')
  })
})

describe('familles attendues, non encore vues', () => {
  it('Firefox sur Windows', () => expect(decrireAppareil(UA.firefoxWin).libelle).toBe('Firefox 132 sur Windows'))
  it('Safari sur iPad, type tablette', () => expect(decrireAppareil(UA.ipad)).toMatchObject({ systeme: 'iPad', type: 'tablette', navigateur: 'Safari 17' }))
  it('Samsung Internet se dit Chrome : Samsung gagne', () => expect(decrireAppareil(UA.samsung).navigateur).toBe('Samsung Internet 26'))
  it('Chrome sur iPhone (CriOS)', () => expect(decrireAppareil(UA.chromeIos).libelle).toBe('Chrome 128 sur iPhone'))
})
