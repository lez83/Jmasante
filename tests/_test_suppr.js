const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[{nom:"Pansement jambe gauche",cat:""},{nom:"Soin jamais utilisé",cat:""}],
           disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Martin",prenom:"Renée",dob:"1938-04-12",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette","Pansement jambe gauche"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    planSlots:{"Pansement jambe gauche":{matin:true}},
    planRythme:{"Pansement jambe gauche":"lundi"},
    visits:[{uid:"v1",date:iso,at:"08:00",soins:["Toilette","Pansement jambe gauche"],consts:{},note:""}]}],
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
  w.eval(appjs + '\n;window.__C = { etat:()=>S, usagesSoin, retirerSoinCatalogue, getCatalog };');
  setTimeout(()=>{
    const C=w.__C, S=C.etat();
    console.log('═══ COMPTAGE DES USAGES ═══');
    const u1=C.usagesSoin("Pansement jambe gauche");
    console.log('  soin utilisé   :', u1, u1.total===2 ? '✓' : '⚠');
    const u2=C.usagesSoin("Soin jamais utilisé");
    console.log('  soin non utilisé:', u2, u2.total===0 ? '✓' : '⚠');

    console.log('\n═══ RETRAIT D UN SOIN UTILISÉ ═══');
    const avant = { visite: S.patients[0].visits[0].soins.slice(),
                    plan: S.patients[0].plan.slice(),
                    cat: C.getCatalog().includes("Pansement jambe gauche") };
    C.retirerSoinCatalogue("Pansement jambe gauche");
    const apres = { visite: S.patients[0].visits[0].soins.slice(),
                    plan: S.patients[0].plan.slice(),
                    cat: C.getCatalog().includes("Pansement jambe gauche"),
                    slots: S.patients[0].planSlots["Pansement jambe gauche"],
                    rythme: S.patients[0].planRythme["Pansement jambe gauche"] };
    console.log('  ① retiré du catalogue     :', avant.cat && !apres.cat ? '✓' : '⚠');
    console.log('  ② HISTORIQUE INTACT       :',
      JSON.stringify(apres.visite)===JSON.stringify(avant.visite) ? '✓ ' + JSON.stringify(apres.visite) : '✗ ' + JSON.stringify(apres.visite));
    console.log('  ③ retiré du plan de soins :', !apres.plan.includes("Pansement jambe gauche") ? '✓' : '⚠', JSON.stringify(apres.plan));
    console.log('  ④ créneau et rythme purgés:', (!apres.slots && !apres.rythme) ? '✓' : '⚠');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1300);
}
