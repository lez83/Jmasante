const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Test",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
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
  w.eval(appjs + '\n;window.__X = { S:()=>S, save, flushSave, logIncident, idbGet };');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const lire = () => new Promise(res=>{
    const q=w.indexedDB.open("transm_d2",1);
    q.onsuccess=()=>{const db=q.result;const t=db.transaction("kv","readonly");
      const g=t.objectStore("kv").get("state");
      g.onsuccess=()=>{db.close();res(g.result||null);};
      g.onerror=()=>{db.close();res(null);};};
    q.onerror=()=>res(null);
  });
  const nomEnBase = async () => {
    try { const d = await w.__X.idbGet("state");
      return (d && d.patients && d.patients[0]) ? d.patients[0].nom : "(vide)"; }
    catch(e){ return "(erreur: "+e.message+")"; } };
  (async()=>{
    await wait(1200);
    const X=w.__X, St=X.S();
    console.log('═══ ① ÉCRITURE FORCÉE EN ARRIÈRE-PLAN ═══');
    St.patients[0].nom = "ModifiéA";
    X.save();                                    // différée 300ms
    await wait(50);                              // on n'attend PAS
    console.log('  avant flush — en base:', await nomEnBase(), '(doit être "Test")');
    // Simuler le passage en arrière-plan
    Object.defineProperty(w.document,'visibilityState',{value:'hidden',configurable:true});
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await wait(400);
    let n1 = await nomEnBase();
    console.log('  après passage en arrière-plan:', n1, n1==="ModifiéA" ? '✓ SAUVÉ' : '✗ PERDU');

    console.log('\n═══ ② ÉCRITURE IMMÉDIATE ═══');
    St.patients[0].nom = "ModifiéB";
    await X.save(true);
    await wait(80);
    let n2 = await nomEnBase();
    console.log('  save(true) sans attendre:', n2, n2==="ModifiéB" ? '✓ SAUVÉ' : '✗ PERDU');

    console.log('\n═══ ③ JOURNAL DES INCIDENTS ═══');
    X.logIncident("test", "Incident de vérification", new Error("détail"));
    await wait(200);
    const inc = X.S().incidents || [];
    console.log('  entrée créée:', inc.length>0);
    if (inc.length) console.log('  contenu:', inc[0].src, '|', inc[0].msg, '|', inc[0].det);
    // Borne à 50
    for (let i=0;i<60;i++) X.logIncident("x","msg "+i);
    console.log('  borné à 50:', (X.S().incidents||[]).length === 50);
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
