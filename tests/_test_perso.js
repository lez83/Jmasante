// v1.0.62 — Personnaliser : zones, texte/zoom, constantes masquées et
// forcées, contenu des cartes, barre d'outils, réinitialisation.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},tours:["A"],plan:[],archived:null,bilans:[],
    docs:[{id:"d1",name:"x"}],tags:["prioritaire","surveiller"],infos:[],
    visits:[{id:"v",date:iso,at:"08:00",soins:[],consts:{ta:"128/78",glyc:"2.6",puls:"74"}}]}],
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
  w.eval(appjs+'\n;window.__B={getS:()=>S, render, sheetPersonnaliser, sheetPersoZone, sheetPatient, sheetTours, applyTheme, themeEffectif, buildReleve, extraireReglages, ouvrirTexteRecu, partagerReglages};');
  const d=w.document, B=w.__B, H=d.documentElement;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  (async()=>{
    await wait(1400); const S=B.getS();
    console.log('═══ ÉCRAN PERSONNALISER ═══');
    B.sheetTours(); await wait(100);
    ok(!!d.querySelector('[data-sec="perso"]'),'tuile 🎨 Personnaliser dans le menu');
    B.sheetPersonnaliser(); await wait(100);
    ok(d.querySelectorAll('#sheet [data-pz]').length>=5 && d.querySelector('.pers-prev .pcard'),'zones + aperçu en direct');
    console.log('═══ TEXTE ET ZOOM ═══');
    B.sheetPersoZone('texte'); await wait(100);
    d.querySelector('[data-zc="1.3"]').click(); await wait(100);
    ok(d.body.style.zoom==='1.3' && H.hasAttribute('data-zoomcol'),'Très grande : zoom 130 % et une seule colonne');
    d.querySelector('[data-zm="natif"]').click(); await wait(150);
    d.querySelectorAll('.dlg-veil [data-yes]').forEach(b=>b.click()); await wait(250);
    ok(/user-scalable=yes/.test(d.querySelector('meta[name=viewport]').content),'mode Natif : zoom du navigateur autorisé');
    d.querySelector('[data-zm="intelligent"]').click(); await wait(150);
    d.querySelectorAll('.dlg-veil [data-yes]').forEach(b=>b.click()); await wait(250);
    ok(/user-scalable=no/.test(d.querySelector('meta[name=viewport]').content),'mode Intelligent : zoom navigateur bloqué');
    const ev=new w.WheelEvent('wheel',{deltaY:-100,ctrlKey:true,cancelable:true}); w.dispatchEvent(ev); await wait(50);
    ok(Math.abs(S.zoomApp-1.35)<0.001 && ev.defaultPrevented,'Ctrl + molette : +5 % (135 %)');
    console.log('═══ CONSTANTES ═══');
    B.sheetPersoZone('consts'); await wait(100);
    const cb=d.querySelector('[data-cv="glyc"]'); cb.checked=false; cb.dispatchEvent(new w.Event('change')); await wait(100);
    ok((S.constsMasquees||[]).includes('glyc'),'glycémie masquée');
    d.querySelector('[data-cdn="0"]').click(); await wait(100);
    ok(S.constsOrdre[0]==='puls' && S.constsOrdre[1]==='ta','ordre modifié (Pouls avant TA)');
    B.render(); await wait(100);
    d.querySelector('[data-toggle="p1"]').click(); await wait(300);
    const g=d.querySelector('.pcard.open [data-ck="glyc"]');
    ok(g && /display:\s*none/.test(g.getAttribute('style')),'champ Glycémie caché dans la saisie');
    ok(/Gly 2.6/.test(d.querySelector('.pcard .vitals').textContent),'… mais la glycémie HORS SEUIL reste visible sur la carte');
    const v=d.querySelector('.pcard .vitals').textContent;
    ok(v.indexOf('♥')<v.indexOf('TA'),'ligne compacte dans le nouvel ordre');
    S.constStyle='tableau'; B.render(); await wait(100);
    if (!d.querySelector('.pcard.open')){ d.querySelector('[data-toggle="p1"]').click(); await wait(300); }
    console.log('    (tuiles : '+[...d.querySelectorAll('.pcard.open [data-vtile]')].map(x=>x.dataset.vtile).join(',')+')');
    ok(!d.querySelector('.pcard.open [data-vtile="glyc"]') && d.querySelectorAll('.pcard.open [data-vtile]').length===5,'tuile Glycémie retirée (5 tuiles)');
    B.sheetPatient(S.patients[0]); await wait(300);
    const cf=d.querySelector('#sheet [data-cforce="glyc"]'); ok(!!cf,'fiche : proposition de forcer la glycémie pour ce patient');
    cf.click(); await wait(100);
    ok((S.patients[0].constsForcees||[]).includes('glyc'),'glycémie forcée pour ce patient');
    B.render(); await wait(100);
    const tg=[...d.querySelectorAll('[data-toggle="p1"]')]; tg[0].click(); await wait(300);
    if (!d.querySelector('.pcard.open')){ d.querySelector('[data-toggle="p1"]').click(); await wait(300); }
    ok(!!d.querySelector('.pcard.open [data-vtile="glyc"]'),'… sa tuile Glycémie revient');
    console.log('═══ CONTENU DES CARTES ═══');
    B.sheetPersoZone('cartes'); await wait(100);
    for (const k of ['age','badges','tags','dernier']){ const c=d.querySelector(`[data-cm="${k}"]`); c.checked=false; c.dispatchEvent(new w.Event('change')); await wait(60); }
    B.render(); await wait(100);
    if (d.querySelector('.pcard.open')){ d.querySelector('.pcard.open [data-toggle]').click(); await wait(300); }
    const card=d.querySelector('.pcard');
    console.log('    (carte : '+card.textContent.replace(/\s+/g,' ').slice(0,160)+')');
    ok(!card.querySelector('.age') && !/📎/.test(card.textContent),'âge et badges masqués');
    ok(/Prioritaire/i.test(card.textContent) && !/surveiller/i.test(card.textContent),'étiquette « prioritaire » toujours visible, les autres masquées');
    console.log('═══ BARRE D\'OUTILS ═══');
    B.sheetPersoZone('moniteur'); await wait(100);
    d.querySelector('[data-tadd="route"]').click(); await wait(100);
    ok(d.querySelectorAll('.toolbar .tbtn').length===6 && d.querySelector('.toolbar [data-a="route"]'),'raccourci Route ajouté');
    ok(d.querySelector('.toolbar .tbtn').dataset.a==='tours','🦗 Cigale reste en premier');
    ok(!d.querySelector('[data-tadd]'),'5 raccourcis max : plus d\'ajout possible');
    console.log('═══ RÉINITIALISER ═══');
    B.sheetPersonnaliser(); await wait(100);
    d.querySelector('#pz-raz').click(); await wait(200); d.querySelector('.dlg-veil [data-yes]').click(); await wait(300);
    const S2=B.getS();
    ok(!S2.constsMasquees && !S2.zoomApp && !S2.toolbar && d.body.style.zoom==='' && d.querySelectorAll('.toolbar .tbtn').length===5,'affichage d\'origine rétabli');
    ok(S2.patients[0].visits.length===1 && S2.theme==='original','données et thème intacts');
    console.log('═══ THÈME JOUR / NUIT ═══');
    const h=new Date(); const hh=x=>String(x).padStart(2,'0');
    const avant=hh((h.getHours()+23)%24)+':00', apres=hh((h.getHours()+1)%24)+':00';
    S2.themeAuto={on:true,jour:'bloc',nuit:'hopital',hJour:avant,hNuit:apres}; B.applyTheme();
    ok(B.themeEffectif()==='bloc' && H.dataset.appTheme==='bloc','en pleine journée : thème de jour');
    S2.themeAuto={on:true,jour:'bloc',nuit:'hopital',hJour:apres,hNuit:avant}; B.applyTheme();
    ok(B.themeEffectif()==='hopital' && H.dataset.appTheme==='hopital','la nuit : thème de nuit');
    S2.themeAuto={on:false}; B.applyTheme();
    ok(H.dataset.appTheme===undefined,'désactivé : thème unique (Original)');
    console.log('═══ RELÈVE PAR DÉFAUT ═══');
    S2.releveDefaut={signature:'Jmeu, IDEL remplaçant',vigilanceDabord:true};
    const txt=B.buildReleve({start:'2000-01-01',end:'2100-01-01',mode:'full',withRaps:true,keep:null,pOpts:{},layout:'structure',anon:false,tour:'A'});
    ok(/— Jmeu, IDEL remplaçant/.test(txt),'signature en bas de la relève');
    B.sheetPersoZone('releve'); await wait(100);
    d.querySelector('[data-rfm="docx"]').click(); await wait(100);
    ok(S2.releveDefaut.format==='docx','format par défaut enregistré');
    console.log('═══ PARTAGE DES RÉGLAGES ═══');
    S2.cardStyle='bande'; S2.theme='tubes'; S2.tourPw={A:{pw:'secret'}};
    const r=B.extraireReglages();
    ok(r.cardStyle==='bande' && r.theme==='tubes' && !('patients' in r) && !('tourPw' in r) && !('identity' in r),'liste fermée : ni patients, ni mots de passe, ni identité');
    S2.cardStyle='classique'; S2.theme='original';
    B.ouvrirTexteRecu(JSON.stringify({_jmreglages:1,de:'Pierre',reglages:{cardStyle:'bande',theme:'tubes',patients:[{id:'x'}],tourPw:{B:1}}})); await wait(200);
    d.querySelector('.dlg-veil [data-yes]').click(); await wait(300);
    const S3=B.getS();
    ok(S3.cardStyle==='bande' && S3.theme==='tubes','réglages du collègue appliqués');
    ok(S3.patients.length===1 && !S3.tourPw.B,'clés hors liste ignorées (patients, mots de passe)');
    ok(S3._reglagesAvant && S3._reglagesAvant.reglages.theme==='original','anciens réglages gardés pour ↺');
    console.log('═══ OUVERTURE ═══');
    B.sheetPersoZone('moniteur'); await wait(100);
    d.querySelector('[data-otour="A"]').click(); await wait(100);
    ok(B.getS().ouverture.tour==='A','tournée d\'ouverture fixée');
    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
    process.exit(0);
  })();
}
