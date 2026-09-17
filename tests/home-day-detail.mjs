import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});
 page.on('pageerror',error=>console.error('ERREUR PAGE',String(error)));
 await page.addInitScript(()=>{
  const now=new Date(),day=(now.getDay()+6)%7,x=new Date(now.getFullYear(),now.getMonth(),now.getDate());x.setDate(x.getDate()+3-day);
  const y=new Date(x.getFullYear(),0,4),yd=(y.getDay()+6)%7,w=1+Math.round(((x-y)/86400000-3+yd)/7),week=x.getFullYear()+'-W'+String(w).padStart(2,'0');
  const rows=[
   {id:'jour-a',agentId:'agent-a',day,start:'06:00',end:'08:00',task:'Chantier A',site:'Nettoyage des sols',note:'Accès côté cour'},
   {id:'jour-b',agentId:'agent-b',day,start:'08:30',end:'10:00',task:'Chantier B',site:'Nettoyage des vitres',note:''},
   {id:'jour-c',agentId:'agent-b',day,start:'10:30',end:'12:00',task:'Chantier C',site:'Désinfection',note:''},
   {id:'hors-jour',agentId:'agent-a',day:(day+1)%7,start:'09:00',end:'10:00',task:'Demain',site:'Ne doit pas apparaître'}
  ];
  localStorage.setItem('inovtec_plannings_v2',JSON.stringify({agents:[{id:'agent-a',name:'Camille Test'},{id:'agent-b',name:'Alex Test'}],weeks:{[week]:rows},selected:null}));
 });
 await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#ivHomeDayTrigger').waitFor({state:'visible',timeout:18000});
 const style=await page.evaluate(()=>({sidebar:getComputedStyle(document.querySelector('.c3-sidebar')).backgroundImage,logo:getComputedStyle(document.querySelector('.c3-logo')).borderTopColor}));
 if(!style.sidebar.includes('rgb(6, 78, 59)')||!style.sidebar.includes('rgb(4, 63, 50)'))throw Error('Le vert du menu Accueil diffère des autres pages : '+style.sidebar);
 if(style.logo!=='rgb(52, 211, 153)')throw Error('Le logo du menu Accueil diffère des autres pages : '+style.logo);
 const before=await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2'));
 const navBefore=await page.locator('.c3-nav a').evaluateAll(links=>links.map(x=>x.getAttribute('href')));
 // La CI n'est pas authentifiée : son écran de connexion doit rester bloquant.
 // Tester les gestionnaires avec des données fictives sans simuler une connexion.
 await page.locator('#ivHomeDayTrigger').evaluate(link=>link.click());
 await page.locator('#ivHomeDayOverlay:not([hidden])').waitFor({state:'visible',timeout:10000});
 await page.locator('.iv-home-day-table tbody tr').first().waitFor({state:'visible',timeout:10000});
 if(await page.locator('.iv-home-day-table tbody tr').count()!==3)throw Error('La fenêtre doit afficher les trois interventions du jour, tous agents confondus');
 const text=await page.locator('#ivHomeDayBody').innerText();
 for(const value of ['Camille Test','Alex Test','Chantier A','Chantier B','Chantier C','Nettoyage des sols','Nettoyage des vitres','Désinfection','Accès côté cour'])if(!text.includes(value))throw Error('Information manquante : '+value);
 if(text.includes('Ne doit pas apparaître'))throw Error('Une intervention d’un autre jour est visible');
 await page.locator('#ivHomeDaySearch').evaluate(input=>{input.value='vitres';input.dispatchEvent(new Event('input',{bubbles:true}))});
 if(await page.locator('.iv-home-day-table tbody tr').count()!==1)throw Error('Le filtre ne retrouve pas l’intervention recherchée');
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 if(!await page.locator('#ivHomeDayOverlay').isHidden())throw Error('La fenêtre ne se ferme pas avec Échap');
 const after=await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2'));
 if(before!==after)throw Error('L’ouverture de la fenêtre a modifié les plannings');
 const navAfter=await page.locator('.c3-nav a').evaluateAll(links=>links.map(x=>x.getAttribute('href')));
 if(JSON.stringify(navBefore)!==JSON.stringify(navAfter))throw Error('Le menu de navigation a été modifié');
 console.log('OK : logo et vert identiques aux autres pages ; fenêtre exhaustive, recherche, fermeture et plannings préservés.');
}finally{await browser.close()}
