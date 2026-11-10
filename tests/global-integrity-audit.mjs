import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { URL } from "node:url";

const root=process.cwd();
const files=fs.readdirSync(root,{withFileTypes:true});
const pages=files.filter(f=>f.isFile()&&f.name.endsWith(".html")).map(f=>f.name);
const scripts=files.filter(f=>f.isFile()&&f.name.endsWith(".js")).map(f=>f.name);
const errors=[],warnings=[];
let references=0,links=0;
function localResource(from,url){
  if(!url||/^(?:https?:|\/\/|mailto:|tel:|data:|javascript:|blob:|#)/i.test(url))return;
  if(url.includes("${")||url.includes("{{"))return;
  try{
    const parsed=new URL(url,"https://inovtec.local/"+from);
    if(parsed.origin!=="https://inovtec.local")return;
    const target=decodeURIComponent(parsed.pathname).replace(/^\//,"");
    if(!target)return;
    references++;
    if(!fs.existsSync(path.join(root,target)))errors.push(from+" : ressource absente "+url);
    if(parsed.searchParams.has("page")){
      const embedded=new URL(parsed.searchParams.get("page"),"https://inovtec.local/"+from);
      if(embedded.origin==="https://inovtec.local"&&!fs.existsSync(path.join(root,embedded.pathname.replace(/^\//,""))))
        errors.push(from+" : page intégrée absente "+parsed.searchParams.get("page"));
    }
  }catch(e){warnings.push(from+" : URL non analysable "+url);}
}
for(const page of pages){
  const html=fs.readFileSync(page,"utf8");
  if(!/<html\b/i.test(html)||!/<body\b/i.test(html))errors.push(page+" : HTML incomplet");
  for(const m of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"'<>]+)["']/gi)){
    localResource(page,m[1]);if(/\.html(?:[?#]|$)/i.test(m[1]))links++;
  }
  for(const m of html.matchAll(/<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]+content\s*=\s*["']([^"']+)["']/gi)){
    const redirect=m[1].match(/\burl\s*=\s*(.+)$/i);if(redirect)localResource(page,redirect[1].replaceAll("&amp;","&"));
  }
}
// Contrat de navigation : chaque module doit être accessible via l'accueil.
const home=fs.readFileSync("index.html","utf8");
for(const file of ["PLANNINGS.html","KONTROL-CLOUD.html","INFOCHANTIERS-V2.html","AGENTS.html","MATERIEL.html","REASSORT.html","CONGES.html","VARIABLES.html","ORGANISATION-V17.html","TEMPS.html","SALAIRE.html","ESSENCE.html"]){
  if(!home.includes(file))errors.push("Navigation accueil absente : "+file);
}
const organisation=fs.readFileSync("ORGANISATION-V17.html","utf8");
const old=fs.readFileSync("ORGA-LEGACY.html","utf8");
const concept=fs.readFileSync("dashboard-concept3.js","utf8");
const search=fs.readFileSync("dashboard-global-search.js","utf8");
const markers=[
  ["Organisation : source unique",organisation.includes('const ORGANISATION_DOC_ID = "inovtec_organisation_tasks_v2"')],
  ["Organisation : relecture serveur",organisation.includes('get({source:"server"})')],
  ["Organisation : ancienne source personnelle",organisation.includes('db.collection("kanban").doc(owner)')],
  ["Organisation : ancienne source partagée",organisation.includes('"__inovtec_shared_workspace_v1__"')],
  ["Organisation : récupération des données",organisation.includes("restoreLegacyTasks")],
  ["Organisation : sauvegarde provisoire",organisation.includes("persistPending(owner,payload)")],
  ["Ancienne route Organisation redirigée",old.includes('location.replace("ORGANISATION-V17.html')],
  ["Accueil : lecture canonique des tâches",concept.includes("db.collection(\"chantiers\").doc(ORGANISATION_ID).get()")],
  ["Recherche : lecture canonique",search.includes("db.collection(\"chantiers\").doc(organisationId).get()")]
];
for(const [label,pass] of markers)if(!pass)errors.push(label);
console.log("AUDIT GLOBAL : "+pages.length+" pages HTML, "+scripts.length+" scripts JavaScript, "+references+" références internes, "+links+" liens de pages");
for(const [label,pass] of markers)console.log((pass?"OK":"ERREUR")+" : "+label);
for(const w of warnings.slice(0,25))console.log("AVERTISSEMENT : "+w);
for(const e of errors)console.log("::error::"+e);
assert.equal(errors.length,0,errors.length+" anomalie(s) relevée(s)");
