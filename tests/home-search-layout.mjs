import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const width of [1365,390]){
    const page=await browser.newPage({viewport:{width,height:850},serviceWorkers:'block'});
    await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>{
      const banner=document.querySelector('.c3-hero-banner');
      const row=document.querySelector('.c3-home-search-row');
      const topbar=document.querySelector('.c3-topbar');
      return banner?.nextElementSibling===row && !!row.querySelector('#globalSearch') && getComputedStyle(topbar).display==='none';
    },null,{timeout:15000});
    const result=await page.evaluate(()=>{
      const banner=document.querySelector('.c3-hero-banner');
      const row=document.querySelector('.c3-home-search-row');
      const input=document.querySelector('#globalSearch');
      return {
        searchCount:document.querySelectorAll('#globalSearch').length,
        searchResultsInRow:row.contains(document.querySelector('#globalSearchResults')),
        correctOrder:banner.nextElementSibling===row,
        belowBanner:row.getBoundingClientRect().top>=banner.getBoundingClientRect().bottom-1,
        visible:getComputedStyle(input).display!=='none' && input.getBoundingClientRect().width>100,
        technicalNodesKept:['weatherIcon','cloudDot','accountName','timeLabel'].every(id=>!!document.getElementById(id)),
        topbarHidden:getComputedStyle(document.querySelector('.c3-topbar')).display==='none'
      };
    });
    for(const [name,pass] of Object.entries(result))if(pass!==true && !(name==='searchCount' && pass===1))throw Error(`${width}px : ${name} = ${pass}`);
    await page.locator('#globalSearch').fill('chantier');
    if(await page.locator('#globalSearch').inputValue()!=='chantier')throw Error(`${width}px : champ de recherche inutilisable`);
    await page.close();
    console.log(`OK : accueil ${width}px, recherche sous le bandeau, barre supérieure masquée et données techniques conservées.`);
  }
}finally{await browser.close()}
