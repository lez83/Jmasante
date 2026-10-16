const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(i,n,pr,v)=>({id:i,nom:n,prenom:pr,dob:"1941-06-30",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],
  infos:[{id:"x"+i,type:"acces",txt:"Code 0000",show:true}],visits:v||[]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3"]},tours:["A"],curTour:"A",
  patients:[
    mk("p1","Démo-Martin","Renée",[{uid:"v1",date:iso,at:"06:29",soins:["Toilette","Pilulier"],consts:{ta:"14/8"},note:""}]),
    mk("p2","Démo-Dupont","Simone"),
    mk("p3","Démo-Bernard","Marcel")],
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
    // ── ① SÉLECTEUR DE TYPE ──
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    q('[data-edit]')?.click(); await wait(800);
    q('[data-tab="info"]')?.click(); await wait(400);
    console.log('═══ ① TYPE D INFORMATION ═══');
    console.log('  Pastille cliquable:', !!q('.info-typ'), '| avec chevron:', !!q('.info-typ .it-ch'));
    console.log('  Ancien bouton icône seul retiré:', !q('.info-ic'));
    q('#f-info-add')?.click(); await wait(500);
    console.log('  ＋ ouvre la GRILLE:', !!q('.tpgrid'), '| version large:', !!q('.tpgrid.large'));
    console.log('  Six types:', qa('.tpcell').length, '| avec sous-titres:', qa('.tc-sub').length);
    // Choisir Vigilance
    [...qa('[data-pt]')].find(b=>b.dataset.pt==='vigilance')?.click(); await wait(600);
    console.log('  Ligne créée au bon type:', [...qa('.info-typ .it-lbl')].map(e=>e.textContent).join(' · '));
    // Changer un type : grille compacte
    q('.info-typ')?.click(); await wait(500);
    console.log('  Changement → grille compacte:', !!q('.tpgrid') && !q('.tpgrid.large'));
    console.log('  Type actuel marqué:', !!q('.tpcell.on'), '| coche:', !!q('.tc-ok'));
    q('#pt-cancel')?.click(); await wait(300);
    q('#f-cancel')?.click(); await wait(400);
    // ── ③ RECHERCHE ──
    console.log('\n═══ ③ RECHERCHE ═══');
    q('[data-a="search"]')?.click(); await wait(600);
    console.log('  Fermeture EN HAUT:', !!q('#sheet .navbar'), '| bouton bas conservé:', !!q('#srch-close'));
    q('#srch-close')?.click(); await wait(400);
    // ── ④ DÉROULÉ ──
    console.log('\n═══ ④ DÉROULÉ ═══');
    q('[data-a="seq"]')?.click(); await wait(800);
    const ctr=q('.sq-ctr')?.textContent||'';
    console.log('  Reprend au 1er NON VU:', ctr.slice(0,30), '(attendu 2/3 DÉMO-DUPONT)');
    console.log('  → pas au 1er patient déjà vu:', !ctr.includes('DÉMO-MARTIN'));
    // Quitter et relancer
    q('[data-a="seq"]')?.click(); await wait(500);
    q('[data-a="seq"]')?.click(); await wait(700);
    console.log('  Après sortie/reprise:', (q('.sq-ctr')?.textContent||'').slice(0,20));
    q('[data-a="seq"]')?.click(); await wait(500);
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
