// v1.0.67 — Étiquettes personnalisées : création, pose, affichage,
// relève, échanges (fusion sans écrasement), suppression.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[{id:"v",date:iso,at:"08:00",soins:[],consts:{ta:"12/8"},note:"ok"}]}],
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
  w.eval(appjs+'\n;window.__B={getS:()=>S, render, sheetPersoZone, buildReleve, fusionTagsPerso, ouvrirTexteRecu};');
  const d=w.document, B=w.__B;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  (async()=>{
    await wait(1400); const S=B.getS();
    console.log('═══ CRÉATION ═══');
    B.sheetPersoZone('cartes'); await wait(100);
    d.querySelector('#pz-tgnew').click(); await wait(100);
    d.querySelector('#tg-lbl').value='Chien méchant'; d.querySelector('#tg-lbl').dispatchEvent(new w.Event('input'));
    d.querySelector('[data-tgc="#e05540"]').click(); await wait(60);
    d.querySelector('#tg-ok').click(); await wait(150);
    const ids=Object.keys(S.tagsPerso||{}); const id=ids[0];
    ok(ids.length===1 && S.tagsPerso[id].lbl==='Chien méchant' && S.tagsPerso[id].col==='#e05540','étiquette créée avec nom et couleur');
    ok(/^u_[a-z0-9]+$/.test(id),'identifiant propre (u_…)');
    B.sheetPersoZone('cartes'); await wait(80);
    d.querySelector('#pz-tgnew').click(); await wait(80);
    d.querySelector('#tg-lbl').value='chien MÉCHANT'; d.querySelector('#tg-ok').click(); await wait(100);
    ok(Object.keys(S.tagsPerso).length===1,'doublon de nom refusé');
    console.log('═══ POSE SUR UN PATIENT ═══');
    B.render(); await wait(100);
    d.querySelector('[data-toggle="p1"]').click(); await wait(300);
    const chip=d.querySelector(`.pcard.open [data-tag="${id}"]`);
    ok(!!chip,'proposée dans la carte ouverte, avec les étiquettes fournies');
    chip.click(); await wait(150);
    ok((S.patients[0].tags||[]).includes(id),'posée sur le patient');
    d.querySelector('.pcard.open [data-toggle]').click(); await wait(300);
    ok(/Chien méchant/.test(d.querySelector('.pcard').textContent) && d.querySelector('.pcard .mini.tagp'),'affichée sur la carte repliée, à sa couleur');
    const rel=()=>B.buildReleve({start:'2000-01-01',end:'2100-01-01',mode:'full',withRaps:true,keep:null,pOpts:{},layout:'structure',anon:false,tour:'A'});
    ok(/Chien méchant/.test(rel()),'présente dans la relève');
    S.tagsPerso[id].carte=false; S.tagsPerso[id].releve=false; B.render(); await wait(100);
    ok(!/Chien méchant/.test(d.querySelector('.pcard').textContent),'masquée sur la carte si demandé');
    ok(!/Chien méchant/.test(rel()),'absente de la relève si demandé');
    S.tagsPerso[id].carte=true; S.tagsPerso[id].releve=true;
    console.log('═══ ÉCHANGES ═══');
    const n=B.fusionTagsPerso({ [id]:{ic:'🐈',lbl:'AUTRE',col:'#000000'}, u_zzzz9999:{ic:'🔑',lbl:'Clé voisine',col:'#56b4e9',genre:'pratique'}, 'pirate':{lbl:'x'} });
    ok(n===1 && S.tagsPerso[id].lbl==='Chien méchant' && S.tagsPerso.u_zzzz9999 && !S.tagsPerso.pirate,'fusion : ajoute les nouvelles, n\'écrase jamais, ignore les clés invalides');
    B.ouvrirTexteRecu(JSON.stringify({_jmsync:1,from:{uid:'x',name:'Pierre'},tagsPerso:{u_abcd1234:{ic:'🦻',lbl:'Sourd',col:'#9b6bd8'}},generatedAt:Date.now(),changes:[]})); await wait(200);
    ok(!!S.tagsPerso.u_abcd1234,'définitions reçues avec une synchro');
    console.log('═══ SUPPRESSION ═══');
    B.sheetPersoZone('cartes'); await wait(80);
    d.querySelector(`[data-tged="${id}"]`).click(); await wait(80);
    d.querySelector('#tg-del').click(); await wait(200); d.querySelector('.dlg-veil [data-yes]').click(); await wait(250);
    ok(!S.tagsPerso[id] && !(S.patients[0].tags||[]).includes(id),'supprimée partout, patients compris');
    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
    process.exit(0);
  })();
}
