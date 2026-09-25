// Déroulé : ← / → / Quitter ne doivent JAMAIS être bloqués par un formulaire vide
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(i,n)=>({id:i,nom:n,prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3"]},tours:["A"],curTour:"A",
  patients:[mk("p1","Alpha"), mk("p2","Beta"), mk("p3","Gamma")],
  rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace(/<script src="js\/app\.js[^"]*"><\/script>/,'')
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;w.scrollBy=()=>{};
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs + '\n;window.__Q = { etat:()=>S };');
  const d=w.document,q=s=>d.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const nom=()=>(q('.sq-nom')?.textContent||'').trim();
  let ko=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c) ko++;};
  (async()=>{
    await wait(1200);
    console.log('═══ NAVIGATION DU DÉROULÉ ═══');
    q('[data-a="seq"]')?.click(); await wait(600);
    ok('barre visible : '+nom()+' / '+(q('.sq-pos')?.textContent||''), /ALPHA/.test(nom()));
    ok('progression : 3 segments dont 1 courant', q('.sq-prog')?.children.length===3 && !!q('.sq-prog i.cur'));
    q('#sq-prev').click(); await wait(300);
    ok('← au 1er patient : reste sur Alpha', /ALPHA/.test(nom()));
    q('#sq-next').click(); await wait(400);
    ok('→ formulaire vide : passe à Beta', /BETA/.test(nom()));
    q('#sq-prev').click(); await wait(400);
    ok('← formulaire vide : revient à Alpha (le bug)', /ALPHA/.test(nom()));
    const S=w.__Q.etat();
    ok('aucun passage créé par la navigation', S.patients.every(p=>!p.visits.length));
    const soin=q('#seq-mode .chip[data-s]'); if(soin) soin.click(); await wait(200);
    q('#sq-next').click(); await wait(500);
    ok('→ avec saisie : Alpha enregistré et passe à Beta',
       S.patients[0].visits.length===1 && /BETA/.test(nom()));
    ok('segment Alpha marqué vu', q('.sq-prog i.vu')!==null);
    q('#sq-prev').click(); await wait(400);
    ok('← vers patient déjà validé : OK', /ALPHA/.test(nom()));
    q('#sq-next').click(); await wait(400);
    ok('→ depuis patient validé (formulaire vierge) : OK, pas de doublon',
       /BETA/.test(nom()) && S.patients[0].visits.length===1);
    q('#sq-quit').click(); await wait(400);
    ok('Quitter formulaire vide : sort du déroulé', !q('#seq-mode.on'));
    console.log('\nERREURS:', ko||errs.length ? [ko+' échec(s)',...errs] : 'aucune');
    process.exit(ko?1:0);
  })();
}
