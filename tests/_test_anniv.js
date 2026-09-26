const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[
      {uid:"v1",date:"2026-09-07",at:"08:15",slot:"matin",soins:["Toilette","Pilulier"],consts:{},note:""},
      {uid:"v2",date:"2026-09-07",at:"18:30",slot:"soir", soins:["Pilulier soir","Coucher"],consts:{},note:""}]}],
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
  w.eval(appjs + '\n;window.__A = { annivJours, annivTexte, ANNIV_AVANT, ANNIV_APRES };');
  setTimeout(()=>{
    const A=w.__A;
    console.log('═══ FENÊTRE D ANNIVERSAIRE ═══');
    const cas = [
      ["1940-09-08","2026-09-08",  0, "le jour même"],
      ["1940-09-09","2026-09-08",  1, "demain"],
      ["1940-09-11","2026-09-08",  3, "dans 3 jours"],
      ["1940-09-12","2026-09-08",null,"dans 4 jours — hors fenêtre"],
      ["1940-09-07","2026-09-08", -1, "hier"],
      ["1940-09-06","2026-09-08",null,"avant-hier — hors fenêtre"],
      ["1940-01-01","2026-12-30",  2, "31 déc → an suivant"],
    ];
    cas.forEach(([dob,ref,att,quoi])=>{
      const v = A.annivJours({dob}, ref);
      console.log(`  ${v===att?'✓':'✗'} ${quoi.padEnd(30)} → ${v} (attendu ${att})`);
    });
    console.log('\n═══ 29 FÉVRIER ═══');
    const b = A.annivJours({dob:"1940-02-29"}, "2026-02-28");
    console.log('  année ordinaire, fêté le 28 :', b===0 ? '✓' : '✗ ' + b);
    const b2 = A.annivJours({dob:"1940-02-29"}, "2028-02-29");
    console.log('  année bissextile, le 29     :', b2===0 ? '✓' : '✗ ' + b2);
    console.log('\n═══ TEXTES ═══');
    ["2026-09-08","2026-09-07","2026-09-09","2026-09-11"].forEach(r =>
      console.log('  ', r, '→', A.annivTexte({dob:"1940-09-08"}, r) || "(rien)"));
    console.log('\n  sans date de naissance :', A.annivJours({}, "2026-09-08")===null ? '✓ rien' : '⚠');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1400);
}
