#!/usr/bin/env python3
"""Active le tableau de bord visuel sans toucher aux écritures Firebase existantes."""
from pathlib import Path

def patch(path, old, new):
    file=Path(path)
    text=file.read_text(encoding='utf-8')
    if new in text:
        print(f'Déjà intégré : {path}')
        return
    if text.count(old)!=1:
        raise RuntimeError(f'Ancrage absent ou ambigu dans {path}: {old[:100]!r}')
    file.write_text(text.replace(old,new),encoding='utf-8')
    print('Intégré :',path)

legacy='MATERIEL-LEGACY.html'
patch(legacy,'<link rel="stylesheet" href="inovtec-stock-bureau.css?v=20260919-bureau1">','<link rel="stylesheet" href="inovtec-stock-bureau.css?v=20260919-bureau1">\n<link rel="stylesheet" href="inovtec-materiel-visual-v3.css?v=20260919-v3">')
patch(legacy,'<script defer src="inovtec-stock-bureau.js?v=20260919-bureau1"></script>','<script defer src="inovtec-stock-bureau.js?v=20260919-bureau1"></script>\n<script defer src="inovtec-materiel-visual-v3.js?v=20260919-v3"></script>')
outer='MATERIEL.html'
patch(outer,'<link rel="stylesheet" href="inovtec-shell-v2.css?v=20260815-2">','<link rel="stylesheet" href="inovtec-shell-v2.css?v=20260815-2">\n<link rel="stylesheet" href="inovtec-materiel-visual-shell-v3.css?v=20260919-v3">')
patch(outer,'MATERIEL-LEGACY.html?v=20260919-office-stock1','MATERIEL-LEGACY.html?v=20260919-visual-v3')
patch(outer,'</body>\n</html>','<script defer src="inovtec-materiel-visual-shell-v3.js?v=20260919-v3"></script>\n</body>\n</html>')
stock='inovtec-stock-bureau.js'
old="['ivOfficeIn','ivOfficeOut','ivOfficeCount'].forEach(id=>$(id).disabled=!online||busy);"
new=old+"\n window.__IV_OFFICE_DASHBOARD_SNAPSHOT__={items,reassort,movements,online};window.dispatchEvent(new CustomEvent('iv-office-dashboard-update'));"
patch(stock,old,new)
shell='inovtec-materiel-visual-shell-v3.js'
patch(shell,"add.onclick=()=>{const doc=frame.contentDocument;doc?.getElementById('ivAddButton')?.click()||doc?.getElementById('newBtn')?.click()};","add.onclick=()=>{const doc=frame.contentDocument;const button=doc?.getElementById('ivAddButton')||doc?.getElementById('newBtn');button?.click()};")
print('OK : assets visuels raccordés, données du stock exposées en lecture à la présentation.')
