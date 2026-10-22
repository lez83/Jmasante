// Un bouton posé dans le HTML mais sans gestionnaire ne fait RIEN et
// ne lève aucune erreur. C'est arrivé au bouton « Fiche de recueil » :
// visible, cliquable, muet. Ce test attrape le cas.
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
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
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
  w.eval(appjs + '\n;window.__B = { sheetPatient, getP };');
  const d=w.document;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1300);
    w.__B.sheetPatient(w.__B.getP("p1")); await wait(700);
    console.log('═══ BOUTONS DE LA FICHE PATIENT ═══');
    let muets=[];
    ["id","info","soins","act"].forEach(ong => {
      const t = d.querySelector(`[data-tab="${ong}"]`); if (t) t.click();
      d.querySelectorAll('#sheet button[id^="f-"]').forEach(b => {
        if (!b.onclick && !muets.includes(b.id)) muets.push(b.id);
      });
    });
    // Retirer ceux qui sont branchés dans un autre onglet
    const tous = new Set();
    ["id","info","soins","act"].forEach(ong => {
      const t = d.querySelector(`[data-tab="${ong}"]`); if (t) t.click();
      d.querySelectorAll('#sheet button[id^="f-"]').forEach(b => { if (b.onclick) tous.add(b.id); });
    });
    muets = muets.filter(id => !tous.has(id));
    console.log('  boutons branchés :', tous.size);
    if (muets.length) console.log('  ⚠ SANS ACTION :', muets.join(", "));
    else console.log('  ✓ aucun bouton muet');

    console.log('\n═══ BOUTONS DE LA CARTE PATIENT ═══');
    // ⚠️ Le câblage de ces boutons a été perdu deux fois par un
    // remplacement de code qui a échoué en silence.
    const CARTE = ["data-docs","data-bilans","data-raps","data-clone","data-hist",
                   "data-graph","data-edit","data-plnew","data-save","data-cancel"];
    const src = require('fs').readFileSync('../jmsante/www/js/ui.js','utf-8');
    let manquants = [];
    CARTE.forEach(a => {
      // Le bouton est câblé s'il apparaît hors du gabarit HTML,
      // suivi d'un .onclick ou d'un forEach quelque part
      const i = src.indexOf('"' + a + '"');            // dans qEl(f, "data-x")
      const j = src.indexOf('[' + a + ']');            // dans querySelector
      const pose = i >= 0 || (j >= 0 && /onclick|forEach/.test(src.slice(j, j + 200)));
      console.log(`  ${pose ? '✓' : '⚠ NON CÂBLÉ'} ${a}`);
      if (!pose) manquants.push(a);
    });
    if (manquants.length) console.log('  ⚠ à câbler :', manquants.join(', '));

    console.log('\n═══ LA FICHE DE RECUEIL S OUVRE ═══');
    const t = d.querySelector('[data-tab="act"]'); if (t) t.click();
    await wait(300);
    const rec = d.getElementById('f-recueil');
    console.log('  bouton présent :', !!rec);
    if (rec){ rec.click(); await wait(600); }
    console.log('  écran ouvert   :', !!d.getElementById('rc-nom') ? '✓' : '✗');
    console.log('\nERREURS:', errs.length?errs:'aucune');
    process.exit(muets.length ? 1 : 0);
  })();
}
