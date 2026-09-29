const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const j = n => new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const iso = j(0);
// Poids qui baisse lentement, toujours au-dessus du seuil de 48
const visitesPoids = [[22,54.2],[18,53.6],[14,53.0],[9,52.5],[4,52.0],[0,51.8]]
  .map(([d,p],i)=>({uid:"v"+i,date:j(d),at:"08:00",soins:["Toilette"],consts:{poids:String(p)},note:""}));
// TA qui monte
const visitesTA = [[21,"13/8"],[16,"13.5/8"],[11,"14/8.5"],[6,"14.5/9"],[1,"15/9"]]
  .map(([d,t],i)=>({uid:"w"+i,date:j(d),at:"08:00",soins:["TA / Pouls"],consts:{ta:t},note:""}));
// Stable : ne doit RIEN signaler
const visitesStable = [[20,"70.1"],[15,"70.3"],[10,"70.0"],[5,"70.2"],[0,"70.1"]]
  .map(([d,p],i)=>({uid:"x"+i,date:j(d),at:"08:00",soins:["Toilette"],consts:{poids:p},note:""}));
const mk=(id,nom,v)=>({id,nom,prenom:"P",dob:"1938-04-12",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
  thresholds:{},visits:v});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2","p3","p4"]},tours:["A"],curTour:"A",
  patients:[mk("p1","Maigrit",visitesPoids), mk("p2","Monte",visitesTA),
            mk("p3","Stable",visitesStable), mk("p4","Neuf",[])],
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
  w.eval(appjs + '\n;window.__T = { trendsOf, trendTexte, etat:()=>S };');
  setTimeout(()=>{
    const T = w.__T, St = T.etat();
    const a = T.trendsOf(St.patients[0]), b = T.trendsOf(St.patients[1]);
    const r = { a: a.length?T.trendTexte(a[0]):null,
                souSeuil: St.patients[0].visits.every(v=>parseFloat(v.consts.poids)>48),
                b: b.length?T.trendTexte(b[0]):null,
                c: T.trendsOf(St.patients[2]).length,
                d: T.trendsOf(St.patients[3]).length };
    console.log('═══ DÉTECTION ═══');
    console.log('① Poids en baisse:', r.a || 'RIEN DÉTECTÉ');
    console.log('   → toutes les valeurs au-dessus du seuil:', r.souSeuil);
    console.log('② TA en hausse:', r.b || 'RIEN DÉTECTÉ');
    console.log('③ Poids stable → silence:', r.c===0);
    console.log('④ Sans mesure → silence:', r.d===0);
    console.log('\n═══ FORMULATION ═══');
    console.log('⑤ Constat, pas diagnostic:',
      r.a ? !/dénutrition|dénutri|maigre|inquiét|anormal|patholog/i.test(r.a) : '-', '|', r.a);
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1400);
}
