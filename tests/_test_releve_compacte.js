const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const j=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
const iso=j(0);
// 7 jours × matin/soir, plan tenu partout sauf 3 moments
const PLAN=["Toilette","TA / Pouls","Pansement jambe gauche","Bas de contention","Pilulier"];
const visits=[];
for (let d=6; d>=0; d--){
  ["matin","soir"].forEach((sl,k)=>{
    const v={uid:`v${d}${k}`,date:j(d),at:sl==="matin"?"08:15":"18:30",slot:sl,
      soins:["Toilette","TA / Pouls","Pansement jambe gauche"],consts:{},note:"",soinNotes:{}};
    // Soins non quotidiens : seulement certains jours
    if (d%2===0) v.soins.push("Bas de contention");
    if (d===6) v.soins.push("Pilulier");
    if (d===4 && sl==="matin") v.soinNotes={"Pansement jambe gauche":"plaie propre, bourgeonnement"};
    if (d===2 && sl==="soir") v.note="nuit agitée d'après la fille";
    if (d===0 && sl==="matin"){ v.consts={ta:"16/9.5"}; v.constRel=true; }
    visits.push(v);
  });
}
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Martin",prenom:"Renée",dob:"1938-04-12",genre:"F",address:"",
    contacts:{},tours:["A"],plan:PLAN,archived:null,bilans:[],docs:[],tags:[],infos:[],
    plaies:[],visits,thresholds:{taSysMax:15,taDiaMax:9}}],
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
  w.eval(appjs + '\n;window.__R = { buildReleve, getP };');
  setTimeout(()=>{
    const R=w.__R;
    const txt = R.buildReleve({ start:j(6), end:j(0), mode:"all", withRaps:false });
    console.log('═══ RELÈVE SUR 7 JOURS (14 passages) ═══\n');
    console.log(txt.split('\n').map(l=>'  '+l).join('\n'));
    console.log('\n═══ CONTRÔLES ═══');
    const l = txt.split('\n');
    const conformes = l.filter(x=>/Plan de soins respect/.test(x));
    console.log('  lignes « plan respecté » :', conformes.length, conformes.length===1?'✓':'⚠ doit être 1');
    console.log('  porte la période         :', /du .* au /.test(conformes[0]||'') ? '✓' : '⚠');
    console.log('  pas de liste de soins    :',
      !l.some(x=>/Plan de soins respect/.test(x) && /Toilette/.test(x)) ? '✓' : '⚠');
    const redondance = l.filter(x=>/✅.*Toilette/.test(x));
    console.log('  passages conformes listés:', redondance.length, redondance.length===0?'✓':'⚠ redondant');
    console.log('  commentaire présent      :', /bourgeonnement/.test(txt) ? '✓' : '⚠');
    console.log('  note libre présente      :', /nuit agitée/.test(txt) ? '✓' : '⚠');
    console.log('  TA hors seuil présente   :', /16\/9/.test(txt) ? '✓' : '⚠');
    console.log('\n  longueur :', l.filter(x=>x.trim()).length, 'lignes');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1500);
}
