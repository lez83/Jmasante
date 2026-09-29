// Fusion d'une sauvegarde : ordre conservé, choix des dossiers,
// et transmission facultative de l'ordre par la synchro.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const pat=(i,n,v=0)=>({id:"p"+i,nom:"Démo-"+n,prenom:"X",dob:"1940-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],tags:[],infos:[],docs:[],plaies:[],
  visits:Array.from({length:v},(_,k)=>({uid:`v${i}${k}`,date:iso,at:"08:0"+k,soins:["Toilette"],consts:{},note:"",soinNotes:{}}))});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  tours:["A"],curTour:"A",patientOrder:{A:["p1","p2","p3"]},
  slotOrder:{A:{matin:["p1","p2"]}}, slotMembers:{A:{matin:["p1","p2"]}},
  patients:[pat(1,"Un"),pat(2,"Deux"),pat(3,"Trois")],
  changeLog:[],changeSeq:0,confirmedSeq:0,rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>','').replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs+';window.__T={ordreFusionne,fusionnerOrdres,buildSyncFile,getP,S:()=>S};');
  setTimeout(()=>{
    const T=w.__T; let ko=[];
    const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
    console.log('═══ ORDRE À LA FUSION ═══');
    // Le fichier place p9 entre p1 et p2, p8 après p3
    ck('nouveau inséré à son rang, pas à la fin',
       T.ordreFusionne(["p1","p2","p3"], ["p1","p9","p2","p3","p8"]).join(",") === "p1,p9,p2,p3,p8");
    ck('ordre local préservé même si le fichier diffère',
       T.ordreFusionne(["p3","p1","p2"], ["p1","p2","p3"]).join(",") === "p3,p1,p2");
    ck('ordre local vide → celui du fichier',
       T.ordreFusionne([], ["p2","p1"]).join(",") === "p2,p1");
    ck('dossiers non cochés écartés de l\'ordre',
       T.ordreFusionne(["p1"], ["p1","p9","p8"], new Set(["p9"])).join(",") === "p1,p9");
    T.fusionnerOrdres({ patientOrder:{A:["p1","p9","p2","p3"]},
      slotOrder:{A:{matin:["p1","p9","p2"]}}, slotMembers:{A:{matin:["p9"]}} }, null);
    const S = T.S();
    ck('tournée mise à jour', S.patientOrder.A.join(",") === "p1,p9,p2,p3");
    ck('ordre par créneau aussi', S.slotOrder.A.matin.join(",") === "p1,p9,p2");
    ck('appartenance au créneau complétée', S.slotMembers.A.matin.join(",") === "p1,p2,p9");

    console.log('\n═══ SYNCHRO ═══');
    const sans = JSON.parse(T.buildSyncFile("A", [], false));
    const avec = JSON.parse(T.buildSyncFile("A", [], true));
    ck('ordre non transmis par défaut', !("ordre" in sans));
    ck('ordre transmis si la case est cochée', !!avec.ordre && Array.isArray(avec.ordre.patientOrder));
    ck('l\'ordre transmis est celui de CETTE tournée', avec.ordre.patientOrder.join(",") === S.patientOrder.A.join(","));
    const src = fs.readFileSync('../jmsante/www/js/sync.js','utf-8');
    ck('le destinataire est consulté avant de le reprendre', /Reprendre l'ordre de passage \?/.test(src));
    const st = fs.readFileSync('../jmsante/www/js/storage.js','utf-8');
    ck('écran de choix avant la fusion', /sheetFusionChoix\(incoming, fusionner\)/.test(st));
    console.log('\nERREURS:', ko.length||errs.length ? ko.concat(errs).join(' · ') : 'aucune');
    process.exit(ko.length?1:0);
  },1500);
}
