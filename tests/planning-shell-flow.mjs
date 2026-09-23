import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));

try{
  await page.goto(base+'/PLANNINGS.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#legacyFrame').waitFor({state:'attached',timeout:15000});
  const frame=page.frameLocator('#legacyFrame');
  await frame.locator('#calendarViewport').waitFor({state:'visible',timeout:20000});
  await frame.locator('#periodLabel').waitFor({state:'visible',timeout:20000});

  const ready=await frame.locator('body').evaluate(()=>{
    const period=document.getElementById('periodLabel')?.textContent?.trim();
    const viewport=document.getElementById('calendarViewport');
    return !!(period&&period!=='—'&&viewport?.children.length);
  });
  if(!ready)throw Error('Le calendrier intégré ne termine pas son rendu');

  await page.evaluate(()=>{
    window.InovtecDataHub={
      readyAgents:true,
      readyChantiers:true,
      agents:[{id:'shell-agent',identity:{prenom:'Agent',nom:'Shell'}}],
      chantiers:[{id:'shell-site',nom:'Chantier Shell',adresse:'1 rue Test'}],
      subscribe(){return()=>{}}
    };
    localStorage.setItem('inovtec_plannings_v2',JSON.stringify({
      agents:[{id:'shell-agent',refId:'shell-agent',name:'Agent Shell',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}],
      weeks:{},selected:null
    }));
    const f=document.getElementById('legacyFrame');
    f.contentWindow.location.reload();
  });
  await frame.locator('.agent-row[data-agent-id="shell-agent"]').waitFor({state:'visible',timeout:15000});
  await frame.locator('.agent-row[data-agent-id="shell-agent"]').click();

  const col=frame.locator('.day-column').first();
  const colBox=await col.boundingBox();
  if(!colBox)throw Error('Impossible de mesurer une vraie case du Planning');
  await page.mouse.click(colBox.x+Math.min(70,colBox.width/2),colBox.y+Math.min(250,colBox.height/2),{clickCount:2,delay:80});
  await frame.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await frame.locator('#edTitle').selectOption('shell-site');
  await frame.locator('#edStart').fill('09:00');
  await frame.locator('#edEnd').fill('10:00');
  const beforeDone=await frame.locator('body').evaluate(()=>{
    const pop=document.getElementById('editorPopover');
    return{
      title:document.getElementById('edTitle')?.value,
      titleOptions:[...document.getElementById('edTitle')?.options||[]].map(o=>({value:o.value,text:o.textContent})),
      agent:document.getElementById('edAgent')?.value,
      date:document.getElementById('edDate')?.value,
      start:document.getElementById('edStart')?.value,
      end:document.getElementById('edEnd')?.value,
      draft:pop?.dataset?.draft,
      week:pop?.dataset?.week,
      id:pop?.dataset?.id,
      hubReady:!!parent.InovtecDataHub?.readyChantiers,
      hubSites:(parent.InovtecDataHub?.chantiers||[]).map(x=>({id:x.id,nom:x.nom}))
    };
  });
  const loadedScripts=await frame.locator('body').evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
  console.log('DIAG SCRIPTS '+JSON.stringify(loadedScripts.filter(x=>/planning-calendar|PLANNINGS-LEGACY|planning-editor/i.test(x))));
  const geometry=await frame.locator('body').evaluate(()=>{
    const pop=document.getElementById('editorPopover');
    const done=document.getElementById('edDone');
    const pr=pop?.getBoundingClientRect();
    const dr=done?.getBoundingClientRect();
    let fr=null,pv=null;
    try{
      const f=parent.document.getElementById('legacyFrame');
      fr=f?.getBoundingClientRect()||null;
      pv=parent.visualViewport?{offsetTop:parent.visualViewport.offsetTop,offsetLeft:parent.visualViewport.offsetLeft,width:parent.visualViewport.width,height:parent.visualViewport.height}:null;
    }catch{}
    return{
      inner:{w:innerWidth,h:innerHeight,scrollY},
      pop:pr&&{top:pr.top,bottom:pr.bottom,left:pr.left,right:pr.right,width:pr.width,height:pr.height},
      done:dr&&{top:dr.top,bottom:dr.bottom,left:dr.left,right:dr.right},
      frame:fr&&{top:fr.top,bottom:fr.bottom,left:fr.left,right:fr.right,width:fr.width,height:fr.height},
      parentViewport:pv,
      sameParent:parent===window,
      frameElementExists:!!window.frameElement,
      frameElementRect:window.frameElement?(()=>{const x=window.frameElement.getBoundingClientRect();return{top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height}})():null
    };
  });
  console.log('DIAG GEOMETRIE '+JSON.stringify(geometry));
  console.log('DIAG AVANT TERMINE '+JSON.stringify(beforeDone));
  const dialogs=[];
  page.on('dialog',async d=>{dialogs.push(d.message());if(d.type()==='confirm')await d.accept();else await d.dismiss()});
  await frame.locator('#edDone').click();
  await page.waitForTimeout(500);
  const afterDone=await frame.locator('body').evaluate(()=>{
    const pop=document.getElementById('editorPopover');
    const s=JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}');
    return{
      open:pop?.classList.contains('open'),
      title:document.getElementById('edTitle')?.value,
      events:Object.values(s.weeks||{}).flat()
    };
  });
  console.log('DIAG APRES TERMINE '+JSON.stringify(afterDone)+' DIALOGUES '+JSON.stringify(dialogs));
  await frame.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});

  const saved=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}');
    return Object.values(s.weeks||{}).flat().some(e=>e.agentId==='shell-agent'&&e.chantierId==='shell-site');
  });
  if(!saved)throw Error('Terminé n’enregistre pas dans le Planning intégré');

  await frame.locator('.event-card').first().dblclick({timeout:10000});
  await frame.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await frame.locator('#edDelete').click();
  await frame.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});

  await page.waitForTimeout(21000);

  const fallback=await page.getByText('Le planning ne parvient pas à s’ouvrir dans le tableau de bord.').count();
  if(fallback)throw Error('Le faux écran de secours recouvre encore le Planning');

  const hidden=await page.locator('#loading').evaluate(el=>el.classList.contains('hidden')||el.getAttribute('aria-hidden')==='true');
  if(!hidden)throw Error('Le masque de chargement reste affiché sur le Planning');

  const relevantErrors=errors.filter(message=>!/No Firebase App '\[DEFAULT\]' has been created/i.test(message));
  if(relevantErrors.length)throw Error('Erreur JavaScript : '+relevantErrors.join('; '));
  console.log('OK : Planning intégré chargé et aucun fallback ne revient après 20 secondes');
}catch(error){
  console.error('::error::Planning shell : '+error.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
