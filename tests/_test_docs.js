const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:[],archived:null,bilans:[],tags:[],infos:[],visits:[],
    docs:[{id:"d1",name:"scan_0012.pdf",mime:"application/pdf",date:"2026-09-03"},
          {id:"d2",name:"2026-09-05_Ordo-medecin_Renouvellement",mime:"application/pdf",
           date:"2026-09-05",type:"ordo-med",precision:"Renouvellement"}]}],
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
  w.eval(appjs + '\n;window.__D = { DOC_FAMILLES, docType, docNomCompose, docLabel, docAQualifier, docConversionUtile, poidsLisible, getP };');
  setTimeout(()=>{
    const D=w.__D;
    console.log('═══ CATÉGORIES ═══');
    console.log('  familles :', D.DOC_FAMILLES.length, D.DOC_FAMILLES.length===5?'✓':'⚠');
    console.log('  ', D.DOC_FAMILLES.map(f=>f.lbl).join(" · "));
    const nbT = D.DOC_FAMILLES.reduce((a,f)=>a+f.types.length,0);
    console.log('  types au total :', nbT);
    console.log('  famille Libre  :', D.DOC_FAMILLES.some(f=>f.cle==="libre") ? '✓' : '⚠');

    console.log('\n═══ NOM COMPOSÉ ═══');
    const n1 = D.docNomCompose("ordo-med","Renouvellement","2026-09-08");
    console.log('  ', n1);
    console.log('  sans accents ni espaces :', /^[\w.-]+$/.test(n1) ? '✓' : '⚠');
    const n2 = D.docNomCompose("plaie","Jambe gauche","2026-09-08");
    console.log('  ', n2, /^[\w.-]+$/.test(n2) ? '✓' : '⚠');
    const n3 = D.docNomCompose("bio","Résultat d'INR — contrôle","2026-09-08");
    console.log('  accents traités :', n3);

    console.log('\n═══ CONVERSION PDF ═══');
    console.log('  ordonnance → PDF utile :', D.docConversionUtile("ordo-med") ? '✓' : '⚠');
    console.log('  plaie      → images    :', !D.docConversionUtile("plaie") ? '✓ conservées' : '⚠ CONVERTIE');

    console.log('\n═══ AFFICHAGE ═══');
    const p = D.getP("p1");
    p.docs.forEach(d => {
      console.log(`  ${D.docAQualifier(d) ? "⚠ à qualifier" : "✓ qualifié   "} ${D.docLabel(d)}`);
    });
    console.log('\n  poids lisible :', D.poidsLisible(3460000), '·', D.poidsLisible(508000));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1400);
}
