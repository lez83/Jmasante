// Un passage validé dans le DÉROULÉ survit-il à une fermeture immédiate ?
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(i,n)=>({id:i,nom:n,prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2"]},tours:["A"],curTour:"A",
  patients:[mk("p1","Alpha"), mk("p2","Beta")],
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
  w.eval(appjs + '\n;window.__Q = { etat:()=>S, idbGet };');
  const d=w.document,q=s=>d.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1200);
    console.log('═══ VALIDATION DANS LE DÉROULÉ ═══');
    q('[data-a="seq"]')?.click(); await wait(700);
    console.log('  déroulé lancé :', !!q('.sq-ctr'), '|', (q('.sq-ctr')?.textContent||'').slice(0,22));
    // Cocher un soin puis valider
    const soin = q('#sheet .chip.star') || q('.chip.star');
    if (soin) soin.click(); await wait(250);
    /* ⚠️ ON VALIDE PAR LE BOUTON DU BAS, pas par →. Depuis la v1.15.1 les
       flèches ne font que NAVIGUER : ce contrôle passait par → et
       vérifiait donc l'enregistrement immédiat d'un passage qui n'était
       plus créé — vert sur du vide. Le bouton « ✓ Valider le passage »
       est désormais le seul chemin, c'est lui qu'il faut éprouver. */
    q('#seq-mode [data-save]')?.click();
    // On NE laisse PAS passer les 300 ms : simulation d'une fermeture immédiate
    await wait(70);
    const base = await w.__Q.idbGet("state").catch(()=>null);
    const nv = base && base.patients ? base.patients.reduce((a,p)=>a+(p.visits||[]).length,0) : -1;
    console.log('  passages en base après 70 ms :', nv,
      nv >= 1 ? '✓ SAUVÉ IMMÉDIATEMENT' : '✗ encore en attente');
    /* ⚠️ L'ÉCHEC DOIT COMPTER. Il n'était qu'affiché : la suite restait
       « ERREURS: aucune » alors que rien n'avait été enregistré. */
    if (nv < 1) errs.push("le passage n'est pas en base 70 ms après la validation");
    await wait(600);
    const b2 = await w.__Q.idbGet("state").catch(()=>null);
    const nv2 = b2 && b2.patients ? b2.patients.reduce((a,p)=>a+(p.visits||[]).length,0) : -1;
    console.log('  passages en base après 700 ms :', nv2);
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
