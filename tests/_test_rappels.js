const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Martin",prenom:"Renée",dob:"1938-04-12",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[{uid:"v1",date:iso,at:"08:00",soins:["Toilette"],consts:{},note:""}]}],
  rappels:[
    {id:"r1",pid:"p1",tour:"A",perso:false,type:"ordo",text:"Récupérer le médicament à la pharmacie",due:iso,done:false},
    {id:"r2",pid:"p1",tour:"A",perso:false,type:"ordo",text:"Commander des compresses",due:iso,done:false}],
  noVisit:{},trash:[],drafts:{}};
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
  w.eval(appjs + '\n;window.__R = { etat:()=>S, resultatPropose, buildReleve };');
  const d=w.document,q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1200);
    const R=w.__R;
    console.log('═══ PROPOSITION DE TEXTE ═══');
    [["Récupérer le médicament à la pharmacie",null],["Renouveler l'ordonnance",null],
     ["Commander des compresses",null],["Appeler le Dr Démo",null],["Chose sans verbe connu",null]]
      .forEach(([t])=>console.log(`  "${t}"\n    → "${R.resultatPropose(t)}"`));

    console.log('\n═══ VALIDATION D UN RAPPEL ═══');
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    q('[data-rappels]')?.click(); await wait(800);
    console.log('  rappels affichés :', qa('[data-rchk]').length);
    qa('[data-rchk]')[0]?.click(); await wait(600);
    const champ = q('#dlg-in');
    console.log('  dialogue ouvert :', !!champ);
    console.log('  texte pré-rempli :', champ ? `"${champ.value}"` : '-');
    if (champ){ q('.dlg-veil [data-yes]')?.click(); }
    await wait(900);
    const r1 = R.etat().rappels.find(x=>x.id==="r1");
    console.log('  rappel fait :', r1.done, '| résultat :', r1.resultat ? `"${r1.resultat}"` : 'AUCUN');

    console.log('\n═══ DANS LA RELÈVE ═══');
    const rel = R.buildReleve ? R.buildReleve({ raps:true, soins:true }) : "";
    const txt = typeof rel === "string" ? rel : JSON.stringify(rel);
    console.log('  ✅ information présente :', /Médicament récupéré/i.test(txt));
    console.log('  📌 rappel restant présent :', /compresses/i.test(txt));

    console.log('\n═══ ÉCRAN DES RAPPELS ═══');
    console.log('  section « Notés dans la relève » :',
      (q('#sheet')?.textContent||'').includes('Notés dans la relève'));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
