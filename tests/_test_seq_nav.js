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
  /* ⚠️ jsdom n'expose pas `CSS` dans ce contexte d'évaluation, alors que
     `CSS.escape` est standard dans tout navigateur réel. Sans ce bouchon,
     la restauration d'une saisie gardée lève « CSS is not defined » — un
     défaut de l'ENVIRONNEMENT D'ESSAI, pas de l'application. Le vrai
     parcours est vérifié dans Chromium par tests/navigateur/pw_deroule.js. */
  Object.defineProperty(w,'CSS',{value:{ escape:x=>String(x).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, c=>'\\'+c) }});
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
    /* ⚠️ RÈGLE RENVERSÉE EN v1.15.1, À SA DEMANDE.
       Les flèches ENREGISTRAIENT dès que le formulaire n'était pas vide.
       Or un patient déjà validé revient avec ses soins cochés : revenir
       le relire puis repartir créait un SECOND PASSAGE — et pire, valider
       avec le bouton du bas puis appuyer une fois sur → en donnait déjà
       deux. Mesuré avant correction.
       Désormais : UN SEUL chemin crée un passage, le bouton « ✓ Valider
       le passage ». Les flèches ne font que naviguer. Une saisie non
       validée n'est pas perdue pour autant : elle part en « saisie
       gardée 💾 ». */
    const soin=q('#seq-mode .chip[data-s]'); if(soin) soin.click(); await wait(200);
    q('#sq-next').click(); await wait(500);
    ok('→ avec saisie : rien n est enregistré, on passe à Beta',
       S.patients[0].visits.length===0 && /BETA/.test(nom()));
    ok('mais la saisie d Alpha est gardée', !!(S.drafts||{})['p1']);
    ok('Alpha n est PAS marqué vu tant qu il n est pas validé', q('.sq-prog i.vu')===null);
    q('#sq-prev').click(); await wait(400);
    ok('← vers Alpha : OK', /ALPHA/.test(nom()));
    /* Le seul chemin qui crée un passage. */
    q('#seq-mode [data-save]')?.click(); await wait(600);
    ok('le bouton du bas crée UN passage', S.patients[0].visits.length===1);
    q('#sq-next').click(); await wait(400);
    ok('→ juste après avoir validé : pas de doublon',
       /BETA/.test(nom()) && S.patients[0].visits.length===1);
    q('#sq-prev').click(); await wait(400);
    q('#sq-next').click(); await wait(400);
    ok('aller-retour sur un patient validé : toujours un seul passage',
       S.patients[0].visits.length===1);
    q('#sq-quit').click(); await wait(400);
    ok('Quitter : sort du déroulé', !q('#seq-mode.on'));
    console.log('\nERREURS:', ko||errs.length ? [ko+' échec(s)',...errs] : 'aucune');
    process.exit(ko?1:0);
  })();
}
