// v1.0.60 — Couleurs et motifs des statuts : palettes, retouche,
// garde-fou, motifs et formes, retour à l'origine.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"tubes",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,cardStyle:"bande",
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
  rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
     .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window; w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x'; let errs=[]; w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs+'\n;window.__B={getS:()=>S, sheetCouleurs, statutsTropProches, sheetAppPanel};');
  const d=w.document, B=w.__B, H=d.documentElement;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  const v=n=>H.style.getPropertyValue(n).trim();
  (async()=>{
    await wait(1400);
    console.log('═══ PALETTE JM@SANTÉ (défaut) ═══');
    ok(!H.dataset.stc && !v('--st-todo'),'aucune couleur imposée : le thème (Tubes néon) garde ses teintes');
    B.sheetAppPanel(); await wait(100);
    ok(!!d.querySelector('#go-couleurs') && !!d.querySelector('#go-couleurs').onclick,'bouton 🎨 dans Application, câblé');
    B.sheetCouleurs(); await wait(100);
    ok(d.querySelectorAll('#sheet [data-pre]').length===4,'4 palettes proposées');
    console.log('═══ FEU TRICOLORE ═══');
    d.querySelector('[data-pre="feu"]').click(); await wait(100);
    ok(H.dataset.stc==='1' && v('--st-todo')==='#5d8fd9' && v('--st-alert')==='#e05540','variables posées sur <html>');
    ok(d.querySelectorAll('.stc-prev .pcard').length===4 && d.querySelector('#stc-leg .legende'),'aperçu cartes + légende');
    console.log('═══ RETOUCHE ET GARDE-FOU ═══');
    d.querySelector('[data-ed="alert"]').click(); await wait(80);
    d.querySelector('[data-col="#5d8fd9"]').click(); await wait(100);
    ok(B.getS().couleurs.perso.alert==='#5d8fd9' && v('--st-alert')==='#5d8fd9','couleur retouchée appliquée');
    ok(!!d.querySelector('.stc-warn') && /À voir et Vigilance/.test(d.querySelector('.stc-warn').textContent),'garde-fou : À voir et Vigilance identiques signalés');
    d.querySelector('[data-raz="alert"]').click(); await wait(100);
    ok(!B.getS().couleurs.perso.alert && v('--st-alert')==='#e05540','↺ revient à la couleur de la palette');
    ok(!d.querySelector('.stc-warn'),'plus d\'avertissement');
    console.log('═══ MOTIFS ET FORMES ═══');
    d.querySelector('#stc-mot').checked=true; d.querySelector('#stc-mot').dispatchEvent(new w.Event('change')); await wait(100);
    ok(H.dataset.motifs==='1','motifs activés');
    ok(/repeating-linear-gradient/.test(v('--st-done-img')) && /radial-gradient/.test(v('--st-absent-img')) && v('--st-todo-img')==='none','motifs par défaut : vu rayures, absent points, à voir plein');
    ok(/255,255,255/.test(v('--st-absent-img')) && /0,0,0/.test(v('--st-done-img')),'encre blanche sur gris foncé, noire sur couleur claire');
    d.querySelector('[data-ed="todo"]').click(); await wait(80);
    d.querySelector('[data-mot="quadrillage"]').click(); await wait(100);
    ok(B.getS().couleurs.motif.todo==='quadrillage' && /linear-gradient/.test(v('--st-todo-img')),'motif choisi par statut');
    console.log('═══ DALTONISME ═══');
    d.querySelector('#stc-mot').checked=false; d.querySelector('#stc-mot').dispatchEvent(new w.Event('change')); await wait(80);
    d.querySelector('[data-pre="dalto"]').click(); await wait(100);
    ok(H.dataset.motifs==='1' && v('--st-done')==='#009e73','la palette Daltonisme active les motifs d\'office');
    ok(B.statutsTropProches().length===0,'palette Daltonisme : aucun couple trop proche');
    console.log('═══ RETOUR À L\'ORIGINE ═══');
    d.querySelector('#stc-raz').click(); await wait(100);
    ok(!H.dataset.stc && !H.dataset.motifs && !v('--st-todo'),'tout revient aux couleurs du thème');
    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
    process.exit(0);
  })();
}
