const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[{uid:"v1",date:iso,at:"08:00",soins:["Toilette"],consts:{},note:""}]}],
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
  const d=w.document,q=s=>d.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ouvre = async (nom, fn, ms=700) => {
    fn(); await wait(ms);
    const nav = !!q('#sheet .navbar');
    const back = !!q('#nav-back');
    console.log(`  ${nav&&back?'✓':'✗'} ${nom}`);
    q('#veil')?.classList.remove('on'); await wait(250);
    return nav&&back;
  };
  (async()=>{
    await wait(1000);
    console.log('═══ BARRE DE NAVIGATION SUR CHAQUE ÉCRAN ═══');
    let ok=0, tot=0;
    const t = async (n,f,ms) => { tot++; if(await ouvre(n,f,ms)) ok++; };
    await t('Menu réglages', ()=>q('[data-a="tours"]')?.click());
    await t('Recherche', ()=>q('[data-a="search"]')?.click());
    await t('Rappels (nouveau)', ()=>q('[data-a="new-rappel"]')?.click());
    await t('Relève', ()=>q('[data-a="releve"]')?.click());
    // Écrans patient
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    await t('Documents', ()=>q('[data-docs]')?.click());
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(400);
    await t('Bilans', ()=>q('[data-bilans]')?.click());
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(400);
    await t('Historique', ()=>q('[data-hist]')?.click());
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(400);
    await t('Courbes', ()=>q('[data-graph]')?.click());
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(400);
    await t('Fiche patient', ()=>q('[data-edit]')?.click(), 900);
    console.log(`\n>>> ${ok}/${tot} écrans avec barre de navigation`);
    console.log('ERREURS:', errs.length?errs:'aucune');
  })();
}
