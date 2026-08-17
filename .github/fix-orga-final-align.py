from pathlib import Path

# 1) Suppression définitive de l'ancien décalage sticky de 82 px.
p = Path('inovtec-common.css')
s = p.read_text(encoding='utf-8')
s = s.replace('position:sticky;top:82px;z-index:30;padding:12px;', 'position:sticky;top:0;z-index:30;padding:12px;')
s = s.replace('section.card:has(#taskForm){top:10px}', 'section.card:has(#taskForm){top:0}')
p.write_text(s, encoding='utf-8')

# 2) Override final: formulaire à gauche, même hauteur de départ que le tableau,
#    fixe ; seule la colonne de droite défile. Conserver 2 colonnes dès 620 px.
p = Path('inovtec-visual-v2.css')
s = p.read_text(encoding='utf-8')
marker = '/* ORGANISATION FINAL ALIGNMENT 20260817 */'
if marker not in s:
    s += r'''

/* ORGANISATION FINAL ALIGNMENT 20260817 */
body.iv-visual-v2.iv-mode-organisation,
body.iv-visual-v2.iv-mode-organisation #app{
  height:100vh!important;
  min-height:0!important;
  overflow:hidden!important;
}
body.iv-visual-v2.iv-mode-organisation main.page{
  height:100vh!important;
  min-height:0!important;
  overflow:hidden!important;
  display:grid!important;
  grid-template-columns:minmax(285px,350px) minmax(0,1fr)!important;
  grid-template-rows:minmax(0,1fr) auto!important;
  gap:10px!important;
  align-items:start!important;
  padding:0 4px 4px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){
  grid-column:1!important;
  grid-row:1 / 3!important;
  position:sticky!important;
  top:0!important;
  align-self:start!important;
  margin:0!important;
  padding:8px!important;
  overflow:visible!important;
  max-height:none!important;
  z-index:20!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){
  grid-column:2!important;
  grid-row:1!important;
  align-self:stretch!important;
  height:100%!important;
  min-height:0!important;
  max-height:100%!important;
  margin:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior:contain!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
  grid-column:2!important;
  grid-row:2!important;
  margin:0!important;
  max-height:105px!important;
  overflow:auto!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .section-title{
  margin-bottom:3px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .section-title h2{
  font-size:14px!important;
  line-height:1.05!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .field{
  gap:1px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .field label{
  font-size:9px!important;
  line-height:1!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) input,
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) select{
  height:29px!important;
  min-height:29px!important;
  padding:4px 8px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) textarea{
  height:38px!important;
  min-height:38px!important;
  max-height:38px!important;
  padding:4px 8px!important;
  resize:none!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) #taskForm .field[style*="margin-top"]{
  margin-top:3px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) #ivOrgaRefs{
  margin-top:3px!important;
  gap:6px!important;
  grid-template-columns:1fr 1fr!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) #taskForm>.btn-primary{
  width:100%!important;
  min-height:31px!important;
  height:31px!important;
  margin-top:4px!important;
  padding:4px 9px!important;
}
@media(max-width:619px){
  body.iv-visual-v2.iv-mode-organisation,
  body.iv-visual-v2.iv-mode-organisation #app{
    height:auto!important;
    overflow:auto!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page{
    height:auto!important;
    overflow:visible!important;
    grid-template-columns:1fr!important;
    grid-template-rows:auto auto auto!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){
    grid-column:1!important;
    grid-row:1!important;
    position:sticky!important;
    top:0!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){
    grid-column:1!important;
    grid-row:2!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
    grid-column:1!important;
    grid-row:3!important;
  }
}
'''
p.write_text(s, encoding='utf-8')

# 3) Forcer le navigateur à charger les nouvelles feuilles de style.
p = Path('inovtec-visual-runtime.js')
s = p.read_text(encoding='utf-8')
s = s.replace('inovtec-visual-v2.css?v=20260815-4', 'inovtec-visual-v2.css?v=20260817-orga-final')
p.write_text(s, encoding='utf-8')

p = Path('ORGA-LEGACY.html')
s = p.read_text(encoding='utf-8')
s = s.replace('href="inovtec-common.css"', 'href="inovtec-common.css?v=20260817-orga-final"')
p.write_text(s, encoding='utf-8')
