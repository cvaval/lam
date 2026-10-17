"""Codes pénal et de procédure pénale révisés (décrets du 24 juin 2025) — la TRANSCRIPTION, page par page.

    python3 -I scripts/data/codes-penaux-2025/assembler.py cp  <dossier OCR LM2025-SP44>
    python3 -I scripts/data/codes-penaux-2025/assembler.py cpp <dossier OCR LM2025-SP44-A>

Lit les `pNNN.fusion.txt` de l'OCR combiné (`scripts/ocr-combine-pdf.ts --fusionner` : Opus 5.5 + Tesseract,
même chaîne que le Code fiscal 2026) et écrit `<code>/transcription.txt` : une marque `⟦pNNN⟧` par page,
puis ses lignes non vides, telles quelles. C'est le TÉMOIN versionné : la collation et le parseur ne lisent
plus que lui (le dossier OCR vit hors du dépôt). Rien en base.

Seules les pages de l'acte sont prises (`PAGES`) : le Spécial n° 44 porte aussi, p. 183-184, un avis de la
DGI, qui est un autre acte. Le Spécial n° 44-A finit p. 240 sur la dernière signature, puis la mention de
l'imprimeur (« Achevé d'imprimer… ») : le parseur coupe après la dernière signature.
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
PAGES = {'cp': (1, 182), 'cpp': (1, 240)}


def main(code, dossier):
    a, b = PAGES[code]
    out = []
    for p in range(a, b + 1):
        f = os.path.join(dossier, f'p{p:03d}.fusion.txt')
        if not os.path.exists(f):
            sys.exit(f'⛔ page {p} sans fusion ({f}) — lancer ocr-combine-pdf.ts --fusionner')
        out.append(f'⟦p{p:03d}⟧')
        out += [ln.rstrip() for ln in open(f, encoding='utf8').read().split('\n') if ln.strip()]
    os.makedirs(os.path.join(ICI, code), exist_ok=True)
    cible = os.path.join(ICI, code, 'transcription.txt')
    open(cible, 'w', encoding='utf8').write('\n'.join(out) + '\n')
    print(f'{cible} : {b - a + 1} pages, {len(out)} lignes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
