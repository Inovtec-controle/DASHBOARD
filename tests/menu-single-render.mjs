import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({serviceWorkers:'block',viewport:{width:1300,height:850}});
try {
  await page.addInitScript(() => {
    window.__ivMenuVersions = [];
    const attach = () => {
      const nav = document.getElementById('desktopNav');
      if (!nav) return false;
      new MutationObserver(() => window.__ivMenuVersions.push([...nav.querySelectorAll('a')].map(a => a.dataset.ivMenuKey).join('|'))).observe(nav, {childList:true});
      return true;
    };
    if (!attach()) {
      const observer = new MutationObserver(() => {if(attach())observer.disconnect()});
      observer.observe(document,{childList:true,subtree:true});
    }
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://127.0.0.1:8765/inovtec-page-shell.html?mode=variables&page=VARIABLES-DASHBOARD.html', {waitUntil:'domcontentloaded'});
  await page.locator('#desktopNav a[data-iv-menu-key="variables"]').waitFor({timeout:15000});
  await page.waitForTimeout(1600);
  const state=await page.evaluate(()=>({versions:window.__ivMenuVersions,links:[...document.querySelectorAll('#desktopNav a')].map(a=>({key:a.dataset.ivMenuKey,href:a.getAttribute('href')})),stable:document.getElementById('desktopNav').dataset.ivStableMenu}));
  if(state.links.length!==13||new Set(state.links.map(a=>a.key)).size!==13)throw Error('Le menu ne comporte pas exactement 13 rubriques uniques : '+state.links.length);
  if(state.stable!=='1')throw Error('Le menu initial n’est pas reconnu comme définitif');
  if(state.versions.length!==1)throw Error('Menu reconstruit '+state.versions.length+' fois : '+JSON.stringify(state.versions));
  if(state.versions[0].split('|').length!==13)throw Error('Le premier menu était incomplet');
  if(!state.links.find(a=>a.key==='variables')?.href.includes('mode=variables'))throw Error('Destination Variables incorrecte');
  console.log('OK : menu de gauche complet dès sa première construction, aucune reconstruction, même sans Firebase.');
}finally{await browser.close()}
