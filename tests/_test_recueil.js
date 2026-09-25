const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Martin",prenom:"Renée",dob:"1938-04-12",genre:"F",
    address:"1 rue de la Démonstration",cp:"00000",ville:"Villeneuve",
    tel:{fixe:"00 00 00 00 00",mobile:""},
    contacts:{med:{nom:"Dr Démo",tel:"00 00 00 00 00"}},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],
    infos:[{id:"i1",type:"acces",txt:"Code portail 1234",show:true},
           {id:"i2",type:"acces",txt:"2e étage sans ascenseur",show:false},
           {id:"i3",type:"vigilance",txt:"Allergie pénicilline",show:true}],
    visits:[]}],
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
  w.eval(appjs + '\n;window.__R = { etat:()=>S, recueilInfo, recueilSetInfo, recueilAvance, sheetRecueil, getP };');
  const d=w.document,q=s=>d.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1300);
    const R=w.__R, p=R.getP("p1");
    console.log('═══ REGROUPEMENT DES INFORMATIONS ═══');
    const a=R.recueilInfo(p,"acces");
    console.log('  deux infos accès →', `"${a}"`);
    console.log('  séparées par « · » :', a.includes(" · ") ? '✓' : '⚠');

    console.log('\n═══ RÉÉCRITURE ═══');
    R.recueilSetInfo(p,"acces","Code portail 5678 · 3e étage · chien");
    const apres=(p.infos||[]).filter(i=>i.type==="acces");
    console.log('  une seule info accès :', apres.length===1 ? '✓' : '⚠ ' + apres.length);
    console.log('  visibilité conservée :', apres[0] && apres[0].show===true ? '✓ (relève)' : '⚠ PERDUE');
    console.log('  autres types intacts :',
      (p.infos||[]).some(i=>i.type==="vigilance") ? '✓' : '⚠ ÉCRASÉS');

    console.log('\n═══ AVANCEMENT ═══');
    const av=R.recueilAvance(p);
    console.log(`  ${av.remplis}/${av.total} champs`, av.remplis>0 && av.remplis<av.total ? '✓' : '⚠');

    console.log('\n═══ ÉCRAN ═══');
    R.sheetRecueil("p1"); await wait(700);
    console.log('  ouvert :', !!q('#rc-nom'));
    console.log('  champs de saisie :', d.querySelectorAll('.rec-in').length);
    console.log('  barre d\'avancement :', !!q('.rec-bar i'));
    console.log('  boutons impression :', !!q('#rc-print') && !!q('#rc-vierge'));

    console.log('\n═══ SAISIE → DOSSIER ═══');
    const ch=q('#rc-tmob'); ch.value="06 11 22 33 44";
    ch.dispatchEvent(new w.Event('change')); await wait(400);
    console.log('  portable écrit dans le dossier :',
      R.getP("p1").tel.mobile==="06 11 22 33 44" ? '✓ direct' : '⚠');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
