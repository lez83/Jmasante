const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(i,n,pr,at,c)=>({id:i,nom:n,prenom:pr,dob:"1941-06-30",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
  visits:[{uid:"v"+i,date:iso,at,soins:["Toilette","Pilulier"],consts:c||{},note:""}]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3"]},tours:["A"],curTour:"A",
  patients:[mk("p1","Démo-Martin","Renée","06:29",{ta:"14/8"}),
            mk("p2","Démo-Dupont","Simone","06:45",{ta:"17/10",puls:"112"}),
            mk("p3","Démo-Bernard","Marcel","07:20")],
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
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1000);
    q('[data-a="seq"]')?.click(); await wait(800);
    const t=q('#sheet')?.textContent||'';
    console.log('① Écran de FIN direct (tout vu):', t.includes('Tournée terminée'));
    console.log('② Récapitulatif:', /3 patients vus/.test(t), '| plage horaire:', /06:29.*08|06:29 à 07:20/.test(t));
    console.log('③ Alerte constante:', t.includes('hors seuils')&&t.includes('DÉMO-DUPONT'));
    console.log('④ Passages modifiables:', qa('[data-sqe]').length, '(attendu 3)');
    console.log('⑤ Ligne en alerte marquée:', !!q('.sqe-r.warn'));
    console.log('⑥ Retour Moniteur (pas de relève):', !!q('#sqe-home') && !t.includes('Éditer la relève'));
    // Modifier un passage
    q('[data-sqe]')?.click(); await wait(700);
    console.log('⑦ Tap sur ✏️ ouvre la carte:', !!q('[data-save]'));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
