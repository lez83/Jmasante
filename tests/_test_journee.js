const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(id,nom)=>({id,nom,prenom:"X",dob:"1950-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3","p4"]},tours:["A"],curTour:"A",
  slotMembers:{"A":{matin:["p1","p2"],soir:["p3","p4"]}},
  patients:[mk("p1","Démo-Martin"),mk("p2","Démo-Dupont"),mk("p3","Démo-Bernard"),mk("p4","Démo-Petit")],
  rappels:[],noVisit:{},trash:[],slotFold:{}};
// p1 vu ce matin
state.patients[0].visits=[{uid:"v1",date:iso,at:"06:29",slot:"matin",soins:["Toilette"],consts:{},note:""}];
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
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s);
  setTimeout(()=>{
    console.log('① Trois boutons de créneau:', [...d.querySelectorAll('[data-slot]')].map(b=>b.dataset.slot).join(' · '));
    const nAvant=d.querySelectorAll('.pcard').length;
    console.log('   Vue matin — patients:', nAvant, '(attendu 2)');
    d.querySelector('[data-slot="jour"]')?.click();
    setTimeout(()=>{
      console.log('\n② VUE JOURNÉE :');
      console.log('   Sections:', d.querySelectorAll('.slotsec').length, '(attendu 2)');
      [...d.querySelectorAll('.slotsec-h')].forEach(h=>
        console.log('      '+h.querySelector('.ss-ic').textContent+' '+h.querySelector('.ss-l').textContent+
          ' → '+h.querySelector('.ss-n').textContent.trim()));
      console.log('   TOUS les patients:', d.querySelectorAll('.pcard').length, '(attendu 4)');
      console.log('   Compteur À voir (toute la journée):', q('.spill .n')?.textContent, '(attendu 3)');
      console.log('   Compteur Vus:', d.querySelectorAll('.spill')[1]?.querySelector('.n')?.textContent, '(attendu 1)');
      // Replier le matin
      d.querySelector('[data-fold="matin"]')?.click();
      setTimeout(()=>{
        console.log('\n③ MATIN REPLIÉ :');
        console.log('   Sections toujours visibles:', d.querySelectorAll('.slotsec').length);
        console.log('   Cartes affichées:', d.querySelectorAll('.pcard').length, '(attendu 2 — soir seul)');
        console.log('   Chevron matin:', d.querySelector('[data-fold="matin"] .ss-c')?.textContent.trim());
        console.log('\nERREURS:', errs.length?errs:'aucune');
      },400);
    },400);
  },900);
}
