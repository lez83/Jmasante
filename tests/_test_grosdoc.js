// « Maximum call stack size exceeded » : String.fromCharCode(...tab)
// passait chaque octet en argument. Sur 2 Mo, la pile explosait.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
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
  w.eval(appjs + '\n;window.__G = { idbGet, idbSet, save, flushSave, etat:()=>S };');
  setTimeout(async ()=>{
    const G=w.__G;
    console.log('═══ DOCUMENTS DE TAILLES CROISSANTES ═══');
    for (const mo of [0.1, 1, 2, 5]){
      const doc = 'data:image/jpeg;base64,' + 'A'.repeat(Math.round(mo*1024*1024));
      const t0 = Date.now();
      try {
        await G.idbSet("doc_t"+mo, doc);
        const relu = await G.idbGet("doc_t"+mo);
        const ok = relu === doc;
        console.log(`  ${ok?'✓':'✗'} ${String(mo).padStart(4)} Mo — ${ok?'chiffré et relu':'ALTÉRÉ'} (${Date.now()-t0} ms)`);
      } catch(e){
        console.log(`  ✗ ${String(mo).padStart(4)} Mo — ${e.message}`);
      }
    }
    console.log('\n═══ UN DOSSIER CHARGÉ, COMME EN VRAI ═══');
    // 20 patients, 142 passages
    const S = G.etat();
    S.patients = Array.from({length:20}, (_,i)=>({
      id:"p"+i, nom:"Démo-"+i, prenom:"P", dob:"1940-01-01", genre:"F", address:"",
      contacts:{}, tours:["A"], plan:["Toilette"], archived:null, bilans:[], docs:[],
      tags:[], infos:[],
      visits: Array.from({length:7}, (_,j)=>({uid:`v${i}-${j}`, date:iso, at:"08:00",
        soins:["Toilette","Pilulier"], consts:{ta:"14/8"}, note:"RAS "+j}))
    }));
    const t1 = Date.now();
    try {
      await G.idbSet("state", JSON.parse(JSON.stringify(S)));
      const relu = await G.idbGet("state");
      const n = relu.patients.reduce((a,p)=>a+p.visits.length,0);
      console.log(`  ✓ 20 patients, ${n} passages — sauvegardé et relu (${Date.now()-t1} ms)`);
    } catch(e){
      console.log('  ✗ ÉCHEC :', e.message);
    }
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1500);
}
