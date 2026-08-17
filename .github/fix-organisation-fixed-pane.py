from pathlib import Path

p = Path('inovtec-visual-v2.css')
s = p.read_text(encoding='utf-8')
marker = '/* ORGANISATION FIXED FORM + INDEPENDENT BOARD SCROLL */'
if marker in s:
    raise SystemExit('Override already present')

append = r'''

/* ORGANISATION FIXED FORM + INDEPENDENT BOARD SCROLL */
html:has(body.iv-visual-v2.iv-mode-organisation),
body.iv-visual-v2.iv-mode-organisation,
body.iv-visual-v2.iv-mode-organisation #app{
  height:100%!important;
  min-height:0!important;
  overflow:hidden!important;
}
body.iv-visual-v2.iv-mode-organisation main.page{
  height:100vh!important;
  max-height:100vh!important;
  min-height:0!important;
  overflow:hidden!important;
  padding:2px 4px 4px!important;
  display:grid!important;
  grid-template-columns:minmax(300px,.62fr) minmax(0,1.8fr)!important;
  grid-template-rows:minmax(0,1fr) auto!important;
  gap:12px!important;
  align-items:stretch!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){
  grid-column:1!important;
  grid-row:1 / 3!important;
  position:relative!important;
  top:auto!important;
  align-self:start!important;
  overflow:visible!important;
  max-height:none!important;
  margin:0!important;
  padding:10px!important;
  z-index:5!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){
  grid-column:2!important;
  grid-row:1!important;
  min-height:0!important;
  max-height:100%!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
  grid-column:2!important;
  grid-row:2!important;
  max-height:150px!important;
  overflow:auto!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .section-title{
  margin-bottom:5px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .section-title h2{
  font-size:15px!important;
  line-height:1.1!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .field{
  gap:2px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) .field label{
  font-size:10px!important;
  line-height:1.05!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) input,
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) select{
  height:32px!important;
  min-height:32px!important;
  padding:5px 8px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) textarea{
  height:44px!important;
  min-height:44px!important;
  max-height:44px!important;
  padding:5px 8px!important;
  resize:none!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) #taskForm .field[style*="margin-top"]{
  margin-top:4px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1) #taskForm>.btn-primary{
  width:100%!important;
  min-height:34px!important;
  margin-top:5px!important;
  padding:6px 10px!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2) .board{
  min-height:0!important;
}

@media(max-width:1050px){
  body.iv-visual-v2.iv-mode-organisation main.page{
    grid-template-columns:1fr!important;
    grid-template-rows:auto minmax(0,1fr) auto!important;
    gap:8px!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){
    grid-column:1!important;
    grid-row:1!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){
    grid-column:1!important;
    grid-row:2!important;
  }
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
    grid-column:1!important;
    grid-row:3!important;
    max-height:110px!important;
  }
}
'''

p.write_text(s + append, encoding='utf-8')
