// Les documents — ordonnances, photos de plaies — étaient stockés en clair.
// Un téléphone perdu les livrait à qui savait fouiller le stockage.
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
const ANCIEN = "data:application/pdf;base64,ORDONNANCE-EN-CLAIR-AVANT-MAJ";
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  const o=tx.objectStore("kv"); o.put(state,"state");
  o.put(ANCIEN,"doc_ancien");            // document d'avant le chiffrement
  tx.oncomplete=()=>{db.close();run();}};
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
  w.eval(appjs + '\n;window.__C = { idbGet, idbSet, idbDel };');
  setTimeout(async ()=>{
    const C=w.__C;
    const SECRET = "data:image/jpeg;base64,PHOTO-DE-PLAIE-SENSIBLE";
    console.log('═══ UN NOUVEAU DOCUMENT ═══');
    await C.idbSet("doc_neuf", SECRET);
    // Lire le stockage BRUT, sans passer par idbGet
    const brut = await new Promise(res=>{
      const q=w.indexedDB.open("transm_d2",1);
      q.onsuccess=()=>{const db=q.result;
        const r=db.transaction("kv","readonly").objectStore("kv").get("doc_neuf");
        r.onsuccess=()=>{db.close();res(r.result);};};});
    const txt = JSON.stringify(brut);
    console.log('  lisible en base ?', txt.includes("PHOTO-DE-PLAIE") ? '⚠ EN CLAIR' : '✓ chiffré');
    console.log('  marqueur _enc    :', brut && brut._enc ? '✓' : '⚠');
    const relu = await C.idbGet("doc_neuf");
    console.log('  relu par l\'app   :', relu === SECRET ? '✓ identique' : '⚠ ALTÉRÉ');

    console.log('\n═══ UN DOCUMENT D AVANT LA MAJ ═══');
    const vieux = await C.idbGet("doc_ancien");
    console.log('  toujours lisible :', vieux === ANCIEN ? '✓ pas de perte' : '⚠ PERDU');

    console.log('\n═══ RECHIFFRÉ À LA RÉÉCRITURE ═══');
    await C.idbSet("doc_ancien", ANCIEN);
    const brut2 = await new Promise(res=>{
      const q=w.indexedDB.open("transm_d2",1);
      q.onsuccess=()=>{const db=q.result;
        const r=db.transaction("kv","readonly").objectStore("kv").get("doc_ancien");
        r.onsuccess=()=>{db.close();res(r.result);};};});
    console.log('  désormais chiffré:', brut2 && brut2._enc ? '✓' : '⚠');

    console.log('\n═══ LE DOSSIER PATIENT ═══');
    // Déclencher une VRAIE sauvegarde : le test l'avait posé en clair
    await C.idbSet("state", { test:"DONNEE-PATIENT-SENSIBLE" });
    const st = await new Promise(res=>{
      const q=w.indexedDB.open("transm_d2",1);
      q.onsuccess=()=>{const db=q.result;
        const r=db.transaction("kv","readonly").objectStore("kv").get("state");
        r.onsuccess=()=>{db.close();res(r.result);};};});
    const txtSt = JSON.stringify(st);
    console.log('  chiffré           :', st && st._enc ? '✓' : '⚠');
    console.log('  illisible en base :', txtSt.includes("DONNEE-PATIENT") ? '⚠ EN CLAIR' : '✓');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1500);
}
