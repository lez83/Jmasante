const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const j = n => new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const iso=j(0);
const vis = (arr) => arr.map(([d,s],i)=>({uid:"v"+i,date:j(d),at:"08:00",soins:["Toilette"],
  consts: s===null?{}:{selles:s}, note:""}));
const mk=(id,nom,v,seuil)=>({id,nom,prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
  seuilSelles:seuil||"", visits:v});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3","p4","p5"]},tours:["A"],curTour:"A",
  patients:[
    // 4 jours consécutifs à 0 → alerte (seuil 3 par défaut)
    mk("p1","Quatre-zeros", vis([[3,"0"],[2,"0"],[1,"0"],[0,"0"]])),
    // 3 jours à 0 mais un TROU au milieu → compteur remis à zéro
    mk("p2","Avec-trou",    vis([[4,"0"],[3,null],[1,"0"],[0,"0"]])),
    // selles présentes → aucune alerte
    mk("p3","Normal",       vis([[2,"0"],[1,"2"],[0,"0"]])),
    // seuil personnalisé à 5 : 4 jours ne suffisent pas
    mk("p4","Seuil-5",      vis([[3,"0"],[2,"0"],[1,"0"],[0,"0"]]), "5"),
    // rien renseigné → silence
    mk("p5","Rien",         vis([[1,null],[0,null]]))],
  rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs + '\n;window.__S = { etat:()=>S, joursSansSelle, alerteSelles, seuilSelles, sellesTxt, constParts };');
  setTimeout(()=>{
    const X=w.__S, S=X.etat();
    const p = n => S.patients.find(x=>x.nom===n);
    console.log('═══ COMPTAGE DES JOURS SANS SELLE ═══');
    const cas = [
      ['Quatre-zeros', 4, 'quatre jours consécutifs à 0'],
      ['Avec-trou',    2, 'un jour non renseigné remet le compteur à 0'],
      ['Normal',       1, 'selles présentes hier'],
      ['Rien',         0, 'aucun relevé']];
    cas.forEach(([n,att,quoi])=>{
      const v = X.joursSansSelle(p(n));
      console.log(`  ${v===att?'✓':'✗'} ${n.padEnd(14)} ${v} (attendu ${att}) — ${quoi}`);
    });
    console.log('\n═══ ALERTE ═══');
    console.log('  seuil par défaut (3) :', X.alerteSelles(p('Quatre-zeros')), '→', X.alerteSelles(p('Quatre-zeros'))?'✓ alerte':'✗');
    console.log('  avec un trou         :', X.alerteSelles(p('Avec-trou')), '→', X.alerteSelles(p('Avec-trou'))===0?'✓ silence':'✗ FAUSSE ALERTE');
    console.log('  seuil réglé à 5      :', X.alerteSelles(p('Seuil-5')), '→', X.alerteSelles(p('Seuil-5'))===0?'✓ silence (4<5)':'✗');
    console.log('\n═══ AFFICHAGE ═══');
    console.log('  "0" est une valeur :', X.constParts({selles:"0"}));
    console.log('  diarrhée           :', X.constParts({selles:"diarrhee"}));
    console.log('  non renseigné      :', X.constParts({}), '(doit être vide)');
    console.log('  avec température   :', X.constParts({temp:"37.2", selles:"2"}));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1400);
}
