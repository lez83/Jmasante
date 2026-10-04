// v1.0.64 — Thème Cosmos · NGC 3324 : scène dans le bandeau, vues selon
// l'heure, Nord/Sud/Alterner, ordre configurable, vue forcée, animations,
// frise étoile filante, retrait de la scène en quittant le thème.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":[]},tours:["A"],curTour:"A",patients:[],rappels:[],noVisit:{},trash:[],drafts:{}};
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
  w.eval(appjs+'\n;window.__B={getS:()=>S, render, applyTheme, vueCosmos, sceneCosmos, sheetPersoZone, APP_THEMES};');
  const d=w.document, B=w.__B, H=d.documentElement;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  const a=(h,m)=>{ const x=new Date(); x.setHours(h,m||0,0,0); return x; };
  (async()=>{
    await wait(1400); const S=B.getS();
    console.log('═══ THÈME ═══');
    ok(!!B.APP_THEMES.cosmos,'septième thème « Cosmos · NGC 3324 »');
    S.theme='cosmos'; B.applyTheme(); B.render(); await wait(100);
    ok(H.dataset.appTheme==='cosmos','thème appliqué');
    ok(!!d.querySelector('.brand #cz-scene svg'),'scène animée dans le bandeau');
    ok(/NGC 3324/.test(d.querySelector('#cz-scene').innerHTML),'NGC 3324 affichée');
    ok(!!d.querySelector('#frise .cz-fil'),'frise : étoile filante');
    console.log('═══ VUES SELON L\'HEURE ═══');
    const att=[[6,0,'aube'],[9,0,'orbite'],[13,0,'falaises'],[18,0,'planetes'],[21,0,'boreale'],[2,0,'australe'],[5,0,'australe']];
    ok(att.every(([h,m,v])=>B.vueCosmos(a(h,m))===v),'six vues aux bonnes heures (5 h → encore la nuit australe)');
    ['aube','orbite','falaises','planetes','boreale','australe'].forEach(v=>{ if(!/<svg/.test(B.sceneCosmos(v,'t'))) errs.push('scène '+v); });
    ok(['aube','orbite','falaises','planetes','boreale','australe'].every(v=>/NGC 3324/.test(B.sceneCosmos(v,'t'))),'NGC 3324 présente dans les six scènes');
    console.log('═══ NUIT : NORD / SUD / ALTERNER ═══');
    S.cosmos.nuit='nord'; ok(B.vueCosmos(a(2))==='boreale','Nord : ciel boréal toute la nuit');
    S.cosmos.nuit='sud'; ok(B.vueCosmos(a(21))==='australe','Sud : ciel austral toute la nuit');
    S.cosmos.nuit='alterner';
    console.log('═══ RÉGLAGES ═══');
    B.sheetPersoZone('couleurs'); await wait(100);
    ok(!!d.querySelector('.cz-reg') && d.querySelectorAll('[data-czh]').length===6,'réglages Cosmos : 6 créneaux horaires');
    d.querySelector('[data-czd="1"]').click(); await wait(100);
    ok(S.cosmos.creneaux[1].vue==='falaises' && S.cosmos.creneaux[2].vue==='orbite' && S.cosmos.creneaux[1].h==='08:00','▼ : la vue change de créneau, l\'heure reste');
    ok(B.vueCosmos(a(9))==='falaises','… NGC 3324 dès 8 h');
    const h=d.querySelector('[data-czh="0"]'); h.value='06:15'; h.dispatchEvent(new w.Event('change')); await wait(100);
    ok(S.cosmos.creneaux[0].h==='06:15' && B.vueCosmos(a(6,0))==='australe','heure modifiée (aube à 6 h 15)');
    d.querySelector('[data-czf="falaises"]').click(); await wait(100);
    ok(B.vueCosmos(a(23))==='falaises','📌 vue forcée en permanence');
    d.querySelector('[data-czf="falaises"]').click(); await wait(100);
    const o=d.querySelector('[data-czo="4"]'); o.checked=false; o.dispatchEvent(new w.Event('change')); await wait(100);
    ok(S.cosmos.creneaux[4].on===false && B.vueCosmos(a(21))==='planetes','vue retirée : la précédente continue');
    d.querySelector('[data-cza="discretes"]').click(); await wait(100);
    ok(H.dataset.czAnim==='discretes','animations discrètes (sans étoiles filantes)');
    console.log('═══ QUITTER LE THÈME ═══');
    S.theme='bloc'; B.applyTheme(); B.render(); await wait(100);
    ok(!d.querySelector('#cz-scene') && !d.querySelector('#frise .cz-fil'),'scène et frise retirées');
    S.themeAuto={on:true,jour:'bloc',nuit:'cosmos',hJour:'00:00',hNuit:'00:01'}; B.applyTheme(); B.render(); await wait(100);
    ok(H.dataset.appTheme==='cosmos' && d.querySelector('#cz-scene'),'jour/nuit : Cosmos la nuit');
    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
    process.exit(0);
  })();
}
