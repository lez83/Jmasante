// v1.0.66 — Retour haptique à la validation d'un passage.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":[]},tours:["A"],curTour:"A",patients:[],rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
     .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window; w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x'; let errs=[]; w.addEventListener('error',e=>errs.push(e.message));
  const appels=[];
  w.Capacitor={ isNativePlatform:()=>false, Plugins:{ Haptics:{ notification:o=>{appels.push(o);return Promise.resolve();}, impact:o=>{appels.push(o);return Promise.resolve();} } } };
  w.eval(appjs+'\n;window.__B={getS:()=>S, vibrer, sheetPersoZone};');
  const d=w.document, B=w.__B;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  (async()=>{
    await wait(1400); const S=B.getS();
    console.log('═══ RETOUR HAPTIQUE ═══');
    B.vibrer('succes'); await wait(20);
    ok(appels.length===1 && appels[0].type==='SUCCESS','vibration « succès » par le module natif');
    ok(/if \(!await commitVisit\(false\)\) return;\s*try \{ vibrer\("succes"\)/.test(appjs),'branchée sur la validation depuis la carte');
    ok(/if \(saved\)\{ save\(true\); try \{ vibrer\("succes"\)/.test(appjs),'branchée sur la validation du déroulé');
    B.sheetPersoZone('moniteur'); await wait(100);
    const h=d.querySelector('#pz-hap'); ok(!!h && h.checked && !h.disabled,'réglage présent, actif par défaut');
    h.checked=false; h.dispatchEvent(new w.Event('change')); await wait(50);
    const n=appels.length; B.vibrer('succes'); await wait(20);
    ok(S.haptique===false && appels.length===n,'désactivé : plus aucune vibration');
    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
    process.exit(0);
  })();
}
