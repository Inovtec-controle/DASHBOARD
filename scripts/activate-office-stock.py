"""Activate central-office inventory without replacing legacy catalogue or Firebase schema."""
from pathlib import Path

legacy=Path('MATERIEL-LEGACY.html')
s=legacy.read_text(encoding='utf-8')
css='<link rel="stylesheet" href="inovtec-stock-bureau.css?v=20260919-bureau1">'
js='<script defer src="inovtec-stock-bureau.js?v=20260919-bureau1"></script>'
assert 'inovtec-materiel-redesign.css' in s and 'inovtec-materiel-redesign.js' in s
if css not in s:s=s.replace('</head>',css+'\n</head>',1)
if js not in s:s=s.replace('</body></html>',js+'\n</body></html>',1)
legacy.write_text(s,encoding='utf-8')

outer=Path('MATERIEL.html')
s=outer.read_text(encoding='utf-8')
s=s.replace('Gestion du parc matériel et des fournisseurs.','Stock physique du bureau et des fournisseurs.')
s=s.replace('GESTION DU PARC','STOCK CENTRAL · BUREAU')
s=s.replace('Matériel &amp; <em>fournisseurs</em>','Stock du <em>bureau</em>')
s=s.replace('Suivez précisément votre matériel, son affectation, son fournisseur, son coût, son état et ses échéances de maintenance.','Réceptionnez les achats, suivez le stock disponible et réservé, préparez les besoins des chantiers et retrouvez chaque mouvement.')
s=s.replace('MATERIEL-LEGACY.html?v=20260919-material-v2','MATERIEL-LEGACY.html?v=20260919-office-stock1')
outer.write_text(s,encoding='utf-8')

workflow=Path('inovtec-reassort-workflow.js')
s=workflow.read_text(encoding='utf-8')
old="const at=new Date().toISOString();tx.set(ref,{moduleSyncV1:{reassort:{payload:JSON.stringify({...result.next,updatedAt:at}),updatedAt:at}}},{merge:true})"
new="const at=new Date().toISOString(),updates={moduleSyncV1:{reassort:{payload:JSON.stringify({...result.next,updatedAt:at}),updatedAt:at}}};if(result.material)updates.moduleSyncV1.materiel={...doc.moduleSyncV1?.materiel,payload:JSON.stringify({...result.material,updatedAt:at}),updatedAt:at,updatedAtMs:Date.now()};tx.set(ref,updates,{merge:true})"
assert s.count(old)==1,'Reassort transactional hook changed upstream'
s=s.replace(old,new,1)
start=s.index('async function receivePurchase(id){')
end=s.index('\nfunction renderTours()',start)
replacement='''async function receivePurchase(id){
 const purchase=(state.purchases||[]).find(x=>x.id===id);if(!purchase||['recue','annulee'].includes(purchase.status))return;
 const updates=purchase.lines.map(line=>{const el=document.querySelector(`[data-purchase-qty="${CSS.escape(purchase.id+':'+line.id)}"]`);return {id:line.id,quantity:Number(el?.value||0)}});
 if(updates.some(u=>!Number.isSafeInteger(u.quantity)||u.quantity<0)||!updates.some(u=>u.quantity>0)){message('purchaseMessage','Indiquez au moins une quantité reçue entière valide.',true);return}
 try{await transact((current,doc)=>{
  const purchases=[...(current.purchases||[])],index=purchases.findIndex(p=>p.id===id);if(index<0||['recue','annulee'].includes(purchases[index].status))throw Error('Commande déjà clôturée ou introuvable.');
  const p=purchases[index],byId=new Map(updates.map(u=>[u.id,u.quantity])),inventory=parse(doc?.moduleSyncV1?.materiel?.payload,{items:[]},'items');
  const stock=inventory.items.slice(),moves=[...(inventory.movements||[])],now=new Date().toISOString();
  const lines=p.lines.map(l=>{
   const q=byId.get(l.id)||0;if(q>n(l.quantity)-n(l.received))throw Error('Quantité reçue supérieure au reliquat fournisseur.');
   if(q){const k=stock.findIndex(m=>m.id===l.materialId);if(k<0)throw Error('Article « '+l.name+' » absent du catalogue Matériel. Rattachez la référence avant de réceptionner.');
    const old=stock[k],location=norm(old.site);if(!['bureau','depot','stock central','magasin central','stock bureau'].includes(location))throw Error('Article « '+l.name+' » non localisé au bureau. Vérifiez son affectation dans Matériel avant réception.');
    const before=Number(old.quantity),after=before+q;if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after))throw Error('Quantité inventaire non valide pour « '+l.name+' ».');
    stock[k]={...old,quantity:after,updatedAt:now};moves.push({id:uid('mv'),kind:'reception-fournisseur',materialId:l.materialId,name:old.name||l.name,delta:q,before,after,reason:'Réception fournisseur '+p.supplier,reference:p.reference||p.id,actor:auth?.currentUser?.email||'Utilisateur connecté',at:now});
   }
   return {...l,received:n(l.received)+q};
  });
  const complete=lines.every(l=>n(l.received)>=n(l.quantity));purchases[index]={...p,lines,status:complete?'recue':'partielle',receipts:[...(p.receipts||[]),{id:uid('reception'),date:today(),lines:updates.filter(u=>u.quantity>0)}],updatedAt:now};
  return {next:{...current,purchases},material:{...inventory,items:stock,movements:moves}};
 });message('purchaseMessage','Réception fournisseur confirmée : stock du bureau mis à jour et mouvement historisé.');}
 catch(err){message('purchaseMessage',err.message||'Réception non enregistrée.',true)}
}'''
s=s[:start]+replacement+s[end:]
s=s.replace('La réception fournisseur ne crée jamais de livraison fictive sur chantier.','La réception fournisseur augmente le stock du bureau dans la même transaction, sans créer de livraison fictive sur chantier.')
workflow.write_text(s,encoding='utf-8')

chantier=Path('inovtec-reassort-chantier.js')
s=chantier.read_text(encoding='utf-8')
needle="material={...inventory,items,updatedAt:new Date().toISOString()}"
assert s.count(needle)==1,'Delivery inventory hook changed upstream'
replace="material={...inventory,items,updatedAt:new Date().toISOString()};if(['bureau','depot','dépôt','stock central','magasin central','stock bureau'].includes(String(items[index].site||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim()))material.movements=[...(inventory.movements||[]),{id:makeId('mv'),kind:'livraison-chantier',materialId:o.materialId,name:o.name||items[index].name||'',delta:-quantity,before:qty(inventory.items[index].quantity),after:qty(items[index].quantity),reason:'Livraison '+o.site,reference:reference||dId,site:o.site,actor:deliveredBy,at:new Date().toISOString()}]"
s=s.replace(needle,replace,1)
chantier.write_text(s,encoding='utf-8')
print('OK : page Bureau activée, achats fournisseur atomiques, livraisons bureau journalisées.')
