const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const d=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[{uid:"v1",date:d(2),at:"08:00",soins:["Toilette"],consts:{},note:"passage d avant-hier"}]}],
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
  const doc=w.document,q=s=>doc.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1000);
    console.log('═══ AUJOURD HUI ═══');
    console.log('① Flèches présentes:', !!q('#d-prev')&&!!q('#d-next'));
    console.log('② Flèche droite grisée:', q('#d-next')?.disabled===true, '(pas de futur)');
    console.log('③ Aucun bandeau:', (q('#datebar')?.innerHTML||'')==='' , '(attendu true)');
    console.log('④ Date affichée:', q('#h-date')?.textContent);
    console.log('⑤ Patient « à voir »:', q('.spill .n')?.textContent, '(attendu 1)');
    // Reculer de 2 jours
    q('#d-prev')?.click(); await wait(400);
    q('#d-prev')?.click(); await wait(500);
    console.log('\n═══ RECUL DE 2 JOURS ═══');
    console.log('⑥ Date affichée:', q('#h-date')?.textContent);
    console.log('⑦ BANDEAU visible:', !!q('.dpast'));
    console.log('   Texte:', (q('.dp-t')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,70));
    console.log('⑧ Bouton retour:', !!q('#dp-today'));
    console.log('⑨ Flèche droite active:', q('#d-next')?.disabled===false);
    console.log('⑩ Patient VU ce jour-là:', doc.querySelectorAll('.spill')[1]?.querySelector('.n')?.textContent, '(attendu 1 — passage d avant-hier)');
    // Saisir un passage à cette date
    doc.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    console.log('\n⑪ Carte rouvre le passage de ce jour-là:', (q('[data-note]')?.value||'').includes('avant-hier'));
    // Retour aujourd'hui
    q('#veil')?.classList.remove('on');
    q('#dp-today')?.click(); await wait(500);
    console.log('\n═══ RETOUR ═══');
    console.log('⑫ Bandeau disparu:', (q('#datebar')?.innerHTML||'')==='');
    console.log('⑬ Patient de nouveau « à voir »:', q('.spill .n')?.textContent, '(attendu 1)');
    // Limite de recul
    for(let i=0;i<40;i++){ q('#d-prev')?.click(); }
    await wait(600);
    const lbl=(q('.dp-t')?.textContent||'');
    const m=/il y a (\d+) jours/.exec(lbl);
    console.log('\n⑭ Recul maximal:', m?m[1]+' jours':'?', '(attendu 30)');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
